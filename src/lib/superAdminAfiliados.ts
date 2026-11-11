// Super-admin — Fase 3 (2026-11-11): matemática da aba "Afiliados".
//
// REGRA DE OURO: os números que esta lib calcula para a tela são
// EXATAMENTE os que a RPC admin_register_affiliate_payout executa no
// banco (migration 20261111090000_affiliates_admin_fase3.sql). Se um
// dia um dos dois mudar, o outro muda junto — divergência tela×RPC é bug.
//
// Definições (idênticas às da RPC):
// - Liberado (bruto): soma dos créditos 'available'.
// - A compensar (clawback): soma dos créditos 'paid' cuja fatura
//   (financial_transactions) foi estornada ('cancelled'/'failed') e que
//   ainda NÃO foram compensados (compensated_payout_id null). O motor
//   da Fase 1 não toca crédito 'paid' — a compensação acontece aqui,
//   descontada do próximo lote, com rastro no próprio crédito.
// - Líquido = liberado − a compensar. Pagamento exige afiliado
//   'approved' e líquido >= AFFILIATE_MIN_PAYOUT (R$ 100).
// - Dia do lote vigente: nextPayoutDate da Fase 2 (a mesma função que o
//   painel do afiliado usa) — a RPC espelha a regra em SQL.
//
// Valores monetários em REAIS (numeric do banco), não centavos.

import { AFFILIATE_MIN_PAYOUT } from "@/lib/affiliates";
import { nextPayoutDate } from "@/lib/affiliatePanel";

export type AffiliateStatus = "pending" | "approved" | "suspended";

/** Linha de affiliates que a aba lê (colunas explícitas, sem document via *). */
export interface AdminAffiliateRow {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  document: string | null;
  pix_key: string | null;
  payout_day: number;
  status: AffiliateStatus | string;
  referral_code: string;
  terms_accepted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Crédito com o status da fatura embutido (join financial_transactions). */
export interface AdminAffiliateCreditLike {
  credit_amount: number | string;
  status: string;
  compensated_payout_id?: string | null;
  /** Status atual da fatura ligada ao crédito (null se não veio o join). */
  invoice_status?: string | null;
}

export interface AdminAffiliatePayoutLike {
  amount: number | string;
  status: string;
}

const toAmount = (value: number | string | null | undefined): number => {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * O crédito entra no "a compensar"? Pago ao afiliado, fatura estornada
 * depois e compensação ainda não baixada. Espelho da cláusula da RPC.
 */
export function isCompensableCredit(
  credit: AdminAffiliateCreditLike,
): boolean {
  return (
    credit.status === "paid" &&
    !credit.compensated_payout_id &&
    (credit.invoice_status === "cancelled" ||
      credit.invoice_status === "failed")
  );
}

/** Soma do clawback pendente de um conjunto de créditos. */
export function computeToCompensate(
  credits: readonly AdminAffiliateCreditLike[],
): number {
  return round2(
    credits
      .filter(isCompensableCredit)
      .reduce((sum, c) => sum + toAmount(c.credit_amount), 0),
  );
}

export interface AffiliatePayableSummary {
  /** Bruto liberado: créditos 'available'. */
  available: number;
  /** Créditos 'pending' (ainda nos 30 dias de segurança). */
  pending: number;
  /** Clawback pendente: já pago, fatura estornada, não compensado. */
  toCompensate: number;
  /** Líquido a pagar = available − toCompensate (pode ser negativo). */
  net: number;
  /** Total já pago ao afiliado (lotes 'paid'). */
  receivedTotal: number;
  /** Ele pode receber agora? (approved + líquido >= mínimo) */
  canPay: boolean;
  /** Quanto falta de líquido para o mínimo (0 quando atingiu). */
  missingForMin: number;
  /** Dia do lote vigente (próxima ocorrência do payout_day). */
  nextBatchDate: Date;
  /** Nunca recebeu um lote: o 1º pagamento pede revisão manual. */
  neverReceived: boolean;
}

export function summarizeAffiliateForAdmin(
  affiliate: { status: string; payout_day: number },
  credits: readonly AdminAffiliateCreditLike[],
  payouts: readonly AdminAffiliatePayoutLike[],
  from: Date = new Date(),
): AffiliatePayableSummary {
  let available = 0;
  let pending = 0;
  for (const credit of credits) {
    if (credit.status === "available") {
      available += toAmount(credit.credit_amount);
    } else if (credit.status === "pending") {
      pending += toAmount(credit.credit_amount);
    }
  }
  const gross = round2(available);
  const toCompensate = computeToCompensate(credits);
  const net = round2(gross - toCompensate);
  const receivedTotal = round2(
    payouts
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + toAmount(p.amount), 0),
  );
  return {
    available: gross,
    pending: round2(pending),
    toCompensate,
    net,
    receivedTotal,
    canPay: affiliate.status === "approved" && net >= AFFILIATE_MIN_PAYOUT,
    missingForMin: round2(Math.max(0, AFFILIATE_MIN_PAYOUT - net)),
    nextBatchDate: nextPayoutDate(affiliate.payout_day, from),
    neverReceived: !payouts.some((p) => p.status === "paid"),
  };
}
