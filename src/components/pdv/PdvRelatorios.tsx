import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  TrendingUp, ShoppingBag, BarChart3, Clock,
  Banknote, CreditCard, Smartphone, Loader2,
  Trophy, ChevronDown, ChevronUp, Calendar,
  ArrowUpRight, Percent, Receipt, Download, Users,
} from "lucide-react";

// ─── tipos ────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "custom";

interface Props {
  storeId: string;
  sessionId?: string; // se passado, filtra por turno específico
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  dinheiro:           { label: "Dinheiro",       icon: Banknote,   color: "text-emerald-500 bg-emerald-500/10" },
  maquininha_credito: { label: "Crédito",        icon: CreditCard, color: "text-blue-500 bg-blue-500/10" },
  maquininha_debito:  { label: "Débito",         icon: CreditCard, color: "text-indigo-500 bg-indigo-500/10" },
  maquininha_pix:     { label: "PIX Maquininha", icon: Smartphone, color: "text-primary bg-primary/10" },
};

const getDateRange = (period: Period, custom?: { start: string; end: string }) => {
  const now = new Date();
  // Converte limites do dia LOCAL para ISO em UTC (evita cortar vendas por diferença de fuso).
  const startOfLocalDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  const endOfLocalDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  const parseLocalDate = (s: string) => {
    const [y, m, day] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, day || 1);
  };

  if (period === "today") {
    return { start: startOfLocalDay(now), end: endOfLocalDay(now) };
  }
  if (period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { start: startOfLocalDay(d), end: endOfLocalDay(now) };
  }
  if (period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfLocalDay(d), end: endOfLocalDay(now) };
  }
  if (period === "custom" && custom && custom.start && custom.end) {
    return {
      start: startOfLocalDay(parseLocalDate(custom.start)),
      end: endOfLocalDay(parseLocalDate(custom.end)),
    };
  }
  return { start: startOfLocalDay(now), end: endOfLocalDay(now) };
};

// ─── componente principal ──────────────────────────────────────────────────────

export const PdvRelatorios = ({ storeId, sessionId }: Props) => {
  const [period, setPeriod] = useState<Period>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandProducts, setExpandProducts] = useState(false);

  const dateRange = useMemo(() =>
    getDateRange(period, period === "custom" ? { start: customStart, end: customEnd } : undefined),
    [period, customStart, customEnd]
  );

  // ── Produtividade por operador ──
  const { data: operatorStats = [] } = useQuery({
    queryKey: ["pdv-relatorio-operators", storeId, sessionId, dateRange.start, dateRange.end],
    queryFn: async () => {
      let q = (supabase.from("pdv_movements" as any) as any)
        .select("amount, created_by, operator_id")
        .eq("store_id", storeId)
        .eq("type", "sale")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data } = await q;
      const rows = (data || []) as any[];
      const map: Record<string, { key: string; operator_id: string | null; user_id: string | null; total: number; count: number }> = {};
      rows.forEach((m) => {
        const key = m.operator_id || m.created_by || "sem-operador";
        if (!map[key]) map[key] = {
          key,
          operator_id: m.operator_id || null,
          user_id: m.operator_id ? null : (m.created_by || null),
          total: 0, count: 0,
        };
        map[key].total += Number(m.amount || 0);
        map[key].count += 1;
      });
      const opIds = Object.values(map).map((o) => o.operator_id).filter(Boolean) as string[];
      const userIds = Object.values(map).map((o) => o.user_id).filter(Boolean) as string[];
      const names: Record<string, string> = {};
      if (opIds.length) {
        const { data: ops } = await (supabase as any)
          .from("pdv_operators").select("id, name").in("id", opIds);
        (ops || []).forEach((p: any) => { names[p.id] = p.name || "Operador"; });
      }
      if (userIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, name, email").in("id", userIds);
        (profs || []).forEach((p: any) => { names[p.id] = p.name || p.email || "Operador"; });
      }
      return Object.values(map)
        .map((o) => ({
          user_id: o.key,
          total: o.total,
          count: o.count,
          name: names[o.operator_id || o.user_id || ""] || "Sem operador",
        }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: !!storeId,
  });

  // ── Pedidos PDV do período ──
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["pdv-relatorio-orders", storeId, sessionId, dateRange.start, dateRange.end],
    queryFn: async () => {
       let q = (supabase as any)
        .from("orders")
        .select("id, subtotal, total_price, pdv_discount, payment_method, created_at, commission_rate, pdv_session_id, order_items(quantity, unit_price, products(name))")
        .eq("store_id", storeId)
        .eq("order_source" as any, "pdv")
        .eq("status", "finalizado")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .order("created_at", { ascending: false });

      if (sessionId) q = q.eq("pdv_session_id" as any, sessionId);

      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });

  // ── Movimentações PDV do período (fonte confiável para totais) ──
  const { data: movements = [] } = useQuery({
    queryKey: ["pdv-relatorio-movements", storeId, sessionId, dateRange.start, dateRange.end],
    queryFn: async () => {
      let q = (supabase.from("pdv_movements" as any) as any)
        .select("*")
        .eq("store_id", storeId)
        .eq("type", "sale")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .order("created_at", { ascending: false });
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!storeId,
  });

  // ── Cálculos principais ──
  const stats = useMemo(() => {
    // Usa movements como fonte primária (mais confiável) e orders para detalhes de produto
    const hasMov = movements.length > 0;
    const hasOrders = orders.length > 0;
    if (!hasMov && !hasOrders) return null;

    // Totais financeiros — de movements (mais confiável, não depende de order_items RLS)
    const totalSales = hasMov
      ? movements.reduce((s: number, m: any) => s + Number(m.amount || 0), 0)
      : orders.reduce((s, o) => s + Number(o.total_price || 0), 0);

    const count = hasMov ? movements.length : orders.length;

    const totalSubtotal = orders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const totalDiscount = orders.reduce((s, o) => s + Number(o.pdv_discount || 0), 0);
    const totalCommission = orders.reduce((s, o) =>
      s + (Number(o.subtotal || 0) * (Number(o.commission_rate || 0) / 100)), 0
    );
    const avgTicket = count > 0 ? totalSales / count : 0;
    const discountRate = totalSubtotal > 0 ? (totalDiscount / totalSubtotal) * 100 : 0;

    // Por método de pagamento — de movements (mais confiável)
    const byPayment: Record<string, number> = {};
    if (hasMov) {
      movements.forEach((m: any) => {
        const k = m.payment_method || "outros";
        byPayment[k] = (byPayment[k] || 0) + Number(m.amount || 0);
      });
    } else {
      orders.forEach(o => {
        const k = o.payment_method || "outros";
        byPayment[k] = (byPayment[k] || 0) + Number(o.total_price || 0);
      });
    }

    // Produtos mais vendidos
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    orders.forEach(o => {
      (o.order_items || []).forEach((item: any) => {
        const name = item.products?.name || "Item";
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
        productMap[name].qty += Number(item.quantity || 1);
        productMap[name].revenue += Number(item.unit_price || 0) * Number(item.quantity || 1);
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue);

    // Curva ABC — A = top 80% da receita
    let cumRevenue = 0;
    const totalRevenue = topProducts.reduce((s, p) => s + p.revenue, 0);
    const productsWithABC = topProducts.map(p => {
      cumRevenue += p.revenue;
      const pct = totalRevenue > 0 ? cumRevenue / totalRevenue : 0;
      return { ...p, abc: pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C" };
    });

    // Vendas por hora — de movements
    const byHour: Record<number, number> = {};
    (hasMov ? movements : orders).forEach((o: any) => {
      const h = new Date(o.created_at).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const peakHour = Object.entries(byHour).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Vendas por dia da semana
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const byDay: Record<number, number> = {};
    (hasMov ? movements : orders).forEach((o: any) => {
      const d = new Date(o.created_at).getDay();
      byDay[d] = (byDay[d] || 0) + 1;
    });

    return {
      totalSales, totalSubtotal, totalDiscount, totalCommission,
      avgTicket, discountRate, count,
      byPayment, topProducts: productsWithABC,
      byHour, byDay, dayNames,
      peakHour: peakHour ? { hour: Number(peakHour[0]), count: Number(peakHour[1]) } : null,
    };
  }, [orders, movements]);

  const periodLabels: Record<Period, string> = {
    today: "Hoje",
    week: "Últimos 7 dias",
    month: "Este mês",
    custom: "Personalizado",
  };

  const exportCsv = () => {
    if (!stats) return;
    const lines: string[] = [];
    lines.push(`Relatório PDV;${periodLabels[period]}`);
    lines.push(`Período;${new Date(dateRange.start).toLocaleString("pt-BR")};${new Date(dateRange.end).toLocaleString("pt-BR")}`);
    lines.push("");
    lines.push("RESUMO");
    lines.push(`Faturamento;${stats.totalSales.toFixed(2)}`);
    lines.push(`Vendas;${stats.count}`);
    lines.push(`Ticket médio;${stats.avgTicket.toFixed(2)}`);
    lines.push(`Descontos;${stats.totalDiscount.toFixed(2)}`);
    lines.push(`Comissão plataforma;${stats.totalCommission.toFixed(2)}`);
    lines.push("");
    lines.push("PAGAMENTOS");
    lines.push("Método;Valor");
    Object.entries(stats.byPayment).forEach(([k, v]) => {
      lines.push(`${(PAYMENT_LABELS[k]?.label || k)};${v.toFixed(2)}`);
    });
    lines.push("");
    lines.push("PRODUTOS (Curva ABC)");
    lines.push("Ranking;Produto;Qtd;Receita;Classe");
    stats.topProducts.forEach((p, i) => {
      lines.push(`${i + 1};${p.name.replace(/;/g, ",")};${p.qty};${p.revenue.toFixed(2)};${p.abc}`);
    });
    if (operatorStats.length) {
      lines.push("");
      lines.push("OPERADORES");
      lines.push("Ranking;Operador;Vendas;Faturamento");
      operatorStats.forEach((o, i) => {
        lines.push(`${i + 1};${o.name.replace(/;/g, ",")};${o.count};${o.total.toFixed(2)}`);
      });
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdv-relatorio-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      {/* Seletor de período */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {(["today", "week", "month", "custom"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${period === p ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"}`}>
              {periodLabels[p]}
            </button>
          ))}
          {stats && (
            <button
              onClick={exportCsv}
              className="ml-auto px-3 py-1.5 rounded-full text-[11px] font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
              title="Exportar CSV"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          )}
        </div>
        {period === "custom" && (
          <div className="flex gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="flex-1 px-3 py-2 bg-muted/40 rounded-xl text-xs border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 px-3 py-2 bg-muted/40 rounded-xl text-xs border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}
      </div>

      {!stats ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">Nenhuma venda no período</p>
          <p className="text-xs mt-1">Faça vendas no PDV para ver os relatórios</p>
        </div>
      ) : (
        <>
          {/* ── Resumo geral ── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Faturamento</p>
              </div>
              <p className="text-xl font-black text-primary">{formatBRL(stats.totalSales)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats.count} venda{stats.count !== 1 ? "s" : ""}</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Receipt className="h-3.5 w-3.5 text-blue-500" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ticket Médio</p>
              </div>
              <p className="text-xl font-black text-blue-500">{formatBRL(stats.avgTicket)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">por venda</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Descontos</p>
              </div>
              <p className="text-xl font-black text-amber-500">{formatBRL(stats.totalDiscount)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats.discountRate.toFixed(1)}% do total</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Comissão</p>
              </div>
              <p className="text-xl font-black text-emerald-500">{formatBRL(stats.totalCommission)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">plataforma</p>
            </div>
          </div>

          {/* ── Horário de pico ── */}
          {stats.peakHour && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black">Horário de Pico</h3>
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full ml-auto">
                  {String(stats.peakHour.hour).padStart(2, "0")}:00 — {stats.peakHour.count} vendas
                </span>
              </div>
              {/* Gráfico de barras por hora */}
              <div className="flex items-end gap-0.5 h-14">
                {Array.from({ length: 24 }, (_, h) => {
                  const count = stats.byHour[h] || 0;
                  const max = Math.max(...Object.values(stats.byHour), 1);
                  const pct = (count / max) * 100;
                  const isPeak = h === stats.peakHour?.hour;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}h: ${count} vendas`}>
                      <div
                        className={`w-full rounded-sm transition-all ${isPeak ? "bg-primary" : count > 0 ? "bg-primary/40" : "bg-muted/30"}`}
                        style={{ height: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">00h</span>
                <span className="text-[9px] text-muted-foreground">06h</span>
                <span className="text-[9px] text-muted-foreground">12h</span>
                <span className="text-[9px] text-muted-foreground">18h</span>
                <span className="text-[9px] text-muted-foreground">23h</span>
              </div>
            </div>
          )}

          {/* ── Por forma de pagamento ── */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-black">Formas de Pagamento</h3>
            </div>
            <div className="space-y-2.5">
              {Object.entries(stats.byPayment)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => {
                  const pm = PAYMENT_LABELS[method] || { label: method, icon: Receipt, color: "text-muted-foreground bg-muted/50" };
                  const Icon = pm.icon;
                  const pct = stats.totalSales > 0 ? (amount / stats.totalSales) * 100 : 0;
                  return (
                    <div key={method}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${pm.color}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-semibold text-foreground flex-1">{pm.label}</span>
                        <span className="text-xs font-black text-foreground">{formatBRL(amount)}</span>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden ml-8">
                        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ── Produtos mais vendidos (Curva ABC) ── */}
          {stats.topProducts.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-black">Ranking de Produtos</h3>
                <span className="text-[10px] text-muted-foreground ml-auto">Curva ABC</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">
                <span className="text-emerald-600 font-bold">A</span> = 80% da receita ·{" "}
                <span className="text-amber-500 font-bold">B</span> = 15% ·{" "}
                <span className="text-red-400 font-bold">C</span> = 5%
              </p>

              <div className="space-y-2">
                {(expandProducts ? stats.topProducts : stats.topProducts.slice(0, 5)).map((p, i) => {
                  const abcColors: Record<string, string> = {
                    A: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                    B: "bg-amber-500/15 text-amber-600 border-amber-500/30",
                    C: "bg-red-400/15 text-red-500 border-red-400/30",
                  };
                  const maxRevenue = stats.topProducts[0]?.revenue || 1;
                  const pct = (p.revenue / maxRevenue) * 100;

                  return (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                          <span className={`text-[9px] font-black px-1 py-0.5 rounded border ${abcColors[p.abc]}`}>{p.abc}</span>
                        </div>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-foreground">{formatBRL(p.revenue)}</p>
                        <p className="text-[10px] text-muted-foreground">{p.qty}x</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stats.topProducts.length > 5 && (
                <button
                  onClick={() => setExpandProducts(!expandProducts)}
                  className="w-full mt-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  {expandProducts ? <><ChevronUp className="h-3 w-3" /> Mostrar menos</> : <><ChevronDown className="h-3 w-3" /> Ver todos ({stats.topProducts.length})</>}
                </button>
              )}
            </div>
          )}

          {/* ── Produtividade por operador ── */}
          {operatorStats.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black">Produtividade por Operador</h3>
              </div>
              <div className="space-y-2">
                {operatorStats.map((o, i) => {
                  const max = operatorStats[0]?.total || 1;
                  const pct = (o.total / max) * 100;
                  const share = stats.totalSales > 0 ? (o.total / stats.totalSales) * 100 : 0;
                  return (
                    <div key={o.user_id} className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-semibold text-foreground truncate">{o.name}</p>
                          <span className="text-[9px] font-bold text-muted-foreground">{o.count} vendas</span>
                        </div>
                        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-foreground">{formatBRL(o.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{share.toFixed(0)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Dias da semana ── */}
          {Object.keys(stats.byDay).length > 1 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black">Vendas por Dia</h3>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[0,1,2,3,4,5,6].map(d => {
                  const count = stats.byDay[d] || 0;
                  const max = Math.max(...Object.values(stats.byDay), 1);
                  const pct = (count / max) * 100;
                  const isToday = new Date().getDay() === d;
                  return (
                    <div key={d} className="flex flex-col items-center gap-1">
                      <div className="w-full h-12 flex items-end">
                        <div
                          className={`w-full rounded-md transition-all ${count > 0 ? (isToday ? "bg-primary" : "bg-primary/40") : "bg-muted/20"}`}
                          style={{ height: `${Math.max(pct, count > 0 ? 15 : 0)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {stats.dayNames[d]}
                      </span>
                      {count > 0 && <span className="text-[9px] text-muted-foreground">{count}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Relatório de um turno específico ────────────────────────────────────────

export const PdvTurnoRelatorio = ({ sessionId, storeId }: { sessionId: string; storeId: string }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-2">
      Relatório deste turno
    </p>
    <PdvRelatorios storeId={storeId} sessionId={sessionId} />
  </div>
);
