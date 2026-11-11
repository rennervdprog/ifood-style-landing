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
