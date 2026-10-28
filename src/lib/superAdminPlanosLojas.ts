// Planos das lojas (Teste, Fase 7) — helpers puros, sem React/Supabase.
// Decisão do Renner (28/10 ~07:33): o Somente PDV entra como plano de
// primeira classe — cartão, selo com nome e botão de troca. É a ÚLTIMA
// tela do Financeiro a ser redesenhada.
// A lógica de plano é a mesma do AdminPlanManager original, só com o
// pdv_only incluído (o original não conhece esse tipo: zero menções).

/** Tipos de plano no banco (store_plans.plan_type). */
export type PlanTypeTeste = "fixed" | "hybrid" | "commission_only" | "autonomy" | "pdv_only";

/** Plano exibido na tela — supporter é fixed com fee de apoiador. */
export type DisplayPlanTeste = PlanTypeTeste | "supporter";

/** Mensalidade do template Somente PDV (plan_templates, sort 0). */
export const PDV_ONLY_FEE = 120;

/** Rótulo do Somente PDV (mesmo do template). */
export const PDV_ONLY_LABEL = "Somente PDV";

/**
 * Descrição do cartão Somente PDV — texto do protótipo aprovado, NÃO o do
 * template: a descrição do template está defasada ("R$ 69,00/mês...") e
 * contradiz o preço de R$ 120/mês do próprio template.
 */
export const PDV_ONLY_DESCRIPTION =
  "Só o PDV presencial, sem delivery — o plano da Silvia.";

/** Recursos do cartão Somente PDV — texto do protótipo aprovado. */
export const PDV_ONLY_FEATURES = [
  "PDV presencial",
  "Sem mensalidade de delivery",
  "Taxa PDV por venda",
];

/** Taxa de apoiador (mesma constante do AdminPlanManager original). */
export const SUPPORTER_FEE = 75;
export const SUPPORTER_LIMIT = 10;

export interface StorePlanInput {
  store_id: string;
  plan_type: string;
  monthly_fee: number | string | null;
  commission_rate?: number | string | null;
  next_billing_date: string | null;
  trial_ends_at?: string | null;
  started_at?: string | null;
  is_active?: boolean | null;
  essencial_lifetime_free?: boolean | null;
}

export interface StoreInput {
  id: string;
  name: string;
  status?: string | null;
  is_test?: boolean | null;
}

/**
 * Resolve o plano exibido — mesma lógica do original (supporter é fixed
 * com fee 75/130 ou com o valor do template), só que o pdv_only passa
 * direto em vez de cair num cast sem rótulo.
 */
export function resolveDisplayPlanTeste(
  plan: { plan_type: string; monthly_fee: number | string | null } | null | undefined,
  supporterFee?: number,
): DisplayPlanTeste | null {
  if (!plan) return null;
  if (plan.plan_type === "fixed") {
    const fee = Number(plan.monthly_fee);
    if (fee === SUPPORTER_FEE || fee === 130) return "supporter";
    if (supporterFee != null && fee === Number(supporterFee)) return "supporter";
  }
  return plan.plan_type as PlanTypeTeste;
}

export interface PlanosStats {
  distribution: Record<DisplayPlanTeste | "no_plan", number>;
  /** Soma das mensalidades de todos os planos ativos (inclui teste). */
  totalRevenue: number;
  /** Soma sem as lojas de teste — igual ao MRR do Consolidado/Mensalidades. */
  revenueExcludingTest: number;
  /** Lojas com plano ativo. */
  withPlan: number;
  /** Lojas sem plano ativo. */
  withoutPlan: number;
  /** Com mensalidade acima de R$ 0,00. */
  paying: number;
  supporterUsed: number;
  supporterAvailable: number;
}

/** Mesma contagem da tela original, agora com o pdv_only incluído. */
export function computePlanosStats(
  stores: StoreInput[],
  plans: StorePlanInput[],
  supporterFee?: number,
): PlanosStats {
  const distribution: Record<DisplayPlanTeste | "no_plan", number> = {
    supporter: 0,
    fixed: 0,
    hybrid: 0,
    commission_only: 0,
    autonomy: 0,
    pdv_only: 0,
    no_plan: 0,
  };
  const planByStore = new Map(plans.map((p) => [p.store_id, p]));
  let totalRevenue = 0;
  let revenueExcludingTest = 0;
  let paying = 0;
  for (const s of stores) {
    const plan = planByStore.get(s.id);
    const display = resolveDisplayPlanTeste(plan, supporterFee);
    if (display) distribution[display]++;
    else distribution.no_plan++;
    const fee = Number(plan?.monthly_fee || 0);
    totalRevenue += fee;
    if (!s.is_test) revenueExcludingTest += fee;
    if (fee > 0) paying++;
  }
  const supporterUsed = distribution.supporter;
  return {
    distribution,
    totalRevenue,
    revenueExcludingTest,
    withPlan: stores.length - distribution.no_plan,
    withoutPlan: distribution.no_plan,
    paying,
    supporterUsed,
    supporterAvailable: Math.max(0, SUPPORTER_LIMIT - supporterUsed),
  };
}

export interface StorePlanRow {
  store_id: string;
  name: string;
  status: string;
  isTest: boolean;
  display: DisplayPlanTeste | null;
  monthly: number;
  commissionRate: number;
  nextBilling: string | null;
  trialEnds: string | null;
  lifetimeFree: boolean;
  hasPendingRequest: boolean;
}

/** Monta uma linha da lista a partir do plano + loja. */
export function buildStorePlanRow(
  s: StoreInput,
  p: StorePlanInput | undefined,
  supporterFee: number | undefined,
  pendingStoreIds: Set<string>,
): StorePlanRow {
  return {
    store_id: s.id,
    name: s.name,
    status: s.status ?? "",
    isTest: !!s.is_test,
    display: resolveDisplayPlanTeste(p, supporterFee),
    monthly: Number(p?.monthly_fee || 0),
    commissionRate: Number(p?.commission_rate || 0),
    nextBilling: p?.next_billing_date ?? null,
    trialEnds: p?.trial_ends_at ?? null,
    lifetimeFree: !!(p as StorePlanInput | undefined)?.essencial_lifetime_free,
    hasPendingRequest: pendingStoreIds.has(s.id),
  };
}

/**
 * Ordenação do protótipo: maior mensalidade primeiro, depois nome
 * (A–Z). Gratuitos (R$ 0) ficam em ordem alfabética; sem plano, idem.
 */
export function sortStorePlanRows(rows: StorePlanRow[]): StorePlanRow[] {
  return [...rows].sort(
    (a, b) => b.monthly - a.monthly || a.name.localeCompare(b.name, "pt-BR"),
  );
}

export interface GroupedStorePlanRows {
  paying: StorePlanRow[];
  free: StorePlanRow[];
  noPlan: StorePlanRow[];
}

/** Grupos da lista do protótipo: pagantes, gratuitos e sem plano. */
export function groupStorePlanRows(rows: StorePlanRow[]): GroupedStorePlanRows {
  const sorted = sortStorePlanRows(rows);
  return {
    paying: sorted.filter((r) => r.display && r.monthly > 0),
    free: sorted.filter((r) => r.display && r.monthly <= 0),
    noPlan: sorted.filter((r) => !r.display),
  };
}

/** "2026-11-20T12:00:00+00" -> "20/11". Só a parte de calendário. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}`;
}

/** Dias inteiros entre `iso` (passado) e `now` — "há 19 dias". */
export function daysSince(iso: string | null | undefined, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000));
}

export interface DistributionExtras {
  /** Essencial pagando a mensalidade cheia do template. */
  fixedFullPrice: number;
  /** Comissão com 6% por pedido. */
  commissionAt6: number;
  /** Soma das mensalidades Somente PDV. */
  pdvTotal: number;
}

/**
 * Detalhes dos cartões de distribuição — a contagem de "valor cheio"
 * usa a mensalidade cheia do Essencial (template/fallback).
 */
export function computeDistributionExtras(
  plans: StorePlanInput[],
  supporterFee: number | undefined,
  fixedFullFee: number,
): DistributionExtras {
  let fixedFullPrice = 0;
  let commissionAt6 = 0;
  let pdvTotal = 0;
  for (const p of plans) {
    const display = resolveDisplayPlanTeste(p, supporterFee);
    if (display === "fixed" && Number(p.monthly_fee) === Number(fixedFullFee)) fixedFullPrice++;
    if (p.plan_type === "commission_only" && Number(p.commission_rate) === 6) commissionAt6++;
    if (p.plan_type === "pdv_only") pdvTotal += Number(p.monthly_fee || 0);
  }
  return { fixedFullPrice, commissionAt6, pdvTotal };
}

/** "R$ 1.085,49" — mesmo formato do resto do Financeiro. */
export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
