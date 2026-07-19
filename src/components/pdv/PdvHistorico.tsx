import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  Receipt, Banknote, CreditCard, Smartphone, Loader2,
  Clock, ArrowDownCircle, ArrowUpCircle, ChevronRight,
  ChevronDown, Package, Lock, Unlock, BarChart3,
  Ban, XCircle, Search,
} from "lucide-react";
import { PdvCancelSaleDialog } from "./PdvCancelSaleDialog";

const PAYMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  dinheiro:           { label: "Dinheiro",       icon: Banknote,   color: "text-emerald-500" },
  maquininha_credito: { label: "Crédito",        icon: CreditCard, color: "text-blue-500" },
  maquininha_debito:  { label: "Débito",         icon: CreditCard, color: "text-indigo-500" },
  maquininha_pix:     { label: "PIX Maquininha", icon: Smartphone, color: "text-primary" },
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ─── Histórico de movimentações ──────────────────────────────────────────────

type FilterType = "all" | "sale" | "sangria" | "suprimento" | "canceladas";

interface HistoricoProps {
  storeId?: string;
  sessionId?: string;
  session?: { opened_at?: string; opening_amount?: number | string } | null;
  operatorName?: string | null;
  limit?: number;
  onViewTurnos?: () => void;
}

export const PdvHistorico = ({
  storeId, sessionId, session, operatorName, limit = 100, onViewTurnos,
}: HistoricoProps) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("all");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; total: number } | null>(null);

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["pdv-historico", storeId, sessionId, limit],
    queryFn: async () => {
      let q = (supabase.from("pdv_movements" as any) as any)
        .select("*").order("created_at", { ascending: false }).limit(limit);
      if (sessionId) q = q.eq("session_id", sessionId);
      else if (storeId) q = q.eq("store_id", storeId);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!(storeId || sessionId),
    refetchInterval: 30_000,
  });

  const orderIds = useMemo(
    () => movements.filter((m: any) => m.order_id).map((m: any) => m.order_id),
    [movements]
  );

  const { data: ordersMap = {} } = useQuery<Record<string, any>>({
    queryKey: ["pdv-historico-orders", orderIds.slice().sort().join(",")],
    queryFn: async () => {
      if (!orderIds.length) return {};
      const { data } = await (supabase as any).from("orders")
        .select("id,status,metadata,order_items(quantity,unit_price,products(name))")
        .in("id", orderIds);
      const map: Record<string, any> = {};
      (data || []).forEach((o: any) => { map[o.id] = o; });
      return map;
    },
    enabled: orderIds.length > 0,
  });

  const kpis = useMemo(() => {
    const sales = movements.filter((m: any) => m.type === "sale");
    const total = sales.reduce((s: number, m: any) => s + Number(m.amount), 0);
    const cash = sales.filter((m: any) => m.payment_method === "dinheiro")
      .reduce((s: number, m: any) => s + Number(m.amount), 0);
    const sangria = movements.filter((m: any) => m.type === "sangria")
      .reduce((s: number, m: any) => s + Number(m.amount), 0);
    const suprimento = movements.filter((m: any) => m.type === "suprimento")
      .reduce((s: number, m: any) => s + Number(m.amount), 0);
    return { count: sales.length, total, avg: sales.length ? total / sales.length : 0, cash, sangria, suprimento };
  }, [movements]);

  const openedAt = session?.opened_at ? new Date(session.opened_at) : null;
  const durMin = openedAt ? Math.max(0, Math.round((Date.now() - openedAt.getTime()) / 60000)) : 0;
  const durStr = durMin < 60 ? `${durMin}min` : `${Math.floor(durMin / 60)}h ${durMin % 60}min`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m: any) => {
      if (filter === "sale" && m.type !== "sale") return false;
      if (filter === "sangria" && m.type !== "sangria") return false;
      if (filter === "suprimento" && m.type !== "suprimento") return false;
      if (filter === "canceladas") {
        if (m.type !== "sale") return false;
        const o = ordersMap[m.order_id];
        if (!o || o.status !== "cancelado") return false;
      }
      if (methodFilter && m.type === "sale" && m.payment_method !== methodFilter) return false;
      if (q) {
        const items = (ordersMap[m.order_id]?.order_items || [])
          .map((it: any) => it.products?.name || "").join(" ");
        const hay = [String(m.amount ?? ""), m.description || "", m.payment_method || "", items]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movements, filter, methodFilter, search, ordersMap]);

  const groups = useMemo(() => {
    const g = new Map<string, any[]>();
    filtered.forEach((m: any) => {
      const h = String(new Date(m.created_at).getHours()).padStart(2, "0") + ":00";
      if (!g.has(h)) g.set(h, []);
      g.get(h)!.push(m);
    });
    return Array.from(g.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="p-3 space-y-2">
          {session && (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Unlock className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Turno atual</p>
                <p className="text-sm font-bold text-foreground truncate">
                  {operatorName || "Operador"} · aberto há {durStr}
                </p>
              </div>
              {onViewTurnos && (
                <button onClick={onViewTurnos}
                  className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 px-2 py-1 rounded-lg">
                  Turnos anteriores
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 pb-0.5">
            <Kpi label="Vendas" value={String(kpis.count)} />
            <Kpi label="Total" value={formatBRL(kpis.total)} tone="emerald" />
            <Kpi label="Ticket" value={formatBRL(kpis.avg)} />
            <Kpi label="Dinheiro" value={formatBRL(kpis.cash)} />
            {kpis.sangria > 0 && <Kpi label="Sangria" value={`−${formatBRL(kpis.sangria)}`} tone="red" />}
            {kpis.suprimento > 0 && <Kpi label="Supr." value={`+${formatBRL(kpis.suprimento)}`} tone="blue" />}
          </div>
        </div>

        <div className="px-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item, valor, descrição..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted/40 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {([
              { id: "all", label: "Tudo" },
              { id: "sale", label: "Vendas" },
              { id: "sangria", label: "Sangrias" },
              { id: "suprimento", label: "Suprimentos" },
              { id: "canceladas", label: "Canceladas" },
            ] as { id: FilterType; label: string }[]).map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                  filter === f.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/50 hover:text-foreground"
                }`}>{f.label}</button>
            ))}
            <span className="w-px h-4 bg-border/50 mx-1 shrink-0" />
            {Object.entries(PAYMENT_LABELS).map(([id, pm]) => {
              const active = methodFilter === id;
              const Icon = pm.icon;
              return (
                <button key={id} onClick={() => setMethodFilter(active ? null : id)}
                  className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border inline-flex items-center gap-1 transition-colors ${
                    active
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border/50 hover:text-foreground"
                  }`}>
                  <Icon className={`h-3 w-3 ${pm.color}`} />{pm.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Nenhuma movimentação</p>
            <p className="text-xs mt-1">Vendas, sangrias e suprimentos aparecem aqui</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-xs">Nenhum resultado para os filtros aplicados.</p>
          </div>
        ) : (
          groups.map(([hour, items]) => {
            const hourSales = items.filter((m: any) => m.type === "sale");
            const hourTotal = hourSales.reduce((s: number, m: any) => s + Number(m.amount), 0);
            return (
              <div key={hour} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider tabular-nums">{hour}</span>
                  <span className="h-px flex-1 bg-border/40" />
                  {hourSales.length > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {hourSales.length} venda{hourSales.length !== 1 ? "s" : ""} · {formatBRL(hourTotal)}
                    </span>
                  )}
                </div>
                {items.map((m: any) => (
                  <MovementRow
                    key={m.id}
                    m={m}
                    order={ordersMap[m.order_id]}
                    expanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onCancel={(id: string, total: number) => setCancelTarget({ id, total })}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>

      <PdvCancelSaleDialog
        open={!!cancelTarget}
        orderId={cancelTarget?.id ?? null}
        orderTotal={cancelTarget?.total ?? 0}
        onClose={() => setCancelTarget(null)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ["pdv-historico"] });
          queryClient.invalidateQueries({ queryKey: ["pdv-historico-orders"] });
          queryClient.invalidateQueries({ queryKey: ["pdv-movements"] });
        }}
      />
    </div>
  );
};

// ─── Chip de KPI ────────────────────────────────────────────────────────────

const Kpi = ({
  label, value, tone = "neutral",
}: {
  label: string; value: string; tone?: "neutral" | "emerald" | "red" | "blue";
}) => {
  const cls =
    tone === "emerald" ? "text-emerald-500"
    : tone === "red" ? "text-red-500"
    : tone === "blue" ? "text-blue-500"
    : "text-foreground";
  return (
    <div className="shrink-0 bg-card border border-border/50 rounded-xl px-2.5 py-1.5 min-w-[74px]">
      <p className="text-[9px] text-muted-foreground uppercase font-bold leading-none">{label}</p>
      <p className={`text-xs font-black tabular-nums mt-0.5 ${cls}`}>{value}</p>
    </div>
  );
};

// ─── Linha de movimentação ──────────────────────────────────────────────────

const MovementRow = ({
  m, order, expanded, onToggle, onCancel,
}: {
  m: any; order: any; expanded: boolean; onToggle: () => void;
  onCancel: (id: string, total: number) => void;
}) => {
  const isSale = m.type === "sale";
  const isSangria = m.type === "sangria";
  const canceled = isSale && order?.status === "cancelado";
  const pm = isSale
    ? (PAYMENT_LABELS[m.payment_method] || { label: m.payment_method || "—", icon: Receipt, color: "text-muted-foreground" })
    : null;
  const MethodIcon = pm?.icon;
  const LeftIcon = isSale ? Receipt : isSangria ? ArrowDownCircle : ArrowUpCircle;
  const borderColor = canceled
    ? "border-l-muted-foreground/40"
    : isSale ? "border-l-emerald-500"
    : isSangria ? "border-l-red-500"
    : "border-l-blue-500";
  const iconBg = canceled
    ? "bg-muted/40"
    : isSale ? "bg-emerald-500/10"
    : isSangria ? "bg-red-500/10"
    : "bg-blue-500/10";
  const iconColor = canceled
    ? "text-muted-foreground"
    : isSale ? "text-emerald-500"
    : isSangria ? "text-red-500"
    : "text-blue-500";
  const amountColor = canceled
    ? "text-muted-foreground line-through"
    : isSale ? "text-emerald-500"
    : isSangria ? "text-red-500"
    : "text-blue-500";
  const amountPrefix = isSangria ? "−" : isSale ? "" : "+";

  const itemsPreview = order?.order_items?.length
    ? order.order_items.slice(0, 3)
        .map((it: any) => `${it.quantity}x ${it.products?.name || "Item"}`).join(", ")
      + (order.order_items.length > 3 ? "…" : "")
    : null;

  return (
    <div className={`rounded-xl bg-card border border-border/50 border-l-4 ${borderColor} ${canceled ? "opacity-70" : ""}`}>
      <button
        onClick={isSale ? onToggle : undefined}
        className={`w-full flex items-center gap-3 p-3 text-left ${isSale ? "" : "cursor-default"}`}
      >
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <LeftIcon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-foreground">
              {isSale ? "Venda" : isSangria ? "Sangria" : "Suprimento"}
            </p>
            {canceled && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                <Ban className="h-2.5 w-2.5" />CANCELADA
              </span>
            )}
            {pm && MethodIcon && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                <MethodIcon className={`h-2.5 w-2.5 ${pm.color}`} />{pm.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />{formatTime(m.created_at)}
            {itemsPreview && <><span>·</span><span className="truncate">{itemsPreview}</span></>}
            {!itemsPreview && m.description && <><span>·</span><span className="truncate">{m.description}</span></>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <p className={`text-sm font-black tabular-nums ${amountColor}`}>
            {amountPrefix}{formatBRL(Number(m.amount))}
          </p>
          {isSale && (
            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
          )}
        </div>
      </button>

      {isSale && expanded && (
        <div className="border-t border-border/30 px-3 py-2.5 space-y-2">
          {order?.order_items?.length ? (
            <ul className="space-y-1">
              {order.order_items.map((it: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="font-bold text-muted-foreground w-6 tabular-nums">{it.quantity}x</span>
                  <span className="flex-1 truncate text-foreground">{it.products?.name || "Item"}</span>
                  {it.unit_price != null && (
                    <span className="text-muted-foreground tabular-nums">{formatBRL(Number(it.unit_price) * Number(it.quantity || 1))}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Sem itens registrados nesta venda.</p>
          )}
          {canceled && order?.metadata?.canceled_reason && (
            <p className="text-[10px] text-red-500">
              Motivo: {order.metadata.canceled_reason}
              {order.metadata.canceled_by_operator ? ` · ${order.metadata.canceled_by_operator}` : ""}
            </p>
          )}
          {!canceled && m.order_id && (
            <div className="flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(m.order_id, Number(m.amount)); }}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/15 px-2 py-1 rounded-lg"
              >
                <XCircle className="h-3 w-3" /> Cancelar venda
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Detalhe completo de um turno ────────────────────────────────────────────

const PdvSessionDetail = ({ session, storeId }: { session: any; storeId: string }) => {
  const opening = Number(session.opening_amount || 0);
  const closing = Number(session.closing_amount || 0);
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<{ id: string; total: number } | null>(null);

  const { data: movements = [], isLoading: movL } = useQuery({
    queryKey: ["pdv-session-mov", session.id],
    queryFn: async () => {
      const { data } = await supabase.from("pdv_movements" as any).select("*").eq("session_id", session.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: orders = [], isLoading: ordL } = useQuery({
    queryKey: ["pdv-session-orders", session.id],
    queryFn: async () => {
       const { data } = await (supabase as any).from("orders")
        .select("id, total_price, subtotal, pdv_discount, payment_method, created_at, status, metadata, order_items(quantity, unit_price, products(name))")
        .eq("pdv_session_id" as any, session.id).in("status", ["finalizado", "cancelado"])
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  if (movL || ordL) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;

  const sales = movements.filter((m: any) => m.type === "sale");
  const totalVendido = sales.reduce((s: number, m: any) => s + Number(m.amount), 0);
  const totalSangrias = movements.filter((m: any) => m.type === "sangria").reduce((s: number, m: any) => s + Number(m.amount), 0);
  const totalSuprimentos = movements.filter((m: any) => m.type === "suprimento").reduce((s: number, m: any) => s + Number(m.amount), 0);
  const dinheiro = sales.filter((m: any) => m.payment_method === "dinheiro").reduce((s: number, m: any) => s + Number(m.amount), 0);
  const saldoEsperado = opening + dinheiro + totalSuprimentos - totalSangrias;
  const diff = closing > 0 ? closing - saldoEsperado : null;
  const isOk = diff !== null && Math.abs(diff) < 0.05;

  // Produtos
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach((o: any) => {
    (o.order_items || []).forEach((item: any) => {
      const name = item.products?.name || "Item";
      if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
      productMap[name].qty += Number(item.quantity || 1);
      productMap[name].revenue += Number(item.unit_price || 0) * Number(item.quantity || 1);
    });
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

  // Por método
  const byPayment: Record<string, number> = {};
  sales.forEach((m: any) => { const k = m.payment_method || "outros"; byPayment[k] = (byPayment[k] || 0) + Number(m.amount); });

  return (
    <div className="space-y-4 pt-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Total vendido</p>
          <p className="text-lg font-black text-emerald-500">{formatBRL(totalVendido)}</p>
          <p className="text-[10px] text-muted-foreground">{sales.length} venda{sales.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Ticket médio</p>
          <p className="text-lg font-black text-foreground">{formatBRL(sales.length > 0 ? totalVendido / sales.length : 0)}</p>
        </div>
        {totalSangrias > 0 && (
          <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Sangrias</p>
            <p className="text-lg font-black text-red-500">−{formatBRL(totalSangrias)}</p>
          </div>
        )}
        {totalSuprimentos > 0 && (
          <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Suprimentos</p>
            <p className="text-lg font-black text-blue-500">+{formatBRL(totalSuprimentos)}</p>
          </div>
        )}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo esperado</p>
          <p className="text-lg font-black text-amber-500">{formatBRL(saldoEsperado)}</p>
        </div>
        {closing > 0 && (
          <div className={`rounded-xl p-3 border ${isOk ? "bg-emerald-500/8 border-emerald-500/15" : "bg-amber-500/8 border-amber-500/20"}`}>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Conferência</p>
            <p className={`text-lg font-black ${isOk ? "text-emerald-500" : "text-amber-500"}`}>
              {isOk ? "✅ OK" : diff! > 0 ? `Sobra ${formatBRL(diff!)}` : `Falta ${formatBRL(Math.abs(diff!))}`}
            </p>
          </div>
        )}
      </div>

      {/* Por pagamento */}
      {Object.keys(byPayment).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Por pagamento</p>
          {Object.entries(byPayment).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
            const pm = PAYMENT_LABELS[method] || { label: method, icon: Receipt, color: "text-muted-foreground" };
            const Icon = pm.icon;
            const pct = totalVendido > 0 ? (amount / totalVendido) * 100 : 0;
            return (
              <div key={method}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${pm.color}`} />
                  <span className="text-xs text-foreground flex-1">{pm.label}</span>
                  <span className="text-xs font-black">{formatBRL(amount)}</span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Produtos do turno */}
      {topProducts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Package className="h-3 w-3" /> Produtos vendidos
          </p>
          {topProducts.map((p, i) => (
            <div key={p.name} className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2">
              <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
              <p className="flex-1 text-xs font-semibold text-foreground truncate">{p.name}</p>
              <span className="text-[10px] text-muted-foreground">{p.qty}x</span>
              <span className="text-xs font-black text-foreground">{formatBRL(p.revenue)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vendas individuais */}
      {orders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Vendas</p>
          {orders.map((o: any) => {
            const pm = PAYMENT_LABELS[o.payment_method] || { label: o.payment_method || "—", icon: Receipt, color: "text-muted-foreground" };
            const Icon = pm.icon;
            const itemNames = (o.order_items || []).map((it: any) => `${it.quantity}x ${it.products?.name || "—"}`).join(", ");
            const canceled = o.status === "cancelado";
            return (
              <div key={o.id} className={`bg-card border rounded-xl px-3 py-2.5 ${canceled ? "border-red-500/30 opacity-70" : "border-border/50"}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${pm.color} shrink-0`} />
                  <p className={`flex-1 text-[11px] truncate ${canceled ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>{itemNames || "Sem itens"}</p>
                  <span className="text-[10px] text-muted-foreground">{formatTime(o.created_at)}</span>
                  <p className={`text-xs font-black shrink-0 ${canceled ? "text-muted-foreground line-through" : "text-foreground"}`}>{formatBRL(Number(o.total_price))}</p>
                  {canceled ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded"><Ban className="h-2.5 w-2.5" />CANCELADA</span>
                  ) : (
                    <button onClick={() => setCancelTarget({ id: o.id, total: Number(o.total_price) })}
                      className="p-1 rounded hover:bg-red-500/10 text-red-500" title="Cancelar venda">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {Number(o.pdv_discount) > 0 && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 ml-5">Desconto: −{formatBRL(Number(o.pdv_discount))}</p>
                )}
                {canceled && o.metadata?.canceled_reason && (
                  <p className="text-[10px] text-red-500 mt-1 ml-5">
                    Motivo: {o.metadata.canceled_reason}{o.metadata.canceled_by_operator ? ` · ${o.metadata.canceled_by_operator}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PdvCancelSaleDialog
        open={!!cancelTarget}
        orderId={cancelTarget?.id ?? null}
        orderTotal={cancelTarget?.total ?? 0}
        onClose={() => setCancelTarget(null)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ["pdv-session-orders", session.id] });
          queryClient.invalidateQueries({ queryKey: ["pdv-session-mov", session.id] });
          queryClient.invalidateQueries({ queryKey: ["pdv-historico"] });
          queryClient.invalidateQueries({ queryKey: ["pdv-movements"] });
        }}
      />
    </div>
  );
};

// ─── Lista de turnos com drill-down ──────────────────────────────────────────

export const PdvSessionsList = ({
  storeId,
  limit = 30,
  onViewRelatorio,
}: {
  storeId: string;
  limit?: number;
  onViewRelatorio?: (sessionId: string) => void;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["pdv-sessions-list", storeId, limit],
    queryFn: async () => {
      const { data } = await supabase.from("pdv_sessions" as any).select("*")
        .eq("store_id", storeId).order("opened_at", { ascending: false }).limit(limit);
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (sessions.length === 0) return (
    <div className="text-center py-10 text-muted-foreground">
      <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm font-medium">Nenhum turno ainda</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {sessions.map((s: any) => {
        const isOpen = s.status === "open";
        const isExpanded = expandedId === s.id;
        const opened = formatDateTime(s.opened_at);
        const closed = s.closed_at ? formatDateTime(s.closed_at) : null;
        const durMin = Math.round((new Date(s.closed_at || Date.now()).getTime() - new Date(s.opened_at).getTime()) / 60000);
        const durStr = durMin < 60 ? `${durMin}min` : `${Math.floor(durMin / 60)}h${durMin % 60 > 0 ? `${durMin % 60}min` : ""}`;

        return (
          <div key={s.id} className={`rounded-2xl border transition-colors ${isExpanded ? "border-primary/30" : "border-border/50 bg-card"}`}>
            <div className="flex items-center">
              <button className="flex-1 text-left p-3.5 flex items-center gap-3" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? "bg-emerald-500/10" : "bg-muted/40"}`}>
                {isOpen ? <Unlock className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{opened}</p>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isOpen ? "bg-emerald-500/10 text-emerald-600" : "bg-muted/60 text-muted-foreground"}`}>
                    {isOpen ? "● Aberto" : "Fechado"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Abertura: {formatBRL(Number(s.opening_amount || 0))} · {durStr}
                  {closed && ` · Fechado: ${closed}`}
                </p>
              </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
              {onViewRelatorio && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewRelatorio(s.id); }}
                  className="p-3.5 text-primary hover:bg-primary/5 rounded-r-2xl transition-colors shrink-0 flex flex-col items-center gap-0.5"
                  title="Ver relatório deste turno"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-[9px] font-bold">Relatório</span>
                </button>
              )}
            </div>
            {isExpanded && (
              <div className="px-3.5 pb-4 border-t border-border/30">
                <PdvSessionDetail session={s} storeId={storeId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
