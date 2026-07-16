import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  Receipt, Banknote, CreditCard, Smartphone, Loader2,
  Clock, ArrowDownCircle, ArrowUpCircle, ChevronRight,
  ChevronDown, Package, Lock, Unlock, BarChart3,
  Ban, XCircle,
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

interface HistoricoProps { storeId?: string; sessionId?: string; limit?: number }

export const PdvHistorico = ({ storeId, sessionId, limit = 50 }: HistoricoProps) => {
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

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (movements.length === 0) return (
    <div className="text-center py-10 text-muted-foreground">
      <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm font-medium">Nenhuma movimentação</p>
      <p className="text-xs mt-1">Vendas, sangrias e suprimentos aparecem aqui</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {movements.map((m: any) => {
        if (m.type === "sale") {
          const pm = PAYMENT_LABELS[m.payment_method] || { label: m.payment_method || "—", icon: Receipt, color: "text-muted-foreground" };
          const Icon = pm.icon;
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold text-foreground">Venda</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    <Icon className={`h-2.5 w-2.5 ${pm.color}`} />{pm.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />{formatTime(m.created_at)}
                  {m.description && <><span>·</span><span className="truncate">{m.description}</span></>}
                </p>
              </div>
              <p className="text-sm font-black text-emerald-500 shrink-0">{formatBRL(Number(m.amount))}</p>
            </div>
          );
        }
        if (m.type === "sangria") return (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-red-500/20">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0"><ArrowDownCircle className="h-4 w-4 text-red-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Sangria</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />{formatTime(m.created_at)}
                {m.description && <><span>·</span><span className="truncate">{m.description}</span></>}
              </p>
            </div>
            <p className="text-sm font-black text-red-500 shrink-0">−{formatBRL(Number(m.amount))}</p>
          </div>
        );
        return (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-blue-500/20">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><ArrowUpCircle className="h-4 w-4 text-blue-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Suprimento</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />{formatTime(m.created_at)}
                {m.description && <><span>·</span><span className="truncate">{m.description}</span></>}
              </p>
            </div>
            <p className="text-sm font-black text-blue-500 shrink-0">+{formatBRL(Number(m.amount))}</p>
          </div>
        );
      })}
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
