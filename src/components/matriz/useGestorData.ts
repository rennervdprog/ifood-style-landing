/**
 * useGestorData — queries do Painel Matriz Gestor de Redes.
 *
 * Hooks react-query (padrão do painel, chaves "matriz-gestor-*") que
 * alimentam as abas Visão geral / Financeiro / Operação e os cartões da
 * aba Unidades. Toda agregação pesada mora em src/lib/networkGestor.ts
 * (funções puras); aqui é só buscar linhas reais no Supabase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStoreOpenStatus, type OpeningHour, type StoreStatusResult } from "@/lib/storeStatus";
import {
  parseMenuDivergence,
  summarizeMenuDivergence,
  type MenuDivergenceSummary,
} from "@/lib/networkUnits";
import {
  SALES_STATUSES,
  aggregatePeriodOrders,
  dailySeriesLast7Days,
  fallbackFeeBreakdown,
  parseFeeBreakdown,
  periodWindows,
  type GestorPeriod,
  type NetworkFeeBreakdown,
  type OrderRowLite,
} from "@/lib/networkGestor";

export interface GestorUnitLite {
  id: string;
  name: string;
  status?: string | null;
  is_draft?: boolean | null;
  force_closed?: boolean | null;
  is_open?: boolean | null;
  plan_type?: string | null;
  created_at?: string | null;
}

const SALES = [...SALES_STATUSES];

/** Vendas/pedidos/ticket do período + período anterior, rede e por loja. */
export function usePeriodStats(sublojaIds: string[], period: GestorPeriod) {
  const windows = periodWindows(period);
  return useQuery({
    queryKey: ["matriz-gestor-period", period, sublojaIds.join(",")],
    enabled: sublojaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("store_id, total_price, created_at")
        .in("store_id", sublojaIds)
        .in("status", SALES as any)
        .gte("created_at", windows.previousStart.toISOString());
      if (error) throw error;
      return aggregatePeriodOrders((data || []) as OrderRowLite[], windows, sublojaIds);
    },
  });
}

/** Série de vendas dos últimos 7 dias (gráfico da Visão geral). */
export function useDailySeries(sublojaIds: string[]) {
  return useQuery({
    queryKey: ["matriz-gestor-daily7", sublojaIds.join(",")],
    enabled: sublojaIds.length > 0,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);
      const { data, error } = await supabase
        .from("orders")
        .select("store_id, total_price, created_at")
        .in("store_id", sublojaIds)
        .in("status", SALES as any)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return dailySeriesLast7Days((data || []) as OrderRowLite[]);
    },
  });
}

export interface RecentOrder {
  id: string;
  storeId: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  /** Ex.: "2× Pizza G Calabresa" ou "3 itens". */
  itemsSummary: string;
}

/** Últimos pedidos da rede (todas as unidades), atualiza a cada 30s. */
export function useRecentOrders(sublojaIds: string[]) {
  return useQuery({
    queryKey: ["matriz-gestor-recent-orders", sublojaIds.join(",")],
    enabled: sublojaIds.length > 0,
    refetchInterval: 30000,
    queryFn: async (): Promise<RecentOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, store_id, status, total_price, created_at, order_items(quantity, products(name))")
        .in("store_id", sublojaIds)
        .neq("status", "aguardando_pagamento" as any)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data || []).map((o: any) => {
        const items = (o.order_items || []) as { quantity: number; products?: { name?: string } | null }[];
        let itemsSummary = "Pedido";
        if (items.length === 1) {
          const it = items[0];
          itemsSummary = `${it.quantity}× ${it.products?.name || "item"}`;
        } else if (items.length > 1) {
          const first = items[0];
          itemsSummary = `${first.quantity}× ${first.products?.name || "item"} + ${items.length - 1}`;
        }
        return {
          id: o.id,
          storeId: o.store_id,
          status: o.status,
          totalPrice: Number(o.total_price || 0),
          createdAt: o.created_at,
          itemsSummary,
        };
      });
    },
  });
}

/** Aberta/fechada agora por unidade (mesma regra da vitrine: storeStatus). */
export function useUnitsOpenStatus(units: GestorUnitLite[]) {
  const ids = units.map((u) => u.id);
  return useQuery({
    queryKey: ["matriz-gestor-open-status", ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 60000,
    queryFn: async (): Promise<Map<string, StoreStatusResult>> => {
      const { data, error } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", ids);
      if (error) throw error;
      const byStore = new Map<string, OpeningHour[]>();
      for (const row of (data || []) as any[]) {
        const arr = byStore.get(row.store_id) || [];
        arr.push({
          day_of_week: row.day_of_week,
          open_time: row.open_time,
          close_time: row.close_time,
          is_closed_all_day: !!row.is_closed_all_day,
        });
        byStore.set(row.store_id, arr);
      }
      const result = new Map<string, StoreStatusResult>();
      for (const u of units) {
        result.set(u.id, getStoreOpenStatus(byStore.get(u.id) || [], !!u.force_closed, !!u.is_open));
      }
      return result;
    },
  });
}

/** Último pedido de cada unidade (qualquer status) — base do alerta "sem pedidos". */
export function useLastOrderByUnit(sublojaIds: string[]) {
  return useQuery({
    queryKey: ["matriz-gestor-last-order", sublojaIds.join(",")],
    enabled: sublojaIds.length > 0,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("orders")
        .select("store_id, created_at")
        .in("store_id", sublojaIds)
        .neq("status", "aguardando_pagamento" as any)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data || []) as any[]) {
        if (!map.has(row.store_id)) map.set(row.store_id, row.created_at);
      }
      return map;
    },
  });
}

/** Loja-fonte do cardápio da rede (RPC da Fase 3). */
export function useMenuSource(networkId: string | undefined) {
  return useQuery({
    queryKey: ["matriz-v2-menu-source", networkId],
    enabled: !!networkId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any).rpc("network_menu_source", {
        _network_id: networkId,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

/** Divergência de cardápio por unidade (RPC da Fase 3), reusando o modal. */
export function useMenuDivergences(networkId: string | undefined, unitIds: string[]) {
  const { data: sourceStoreId } = useMenuSource(networkId);
  const query = useQuery({
    queryKey: ["matriz-gestor-divergences", sourceStoreId, unitIds.join(",")],
    enabled: !!sourceStoreId && unitIds.length > 0,
    queryFn: async (): Promise<Map<string, MenuDivergenceSummary>> => {
      const map = new Map<string, MenuDivergenceSummary>();
      await Promise.all(
        unitIds.map(async (unitId) => {
          if (unitId === sourceStoreId) return;
          const { data, error } = await (supabase as any).rpc("network_menu_divergence", {
            _source_store_id: sourceStoreId,
            _target_store_id: unitId,
          });
          if (error) throw error;
          map.set(unitId, summarizeMenuDivergence(parseMenuDivergence(data)));
        }),
      );
      return map;
    },
  });
  return { sourceStoreId: sourceStoreId ?? null, ...query };
}

export interface FeeBreakdownResult {
  breakdown: NetworkFeeBreakdown;
  /** "rpc" = regra do banco; "espelho" = cálculo local enquanto a migration do wrapper não é aplicada. */
  source: "rpc" | "espelho";
}

/**
 * Breakdown da mensalidade: tenta a RPC get_network_monthly_fee (wrapper
 * com checagem de dono, migration do Gestor — ainda não aplicada); sem ela,
 * calcula o espelho local com a mesma regra a partir de template/contagens.
 */
export function useFeeBreakdown(
  network: { id: string; plan_type: string; monthly_fee: number } | null,
  units: GestorUnitLite[],
  gmv60d: number,
) {
  const unitIds = units.map((u) => u.id);
  return useQuery({
    queryKey: ["matriz-gestor-fee", network?.id, unitIds.join(","), gmv60d],
    enabled: !!network,
    queryFn: async (): Promise<FeeBreakdownResult> => {
      const { data, error } = await (supabase as any).rpc("get_network_monthly_fee", {
        _network_id: network!.id,
      });
      if (!error) {
        const parsed = parseFeeBreakdown(data);
        if (parsed) return { breakdown: parsed, source: "rpc" };
      }
      // Espelho local (mesma regra da RPC, dados que o painel já carrega).
      const [tplRes, plansRes] = await Promise.all([
        (supabase as any)
          .from("plan_templates")
          .select("monthly_fee")
          .eq("plan_type", network!.plan_type)
          .eq("is_active", true)
          .limit(1),
        unitIds.length > 0
          ? (supabase as any)
              .from("store_plans")
              .select("store_id, plan_type")
              .in("store_id", unitIds)
              .eq("is_active", true)
          : Promise.resolve({ data: [] }),
      ]);
      const templateFee = Number((tplRes.data || [])[0]?.monthly_fee);
      const base = Number.isFinite(templateFee) && (tplRes.data || []).length > 0
        ? templateFee
        : Number(network!.monthly_fee || 0);
      const planTypeByStore = new Map<string, string>(
        ((plansRes.data || []) as any[]).map((p) => [p.store_id, p.plan_type]),
      );
      let delivery = 0, pdvOnly = 0;
      for (const u of units) {
        if (u.status !== "ativo" || u.is_draft) continue;
        const isPdvOnly = u.plan_type === "pdv_only" || planTypeByStore.get(u.id) === "pdv_only";
        if (isPdvOnly) pdvOnly += 1; else delivery += 1;
      }
      return {
        breakdown: fallbackFeeBreakdown({
          planType: network!.plan_type,
          baseMonthlyFee: base,
          deliveryUnitCount: delivery,
          pdvOnlyUnitCount: pdvOnly,
          gmv60d,
        }),
        source: "espelho",
      };
    },
  });
}

export interface PdvAddonInfo {
  storeId: string;
  /** Preço mensal efetivo (override da loja ou preço de catálogo). */
  price: number | null;
}

/** Add-ons de PDV ativos (código 'pdv') das sublojas — linhas do Financeiro. */
export function usePdvAddons(sublojaIds: string[]) {
  return useQuery({
    queryKey: ["matriz-gestor-pdv-addons", sublojaIds.join(",")],
    enabled: sublojaIds.length > 0,
    queryFn: async (): Promise<PdvAddonInfo[]> => {
      const [addonsRes, catalogRes] = await Promise.all([
        (supabase as any)
          .from("store_addons")
          .select("store_id, price_override, cancels_at")
          .in("store_id", sublojaIds)
          .eq("addon_code", "pdv")
          .eq("enabled", true),
        (supabase as any)
          .from("plan_addons")
          .select("monthly_price")
          .eq("code", "pdv")
          .limit(1),
      ]);
      const catalogPrice = Number((catalogRes.data || [])[0]?.monthly_price);
      const now = Date.now();
      return ((addonsRes.data || []) as any[])
        .filter((a) => !a.cancels_at || new Date(a.cancels_at).getTime() > now)
        .map((a) => ({
          storeId: a.store_id,
          price: a.price_override != null
            ? Number(a.price_override)
            : Number.isFinite(catalogPrice) ? catalogPrice : null,
        }));
    },
  });
}

export interface BillingTx {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  referenceCode: string | null;
}

/**
 * Histórico de cobranças: primeiro as da REDE (charge_family
 * 'network_monthly_subscription', ancoradas na loja-guia). Se a rede
 * ainda não tem nenhuma (flag de cobrança desligada), devolve também as
 * cobranças da loja-guia no modelo por loja, rotuladas como fallback.
 */
export function useBillingHistory(guideStoreId: string | null, networkId: string | undefined) {
  return useQuery({
    queryKey: ["matriz-gestor-billing-history", guideStoreId, networkId],
    enabled: !!guideStoreId,
    queryFn: async (): Promise<{ networkTx: BillingTx[]; guideTx: BillingTx[] }> => {
      const mapTx = (rows: any[]): BillingTx[] =>
        rows.map((t) => ({
          id: t.id,
          amount: Number(t.amount || 0),
          status: t.status,
          createdAt: t.created_at,
          referenceCode: t.reference_code ?? null,
        }));
      const { data: netData, error } = await (supabase as any)
        .from("financial_transactions")
        .select("id, amount, status, created_at, reference_code")
        .eq("store_id", guideStoreId)
        .filter("metadata->>charge_family", "eq", "network_monthly_subscription")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const networkTx = mapTx(netData || []);
      let guideTx: BillingTx[] = [];
      if (networkTx.length === 0) {
        const { data: guideData } = await (supabase as any)
          .from("financial_transactions")
          .select("id, amount, status, created_at, reference_code")
          .eq("store_id", guideStoreId)
          .filter("metadata->>charge_family", "eq", "monthly_subscription")
          .order("created_at", { ascending: false })
          .limit(6);
        guideTx = mapTx(guideData || []);
      }
      return { networkTx, guideTx };
    },
  });
}
