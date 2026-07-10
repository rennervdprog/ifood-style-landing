/**
 * Helper único para "é loja pagante da plataforma?".
 * Usado por KPIs e listas do painel Financeiro — sempre a mesma regra
 * para que os totais batam com a contagem exibida.
 */
export type PaganteStoreLike = { is_test?: boolean | null };
export type PaganteplanLike = { is_active?: boolean | null; plan_type?: string | null };

export const PAGANTE_PLAN_TYPES = [
  "fixed",
  "supporter",
  "autonomy",
  "hybrid",
  "commission_only",
] as const;

export function isPagante(store: PaganteStoreLike | null | undefined, plan: PaganteplanLike | null | undefined): boolean {
  if (!store || store.is_test) return false;
  if (!plan || !plan.is_active || !plan.plan_type) return false;
  return (PAGANTE_PLAN_TYPES as readonly string[]).includes(plan.plan_type);
}