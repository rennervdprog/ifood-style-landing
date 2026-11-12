import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PdvTableRow {
  id: string;
  store_id: string;
  label: string;
  seats: number;
  status: "free" | "occupied" | "billing";
  sort_order: number;
  opened_at: string | null;
}

export interface PdvTabRow {
  id: string;
  store_id: string;
  table_id: string | null;
  code: string | null;
  customer_name: string | null;
  status: "open" | "closed" | "canceled";
  opened_at: string;
  closed_at: string | null;
}

export interface PdvTabItemRow {
  id: string;
  tab_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  addons: any;
  observations: string | null;
  metadata: any;
  created_at: string;
}

/** Lista mesas + comandas abertas da loja. */
export function usePdvTables(storeId: string | undefined | null) {
  const qc = useQueryClient();
  const enabled = !!storeId;

  const tables = useQuery({
    queryKey: ["pdv-tables", storeId],
    enabled,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pdv_tables")
        .select("id,store_id,label,seats,status,sort_order,opened_at")
        .eq("store_id", storeId!)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PdvTableRow[];
    },
  });

  const tabs = useQuery({
    queryKey: ["pdv-tabs-open", storeId],
    enabled,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pdv_tabs")
        .select("id,store_id,table_id,code,customer_name,status,opened_at,closed_at")
        .eq("store_id", storeId!)
        .eq("status", "open")
        .order("opened_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PdvTabRow[];
    },
  });

  // Realtime: atualiza ao vivo
  useEffect(() => {
    if (!storeId) return;
    const ch = (supabase as any)
      .channel(`pdv-tables-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_tables", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["pdv-tables", storeId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_tabs", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["pdv-tabs-open", storeId] });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [storeId, qc]);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["pdv-tables", storeId] });
    qc.invalidateQueries({ queryKey: ["pdv-tabs-open", storeId] });
  }, [qc, storeId]);

  return {
    tables: tables.data ?? [],
    tabs: tabs.data ?? [],
    loading: tables.isLoading || tabs.isLoading,
    refresh,
  };
}

/** Itens de uma comanda. */
export function usePdvTabItems(tabId: string | null | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["pdv-tab-items", tabId],
    enabled: !!tabId,
    staleTime: 0,
    refetchInterval: 4_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pdv_tab_items")
        .select("*")
        .eq("tab_id", tabId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PdvTabItemRow[];
    },
  });

  useEffect(() => {
    if (!tabId) return;
    const ch = (supabase as any)
      .channel(`pdv-tab-items-${tabId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_tab_items", filter: `tab_id=eq.${tabId}` }, () => {
        qc.invalidateQueries({ queryKey: ["pdv-tab-items", tabId] });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [tabId, qc]);

  const refetch = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["pdv-tab-items", tabId] });
  }, [qc, tabId]);

  return { items: q.data ?? [], loading: q.isLoading, refetch };
}

// ── RPC wrappers ────────────────────────────────────────────────────────────

export async function rpcOpenTab(args: {
  storeId: string; tableId?: string | null; code?: string | null; customerName?: string | null;
}) {
  const { data, error } = await (supabase as any).rpc("pdv_open_tab", {
    _store_id: args.storeId,
    _table_id: args.tableId ?? null,
    _code: args.code ?? null,
    _customer_name: args.customerName ?? null,
  });
  if (error) throw error;
  return data as string; // tab_id
}

export async function rpcAddTabItem(args: {
  tabId: string; productId?: string | null; name: string; quantity: number; unitPrice: number;
  addons?: any; observations?: string | null; metadata?: any;
}) {
  const { data, error } = await (supabase as any).rpc("pdv_add_tab_item", {
    _tab_id: args.tabId,
    _product_id: args.productId ?? null,
    _name: args.name,
    _quantity: args.quantity,
    _unit_price: args.unitPrice,
    _addons: args.addons ?? null,
    _observations: args.observations ?? null,
    _metadata: args.metadata ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function rpcRemoveTabItem(itemId: string) {
  const { error } = await (supabase as any).rpc("pdv_remove_tab_item", { _item_id: itemId });
  if (error) throw error;
}

export async function rpcTransferTab(tabId: string, newTableId: string | null) {
  const { error } = await (supabase as any).rpc("pdv_transfer_tab", { _tab_id: tabId, _new_table_id: newTableId });
  if (error) throw error;
}

export async function rpcCancelTab(tabId: string, reason: string) {
  const { error } = await (supabase as any).rpc("pdv_cancel_tab", { _tab_id: tabId, _reason: reason });
  if (error) throw error;
}

/** Motivo de sistema registrado em `cancel_reason` no auto-cancelamento do N2. */
export const CLEAR_SALE_CANCEL_REASON = "Limpeza de venda sem itens enviados";

export interface CancelEmptyTabDeps {
  /** Quantidade de itens da comanda NO BANCO no momento da ação. */
  countTabItems: (tabId: string) => Promise<number>;
  /** Cancela a comanda (RPC `pdv_cancel_tab`, com motivo). */
  cancelTab: (tabId: string, reason: string) => Promise<void>;
}

const defaultCancelEmptyTabDeps: CancelEmptyTabDeps = {
  countTabItems: async (tabId) => {
    const { count, error } = await (supabase as any)
      .from("pdv_tab_items")
      .select("id", { count: "exact", head: true })
      .eq("tab_id", tabId);
    if (error) throw error;
    return count ?? 0;
  },
  cancelTab: (tabId, reason) => rpcCancelTab(tabId, reason),
};

/**
 * N2 Opção A — auto-cancela a comanda VAZIA no gesto "Limpar venda".
 *
 * Guardas obrigatórias (§2 do plano boutique):
 * (1) Cancela SÓ se a comanda tem 0 itens NO BANCO no momento da ação —
 *     carrinho vazio pode significar "itens já enviados". Falha ao contar =
 *     estado desconhecido = NUNCA cancela (fail-closed).
 * (2) O chamador usa o retorno para definir o "Desfazer": `true` = a comanda
 *     não existe mais, o snapshot volta sem destino (Balcão), sem ressuscitar
 *     o id morto; `false` = comanda preservada, destino original mantido.
 * (3) Vive SÓ nos gestos "Limpar venda" (botão + ESC) — nunca em `clearSale`,
 *     que é compartilhado com o pós-`pdv_close_tab`. E tolera comanda já
 *     fechada/cancelada (`tab_not_found_or_closed` = já se foi, silencioso).
 *
 * Nunca lança exceção e nunca mostra toast/diálogo: o gesto segue com o
 * mesmo toast "Venda limpa". A aba Mesas se atualiza pelo realtime de
 * `usePdvTables` (montado no `PdvTableSelector` da tela Vender).
 *
 * Ressalva: a checagem é count-then-cancel — `pdv_cancel_tab` não verifica
 * itens no servidor. Um envio concorrente de outro caixa na mesma janela
 * (fração de segundo, após o PIN) poderia cair no cancelamento; fechar isso
 * exigiria migration (fora do escopo do N2).
 */
export async function cancelEmptyTab(
  tabId: string | null | undefined,
  reason: string = CLEAR_SALE_CANCEL_REASON,
  deps: CancelEmptyTabDeps = defaultCancelEmptyTabDeps,
): Promise<boolean> {
  if (!tabId) return false;
  let itemCount: number;
  try {
    itemCount = await deps.countTabItems(tabId);
  } catch (e) {
    console.warn("[N2] contagem de itens da comanda falhou; comanda preservada", e);
    return false;
  }
  if (itemCount > 0) return false;
  try {
    await deps.cancelTab(tabId, reason);
    return true;
  } catch (e: unknown) {
    // `pdv_cancel_tab` levanta `tab_not_found_or_closed` quando a comanda já
    // foi fechada/cancelada (ex.: outro caixa) — a comanda já se foi; o gesto
    // segue silencioso e o Desfazer não deve ressuscitar o id morto.
    const message = e instanceof Error ? e.message : String(e ?? "");
    if (message.includes("tab_not_found_or_closed")) return true;
    console.warn("[N2] cancelamento da comanda vazia falhou; comanda preservada", e);
    return false;
  }
}

export async function rpcCloseTab(args: {
  tabId: string; sessionId: string; payments: { method: string; amount: number }[];
  pdvDiscount?: number; commissionRate?: number;
}) {
  const { data, error } = await (supabase as any).rpc("pdv_close_tab", {
    _tab_id: args.tabId,
    _session_id: args.sessionId,
    _payments: args.payments,
    _pdv_discount: args.pdvDiscount ?? 0,
    _commission_rate: args.commissionRate ?? 0,
  });
  if (error) throw error;
  return data as string; // order_id
}

/** Agrega totais/qtd de itens por tab_id para uma lista de tabs abertas. */
export function usePdvTabsTotals(tabIds: string[]) {
  const key = tabIds.slice().sort().join(",");
  const q = useQuery({
    queryKey: ["pdv-tabs-totals", key],
    enabled: tabIds.length > 0,
    staleTime: 4_000,
    refetchInterval: 8_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pdv_tab_items")
        .select("tab_id,quantity,unit_price")
        .in("tab_id", tabIds);
      if (error) throw error;
      const totals = new Map<string, { total: number; count: number }>();
      for (const r of (data ?? []) as { tab_id: string; quantity: number; unit_price: number }[]) {
        const cur = totals.get(r.tab_id) ?? { total: 0, count: 0 };
        cur.total += Number(r.quantity) * Number(r.unit_price);
        cur.count += Number(r.quantity);
        totals.set(r.tab_id, cur);
      }
      return totals;
    },
  });
  return q.data ?? new Map<string, { total: number; count: number }>();
}