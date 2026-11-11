// Sistema de Afiliados — constantes e regras puras do programa.
// Plano aprovado em 2026-11-10 (piloto fechado com proteções); o schema
// fica em supabase/migrations/20261110183000_affiliates.sql.
//
// Regras do programa (decisão do Renner):
// - Essencial: o afiliado recebe 100% da mensalidade paga pela loja.
// - Somente PDV: o afiliado recebe 50% (o PDV não gera taxa de entrega,
//   então a mensalidade é dividida com a plataforma).
// - O ItaSuper fica com a taxa de R$ 0,99/entrega das lojas de delivery.
// - Crédito nasce SÓ de mensalidade efetivamente paga e libera 30 dias
//   depois (proteção contra estorno/chargeback).
// - Pagamento em lote via Pix, no dia 5 ou 20 (escolha do afiliado),
//   com mínimo de R$ 100 (abaixo disso, acumula para o próximo lote).
// - NÃO é split: a loja paga 100% ao ItaSuper e o ItaSuper paga o
//   afiliado no acerto, estilo repasse ao contrário.

export type AffiliatePlanKind = "essencial" | "pdv";

/** Percentual da mensalidade que vira crédito, por tipo de plano. */
export const AFFILIATE_RATE_PERCENT: Record<AffiliatePlanKind, number> = {
  essencial: 100,
  pdv: 50,
};

/** Dias entre a mensalidade paga e o crédito ficar disponível. */
export const AFFILIATE_HOLD_DAYS = 30;

/** Dias do mês em que o lote de pagamentos pode cair (escolha do afiliado). */
export const AFFILIATE_PAYOUT_DAYS: readonly number[] = [5, 20];

/** Valor mínimo (R$) para um afiliado entrar no lote de pagamentos. */
export const AFFILIATE_MIN_PAYOUT = 100;

export interface AffiliateCredit {
  ratePercent: number;
  creditAmount: number;
}

/**
 * Calcula o crédito de UMA mensalidade paga.
 * A base é o valor efetivamente pago (a fatura), nunca o preço de tabela:
 * planos têm valores customizados (ex.: PDV de R$ 130, Essencial de R$ 9).
 * O arredondamento é em centavos: (valor × percentual) arredondado e
 * dividido por 100 — exato para percentuais inteiros.
 */
export function computeAffiliateCredit(
  planKind: AffiliatePlanKind,
  monthlyFeePaid: number,
): AffiliateCredit {
  const ratePercent = AFFILIATE_RATE_PERCENT[planKind];
  if (!Number.isFinite(monthlyFeePaid) || monthlyFeePaid <= 0) {
    return { ratePercent, creditAmount: 0 };
  }
  const creditAmount = Math.round(monthlyFeePaid * ratePercent) / 100;
  return { ratePercent, creditAmount };
}

/**
 * Data de liberação do crédito: 30 dias depois de ele nascer
 * (earned_at + AFFILIATE_HOLD_DAYS). Recebe e devolve ISO 8601 (UTC).
 */
export function creditReleaseDate(earnedAtISO: string): string {
  const earnedAt = new Date(earnedAtISO);
  const releaseAt = new Date(earnedAt.getTime());
  releaseAt.setUTCDate(releaseAt.getUTCDate() + AFFILIATE_HOLD_DAYS);
  return releaseAt.toISOString();
}

/** O dia de pagamento escolhido pelo afiliado é um dos dias de lote? */
export function isPayoutDayValid(day: number): boolean {
  return Number.isInteger(day) && AFFILIATE_PAYOUT_DAYS.includes(day);
}

// ─── Captura do código de indicação (item 1.2) ─────────────────────────
//
// O link do afiliado usa `?ref=CODIGO` — o mesmo parâmetro que moderadores
// e revendedores já usam. Cada programa resolve o código na sua própria
// tabela e uma tentativa que não casa é ignorada sem erro, então os três
// fluxos convivem na mesma URL. O código é guardado em localStorage para
// sobreviver às etapas do cadastro (e ao desvio /auth → /parceiro) e é
// consumido uma única vez, no cadastro da loja, pela RPC
// bind_store_to_affiliate (migration 20261110190000).

/** Chave do localStorage onde o código capturado espera o cadastro. */
export const REFERRAL_STORAGE_KEY = "itasuper_affiliate_ref";

/** Fontes do vínculo gravadas em affiliate_referrals.source. */
export type AffiliateReferralSource = "link" | "code";

/**
 * Normaliza um código de indicação: trim, maiúsculas e só [A-Z0-9] —
 * EXATAMENTE a mesma normalização das RPCs reseller_attach_signup e
 * bind_store_to_affiliate no banco, para cliente e servidor concordarem.
 */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Extrai e normaliza o código de `?ref=` de uma query string
 * ("?ref=ABC", "ref=ABC" ou a string de um URLSearchParams).
 * Retorna null quando não há código válido.
 */
export function parseReferralFromSearch(
  search: string | null | undefined,
): string | null {
  if (!search) return null;
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );
    const code = normalizeReferralCode(params.get("ref"));
    return code || null;
  } catch {
    return null;
  }
}

function referralStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // navegador bloqueando storage (modo privado etc.)
  }
}

/** Guarda o código capturado para o cadastro consumir depois. */
export function storeReferralCode(code: string): void {
  const normalized = normalizeReferralCode(code);
  const storage = referralStorage();
  if (!normalized || !storage) return;
  try {
    storage.setItem(REFERRAL_STORAGE_KEY, normalized);
  } catch {
    /* storage cheio/bloqueado: o vínculo é best-effort */
  }
}

/** O código guardado pela captura, já normalizado (ou null). */
export function getStoredReferralCode(): string | null {
  const storage = referralStorage();
  if (!storage) return null;
  try {
    return normalizeReferralCode(storage.getItem(REFERRAL_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

/** Apaga o código guardado (depois que o cadastro o consumiu). */
export function clearStoredReferralCode(): void {
  const storage = referralStorage();
  if (!storage) return;
  try {
    storage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
