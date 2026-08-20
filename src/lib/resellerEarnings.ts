/**
 * Fonte da verdade única sobre como o revendedor ganha.
 * Regras alinhadas com os templates de plano no banco externo:
 *  - Essencial: R$ 89,90/mês, cobra só após R$ 5.000 de GMV mensal
 *  - Autonomia: condição legada preservada apenas para vínculos já existentes
 *  - Comissão recorrente: 20% da mensalidade paga pela loja
 *  - Bounty: R$ 50 por loja que atinge 20 pedidos entregues
 *
 * Regra que TEM que ficar explícita em toda tela: a comissão
 * recorrente só começa quando a loja passa do GMV gratuito e
 * a mensalidade é efetivamente cobrada.
 */

export const FREE_GMV_CENTS: Record<string, number> = {
  essencial: 500000,
  autonomia: 250000,
};

export const RECURRING_RATE = 0.2;
export const BOUNTY_CENTS = 5000;
export const BOUNTY_ORDERS_REQUIRED = 20;

export type EarningStage =
  | "pending_reseller"       // revendedor ainda não aprovado
  | "pre_bounty"             // loja indicada mas < 20 pedidos
  | "bounty_paid_free_tier"  // bounty ok, mas loja ainda em fase gratuita
  | "earning_recurring"      // loja passou do GMV, gerando MRR
  | "churned";               // loja cancelou

export function freeGmvCentsFor(planType?: string | null): number {
  const key = (planType || "").toLowerCase();
  return FREE_GMV_CENTS[key] ?? 0;
}

/**
 * Frase padrão usada em headers/tooltips.
 */
export const FREE_GMV_EXPLAINER =
  "Para novas indicações, você recebe 20% da mensalidade a partir do mês em que a loja indicada no Essencial passar de R$ 5.000 em vendas. Vínculos legados seguem as condições exibidas no painel.";

export const RECURRING_STARTS_TOOLTIP =
  "Só entra saldo recorrente quando a loja indicada passa do GMV gratuito e a mensalidade é cobrada.";

type StageInput = {
  referral_status?: string | null;
  plan_type?: string | null;
  gmv_60d_cents?: number | null;
  commissions_total_cents?: number | null;
  activated_at?: string | null;
};

/**
 * Determina o estágio do ganho de uma loja indicada.
 * Usa GMV 60d como proxy do GMV mensal (dashboard atual).
 */
export function getReferralEarningStage(s: StageInput): EarningStage {
  if (s.referral_status === "churned") return "churned";
  if (s.referral_status !== "active") return "pre_bounty";
  const free = freeGmvCentsFor(s.plan_type);
  // GMV 60d como proxy conservador: se já está acima do teto gratuito,
  // consideramos que a loja está pagando mensalidade.
  if (free > 0 && (s.gmv_60d_cents ?? 0) >= free) return "earning_recurring";
  return "bounty_paid_free_tier";
}

export function stageBadge(stage: EarningStage): { label: string; cls: string } {
  switch (stage) {
    case "earning_recurring":
      return { label: "Gerando recorrente", cls: "bg-green-500/10 text-green-600" };
    case "bounty_paid_free_tier":
      return { label: "Fase gratuita", cls: "bg-blue-500/10 text-blue-600" };
    case "pre_bounty":
      return { label: "Aguardando 20 pedidos", cls: "bg-amber-500/10 text-amber-600" };
    case "churned":
      return { label: "Cancelada", cls: "bg-red-500/10 text-red-600" };
    default:
      return { label: "Em análise", cls: "bg-muted text-muted-foreground" };
  }
}

export function remainingToPaidCents(s: StageInput): number {
  const free = freeGmvCentsFor(s.plan_type);
  if (free <= 0) return 0;
  return Math.max(0, free - (s.gmv_60d_cents ?? 0));
}

export const brlFromCents = (c: number) =>
  ((c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });