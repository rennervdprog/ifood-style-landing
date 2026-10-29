/**
 * networkGestor — helpers puros do Painel Matriz Gestor de Redes.
 *
 * Tudo aqui é função pura (sem Supabase, sem React): janelas de período,
 * agregação de pedidos, deltas, breakdown da mensalidade da rede e CSV.
 * As queries moram em src/components/matriz/useGestorData.ts e nas abas;
 * esta lib só transforma linhas de pedidos/transações em números de tela.
 *
 * Regras de negócio espelhadas do banco (fonte da verdade: migrations
 * 20261028220000/20261028230000, função calculate_network_monthly_fee):
 *  - vendas = soma de total_price de pedidos 'entregue'/'finalizado'
 *    (mesmo padrão do GMV 60d já usado no financeiro do painel);
 *  - mensalidade da rede = base + R$ 39,90 por unidade de delivery além
 *    das 3 primeiras; GMV 60d <= R$ 5.000 → rede não paga (gratuidade);
 *  - unidade só-PDV não conta nas 3 grátis nem paga os R$ 39,90.
 */
import {
  EXTRA_UNIT_MONTHLY_FEE,
  FREE_UNITS_INCLUDED,
  NETWORK_FREE_GMV_THRESHOLD,
} from "./networkLinkRules";

/** Status que contam como venda (padrão do GMV/financeiro do painel). */
export const SALES_STATUSES = ["finalizado", "entregue"] as const;

export type GestorPeriod = "hoje" | "7d" | "30d";

export const PERIOD_LABELS: Record<GestorPeriod, string> = {
  hoje: "hoje",
  "7d": "7 dias",
  "30d": "30 dias",
};

export const PERIOD_PREV_LABELS: Record<GestorPeriod, string> = {
  hoje: "vs. ontem",
  "7d": "vs. 7 dias anteriores",
  "30d": "vs. 30 dias anteriores",
};

export interface PeriodWindows {
  /** Início do período atual. */
  currentStart: Date;
  /** Início do período anterior equivalente. */
  previousStart: Date;
  /** Fim do período anterior (= início do atual). */
  previousEnd: Date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Janelas [anterior | atual] de mesmo tamanho, alinhadas ao dia local:
 * hoje → hoje desde 00:00 vs. ontem inteiro; 7d → últimos 7 dias
 * (incl. hoje) vs. os 7 anteriores; 30d → idem com 30.
 */
export function periodWindows(period: GestorPeriod, now: Date = new Date()): PeriodWindows {
  const today = startOfDay(now);
  if (period === "hoje") {
    return { currentStart: today, previousStart: addDays(today, -1), previousEnd: today };
  }
  const days = period === "7d" ? 7 : 30;
  const currentStart = addDays(today, -(days - 1));
  return {
    currentStart,
    previousStart: addDays(currentStart, -days),
    previousEnd: currentStart,
  };
}

export interface OrderRowLite {
  store_id: string;
  total_price: number | string | null;
  created_at: string;
}

export interface StorePeriodStats {
  storeId: string;
  sales: number;
  orders: number;
  ticket: number;
  prevSales: number;
  prevOrders: number;
  salesDelta: number | null;
}

export interface PeriodAggregate {
  sales: number;
  orders: number;
  ticket: number;
  prevSales: number;
  prevOrders: number;
  salesDelta: number | null;
  ordersDelta: number | null;
  perStore: Map<string, StorePeriodStats>;
}

/** Variação % de `current` contra `previous`; null quando não há base. */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function emptyStoreStats(storeId: string): StorePeriodStats {
  return { storeId, sales: 0, orders: 0, ticket: 0, prevSales: 0, prevOrders: 0, salesDelta: null };
}

/**
 * Agrega as linhas de pedidos (já filtradas para os status de venda)
 * nas janelas atual/anterior: total da rede, por loja e deltas.
 */
export function aggregatePeriodOrders(
  rows: readonly OrderRowLite[],
  windows: PeriodWindows,
  storeIds: readonly string[],
): PeriodAggregate {
  const perStore = new Map<string, StorePeriodStats>();
  for (const id of storeIds) perStore.set(id, emptyStoreStats(id));

  let sales = 0, orders = 0, prevSales = 0, prevOrders = 0;
  const curStart = windows.currentStart.getTime();
  const prevStart = windows.previousStart.getTime();

  for (const row of rows) {
    const t = new Date(row.created_at).getTime();
    const value = Number(row.total_price || 0);
    const st = perStore.get(row.store_id);
    if (t >= curStart) {
      sales += value; orders += 1;
      if (st) { st.sales += value; st.orders += 1; }
    } else if (t >= prevStart) {
      prevSales += value; prevOrders += 1;
      if (st) { st.prevSales += value; st.prevOrders += 1; }
    }
  }

  for (const st of perStore.values()) {
    st.ticket = st.orders > 0 ? st.sales / st.orders : 0;
    st.salesDelta = deltaPct(st.sales, st.prevSales);
  }

  return {
    sales,
    orders,
    ticket: orders > 0 ? sales / orders : 0,
    prevSales,
    prevOrders,
    salesDelta: deltaPct(sales, prevSales),
    ordersDelta: deltaPct(orders, prevOrders),
    perStore,
  };
}

export interface DaySales {
  /** Chave local AAAA-MM-DD. */
  key: string;
  /** Rótulo curto do dia da semana (pt-BR, minúsculas, 3 letras). */
  label: string;
  sales: number;
  isToday: boolean;
}

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function localDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Série de vendas por dia dos últimos 7 dias (incl. hoje), ordem cronológica. */
export function dailySeriesLast7Days(
  rows: readonly OrderRowLite[],
  now: Date = new Date(),
): DaySales[] {
  const today = startOfDay(now);
  const days: DaySales[] = [];
  const byKey = new Map<string, DaySales>();
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const entry: DaySales = {
      key: localDayKey(d),
      label: i === 0 ? "hoje" : WEEKDAY_SHORT[d.getDay()],
      sales: 0,
      isToday: i === 0,
    };
    days.push(entry);
    byKey.set(entry.key, entry);
  }
  for (const row of rows) {
    const entry = byKey.get(localDayKey(new Date(row.created_at)));
    if (entry) entry.sales += Number(row.total_price || 0);
  }
  return days;
}

/* ─── Mensalidade da rede (breakdown) ─────────────────────────────────── */

export interface NetworkFeeBreakdown {
  planType: string;
  baseMonthlyFee: number;
  /** "pdv_only_network" quando a base é zero por regra (Fase 4b, P1). */
  baseReason: string | null;
  isVip: boolean;
  deliveryUnitCount: number;
  pdvOnlyUnitCount: number;
  freeUnitsIncluded: number;
  extraUnitCount: number;
  extraUnitFee: number;
  extraFee: number;
  gmv60d: number;
  freeGmvThreshold: number;
  freeByGmv: boolean;
  totalMonthlyFee: number;
}

/** Lê o JSON da RPC calculate_network_monthly_fee (via wrapper do dono). */
export function parseFeeBreakdown(data: unknown): NetworkFeeBreakdown | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  if (d.total_monthly_fee === undefined || d.base_monthly_fee === undefined) return null;
  return {
    planType: String(d.plan_type ?? ""),
    baseMonthlyFee: num(d.base_monthly_fee),
    baseReason: typeof d.base_reason === "string" ? d.base_reason : null,
    isVip: d.is_vip === true,
    deliveryUnitCount: num(d.delivery_unit_count),
    pdvOnlyUnitCount: num(d.pdv_only_unit_count),
    freeUnitsIncluded: num(d.free_units_included, FREE_UNITS_INCLUDED),
    extraUnitCount: num(d.extra_unit_count),
    extraUnitFee: num(d.extra_unit_fee, EXTRA_UNIT_MONTHLY_FEE),
    extraFee: num(d.extra_fee),
    gmv60d: num(d.gmv_60d),
    freeGmvThreshold: num(d.free_gmv_threshold, NETWORK_FREE_GMV_THRESHOLD),
    freeByGmv: d.free_by_gmv === true,
    totalMonthlyFee: num(d.total_monthly_fee),
  };
}

/**
 * Espelho client-side do breakdown, usado ENQUANTO a migration do wrapper
 * (get_network_monthly_fee) não é aplicada: mesma regra da RPC, a partir
 * dos dados que o painel já carrega (template do plano ou valor guardado,
 * contagens de unidades publicadas e GMV 60d).
 */
export function fallbackFeeBreakdown(args: {
  planType: string;
  baseMonthlyFee: number;
  deliveryUnitCount: number;
  pdvOnlyUnitCount: number;
  gmv60d: number;
}): NetworkFeeBreakdown {
  const freeByGmv = args.gmv60d <= NETWORK_FREE_GMV_THRESHOLD;
  const extraUnitCount = Math.max(0, args.deliveryUnitCount - FREE_UNITS_INCLUDED);
  const extraFee = extraUnitCount * EXTRA_UNIT_MONTHLY_FEE;
  return {
    planType: args.planType,
    baseMonthlyFee: args.baseMonthlyFee,
    baseReason: null,
    isVip: false,
    deliveryUnitCount: args.deliveryUnitCount,
    pdvOnlyUnitCount: args.pdvOnlyUnitCount,
    freeUnitsIncluded: FREE_UNITS_INCLUDED,
    extraUnitCount,
    extraUnitFee: EXTRA_UNIT_MONTHLY_FEE,
    extraFee,
    gmv60d: args.gmv60d,
    freeGmvThreshold: NETWORK_FREE_GMV_THRESHOLD,
    freeByGmv,
    totalMonthlyFee: freeByGmv ? 0 : args.baseMonthlyFee + extraFee,
  };
}

/* ─── Pedidos recentes: apresentação por status ───────────────────────── */

export interface OrderStatusPresentation {
  label: string;
  /** Classes do selo (pílula sólida, padrão do painel). */
  badgeClass: string;
}

export function orderStatusPresentation(status: string): OrderStatusPresentation {
  switch (status) {
    case "pendente":
    case "aguardando_pagamento":
      return { label: "Novo", badgeClass: "bg-primary text-primary-foreground" };
    case "aguardando_comprovante":
    case "comprovante_enviado":
      return { label: "Aguard. pagamento", badgeClass: "bg-amber-500 text-white" };
    case "em_preparo":
    case "preparando":
    case "aceito":
      return { label: "Em preparo", badgeClass: "bg-amber-500 text-white" };
    case "pronto_para_entrega":
      return { label: "Pronto", badgeClass: "bg-blue-500 text-white" };
    case "saiu_para_entrega":
    case "em_transito":
    case "a_caminho":
      return { label: "Saiu p/ entrega", badgeClass: "bg-blue-600 text-white" };
    case "entregue":
    case "finalizado":
      return { label: "Entregue", badgeClass: "bg-green-600 text-white" };
    case "cancelado":
      return { label: "Cancelado", badgeClass: "bg-red-500 text-white" };
    default:
      return { label: status, badgeClass: "bg-muted text-muted-foreground" };
  }
}

/* ─── CSV de vendas por unidade ───────────────────────────────────────── */

export interface SalesCsvRow {
  unitName: string;
  orders: number;
  sales: number;
  ticket: number;
}

function csvMoney(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

/**
 * CSV (separador ';', com BOM) de vendas por unidade — abre certo no
 * Excel/Sheets em pt-BR. Inclui linha de total ao final.
 */
export function buildSalesCsv(rows: readonly SalesCsvRow[]): string {
  const lines = ["Unidade;Pedidos;Vendas (R$);Ticket médio (R$)"];
  let totalOrders = 0, totalSales = 0;
  for (const r of rows) {
    totalOrders += r.orders;
    totalSales += r.sales;
    lines.push(`"${r.unitName.replace(/"/g, '""')}";${r.orders};${csvMoney(r.sales)};${csvMoney(r.ticket)}`);
  }
  const totalTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
  lines.push(`TOTAL;${totalOrders};${csvMoney(totalSales)};${csvMoney(totalTicket)}`);
  return "\uFEFF" + lines.join("\r\n");
}

/** Dias inteiros desde uma data até agora (min. 0). */
export function daysSince(date: Date, now: Date = new Date()): number {
  const ms = startOfDay(now).getTime() - startOfDay(date).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
