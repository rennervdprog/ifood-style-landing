// Painel do Afiliado — Fase 2 (2026-11-11): lógica pura da tela /afiliado.
//
// Separada da página para ser testável: resumo de saldos a partir dos
// créditos, próxima data do lote (dia 5 ou 20) e progresso até o mínimo
// de pagamento. As constantes do programa (taxas, mínimo, dias) vivem em
// src/lib/affiliates.ts — aqui só mora o que é cálculo de exibição.
//
// Valores monetários aqui são em REAIS (numeric do banco), não centavos.

import { AFFILIATE_MIN_PAYOUT } from "@/lib/affiliates";

export type AffiliateCreditStatus =
  | "pending"
  | "available"
  | "paid"
  | "cancelled";

export type AffiliatePayoutStatus =
  | "scheduled"
  | "paid"
  | "failed"
  | "cancelled";

/** Forma mínima de um crédito que o resumo precisa (linha de affiliate_credits). */
export interface AffiliateCreditLike {
  credit_amount: number | string;
  status: AffiliateCreditStatus | string;
  release_at: string;
  payout_id?: string | null;
}

/** Forma mínima de um lote que o resumo precisa (linha de affiliate_payouts). */
export interface AffiliatePayoutLike {
  amount: number | string;
  status: AffiliatePayoutStatus | string;
}

/** numeric do Postgres chega como string no cliente — normalize p/ number. */
const toAmount = (value: number | string | null | undefined): number => {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface AffiliateBalanceSummary {
  /** Soma dos créditos 'available' — dinheiro liberado p/ o próximo lote. */
  available: number;
  /** Soma dos créditos 'pending' — ainda dentro dos 30 dias de segurança. */
  pending: number;
  /** Menor release_at entre os pendentes (ISO), ou null se não há pendente. */
  nextReleaseAt: string | null;
  /** Soma dos créditos 'paid' (já entraram em algum lote pago). */
  paidCreditsTotal: number;
}

export function summarizeCredits(
  credits: readonly AffiliateCreditLike[],
): AffiliateBalanceSummary {
  let available = 0;
  let pending = 0;
  let paidCreditsTotal = 0;
  let nextReleaseAt: string | null = null;

  for (const credit of credits) {
    const amount = toAmount(credit.credit_amount);
    if (credit.status === "available") {
      available += amount;
    } else if (credit.status === "pending") {
      pending += amount;
      if (!nextReleaseAt || credit.release_at < nextReleaseAt) {
        nextReleaseAt = credit.release_at;
      }
    } else if (credit.status === "paid") {
      paidCreditsTotal += amount;
    }
    // 'cancelled' não entra em nenhum saldo.
  }

  return {
    available: round2(available),
    pending: round2(pending),
    nextReleaseAt,
    paidCreditsTotal: round2(paidCreditsTotal),
  };
}

/**
 * Total que o afiliado JÁ recebeu: lotes (affiliate_payouts) com status
 * 'paid'. Créditos 'paid' sem lote vinculado (payout_id null) contam
 * também — por desenho todo crédito pago pertence a um lote, então a
 * soma principal é a dos lotes; o avulso é só rede de segurança p/ não
 * esconder dinheiro já pago.
 */
export function receivedTotal(
  credits: readonly AffiliateCreditLike[],
  payouts: readonly AffiliatePayoutLike[],
): number {
  const fromPayouts = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + toAmount(p.amount), 0);
  const loosePaidCredits = credits
    .filter((c) => c.status === "paid" && !c.payout_id)
    .reduce((sum, c) => sum + toAmount(c.credit_amount), 0);
  return round2(fromPayouts + loosePaidCredits);
}

/**
 * Próxima data de lote a partir do dia escolhido (5 ou 20): se hoje ainda
 * não chegou no dia (ou É o dia), o lote é neste mês; senão, no próximo.
 * Comparação por data local (sem hora) — virada de mês/ano tratada pelo
 * construtor de Date.
 */
export function nextPayoutDate(
  payoutDay: number,
  from: Date = new Date(),
): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const thisMonth = new Date(from.getFullYear(), from.getMonth(), payoutDay);
  if (thisMonth >= today) return thisMonth;
  return new Date(from.getFullYear(), from.getMonth() + 1, payoutDay);
}

export interface PayoutProgress {
  /** Mínimo de pagamento considerado (R$). */
  min: number;
  /** O saldo liberado já atinge o mínimo? */
  reached: boolean;
  /** Quanto falta para o mínimo (0 quando atingiu). */
  missing: number;
  /** Percentual do mínimo já liberado (0–100, teto em 100). */
  percent: number;
}

export function payoutProgress(
  available: number,
  min: number = AFFILIATE_MIN_PAYOUT,
): PayoutProgress {
  const value = Math.max(0, available);
  return {
    min,
    reached: value >= min,
    missing: round2(Math.max(0, min - value)),
    percent: round2(Math.min(100, (value / min) * 100)),
  };
}

/**
 * Link público de indicação: a loja se cadastra por ele e a captura da
 * Fase 1 (ReferralCapture) guarda o código — mesma base que o cadastro
 * de lojista já usa nos outros programas (?ref=).
 */
export function buildReferralLink(origin: string, code: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/cadastro-lojista?ref=${code}`;
}

/** R$ em pt-BR a partir de um valor em reais (ex.: 89.9 → "R$ 89,90"). */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Data (ISO ou Date) em dd/mm/aaaa, no fuso local de quem vê. */
export function formatDateBR(value: string | Date): string {
  let date: Date;
  if (typeof value === "string") {
    // Coluna `date` do Postgres chega como "yyyy-mm-dd" (sem hora):
    // `new Date("2026-11-20")` seria meia-noite UTC e renderizaria
    // 19/11 em America/Sao_Paulo. Interprete como data local.
    const onlyDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (onlyDate) {
      date = new Date(
        Number(onlyDate[1]),
        Number(onlyDate[2]) - 1,
        Number(onlyDate[3]),
      );
    } else {
      date = new Date(value);
    }
  } else {
    date = value;
  }
  return date.toLocaleDateString("pt-BR");
}
