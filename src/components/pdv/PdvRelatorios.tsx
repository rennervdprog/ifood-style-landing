import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, ShoppingBag, BarChart3, Clock,
  Banknote, CreditCard, Smartphone, Loader2,
  Trophy, ChevronDown, ChevronUp,
  ArrowUpRight, Percent, Receipt, Download, Users, Printer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import PdvRelatorioPrint from "@/components/pdv/PdvRelatorioPrint";
import type { PdvPrintStats, PdvPrintOperator } from "@/components/pdv/PdvRelatorioPrint";

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

const PAYMENT_COLORS: Record<string, string> = {
  dinheiro: "#10b981",
  maquininha_credito: "#3b82f6",
  maquininha_debito: "#6366f1",
  maquininha_pix: "#f97316",
};
const PAYMENT_FALLBACK_COLORS = ["#6b7280", "#a855f7", "#ec4899", "#14b8a6", "#eab308"];

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

/** Badge de variação % vs período anterior (verde = alta, vermelho = queda). */
function VariationBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${
        up
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-500"
      }`}
      title={`Período anterior: ${previous.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface ChartTooltipEntry {
  name: string;
  value: number | string;
  color?: string;
  payload?: { fill?: string };
}

/** Tooltip padronizado dos gráficos do relatório. */
function PdvChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-xl px-3 py-2 min-w-[130px]">
      {label !== undefined && label !== "" && (
        <p className="text-[10px] text-muted-foreground font-semibold mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color ?? entry.payload?.fill ?? "#3b82f6" }}
            />
            {entry.name}
          </span>
          <span className="text-[11px] font-black tabular-nums text-foreground">
            {formatter ? formatter(Number(entry.value)) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

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

  // Período anterior com a mesma duração (para comparativo). Sem sentido no drill-down de turno.
  const prevRange = useMemo(() => {
    const startMs = new Date(dateRange.start).getTime();
    const endMs = new Date(dateRange.end).getTime();
    const dur = Math.max(endMs - startMs, 1);
    return {
      start: new Date(startMs - dur).toISOString(),
      end: new Date(startMs - 1).toISOString(),
    };
  }, [dateRange]);

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

  // ── Período anterior (comparativo dos KPIs) ──
  const { data: prevData } = useQuery({
    queryKey: ["pdv-relatorio-prev", storeId, prevRange.start, prevRange.end],
    queryFn: async () => {
      const { data } = await (supabase.from("pdv_movements" as any) as any)
        .select("amount")
        .eq("store_id", storeId)
        .eq("type", "sale")
        .gte("created_at", prevRange.start)
        .lte("created_at", prevRange.end);
      const rows = (data || []) as { amount: number | string | null }[];
      const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      return { total, count: rows.length, avg: rows.length > 0 ? total / rows.length : 0 };
    },
    enabled: !!storeId && !sessionId,
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

    return {
      totalSales, totalSubtotal, totalDiscount, totalCommission,
      avgTicket, discountRate, count,
      byPayment, topProducts: productsWithABC,
      byHour,
      peakHour: peakHour ? { hour: Number(peakHour[0]), count: Number(peakHour[1]) } : null,
    };
  }, [orders, movements]);

  // ── Faturamento por dia (gráfico) ──
  const dailyRevenue = useMemo(() => {
    if (!stats) return [];
    const rows = (movements.length > 0 ? movements : orders) as any[];
    const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end); end.setHours(0, 0, 0, 0);
    const days: { label: string; total: number }[] = [];
    const index = new Map<string, number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      index.set(key, days.length);
      days.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        total: 0,
      });
    }
    rows.forEach((r: any) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const i = index.get(key);
      if (i !== undefined) days[i].total += Number(r.amount ?? r.total_price ?? 0);
    });
    return days;
  }, [stats, movements, orders, dateRange]);

  const periodLabels: Record<Period, string> = {
    today: "Hoje",
    week: "Últimos 7 dias",
    month: "Este mês",
    custom: "Personalizado",
  };

  const dateRangeLabel = useMemo(() =>
    `${new Date(dateRange.start).toLocaleDateString("pt-BR")} – ${new Date(dateRange.end).toLocaleDateString("pt-BR")}`,
    [dateRange]
  );

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

  /** Exportar PDF: limpa resíduo do cupom térmico e imprime a visão A4 do relatório. */
  const handlePrintPdf = () => {
    document.getElementById("thermal-print-container")?.replaceChildren();
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Dados derivados para os gráficos (só quando há stats)
  const paymentData = stats
    ? Object.entries(stats.byPayment)
        .sort((a, b) => b[1] - a[1])
        .map(([method, value], i) => ({
          name: PAYMENT_LABELS[method]?.label || method,
          value,
          color: PAYMENT_COLORS[method] || PAYMENT_FALLBACK_COLORS[i % PAYMENT_FALLBACK_COLORS.length],
        }))
    : [];
  const hourData = stats
    ? Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, "0")}h`,
        vendas: stats.byHour[h] || 0,
      }))
    : [];

  const printStats: PdvPrintStats | null = stats
    ? {
        totalSales: stats.totalSales,
        totalDiscount: stats.totalDiscount,
        totalCommission: stats.totalCommission,
        avgTicket: stats.avgTicket,
        count: stats.count,
        byPayment: stats.byPayment,
        topProducts: stats.topProducts,
        peakHour: stats.peakHour,
      }
    : null;
  const printOperators: PdvPrintOperator[] = operatorStats.map((o) => ({
    user_id: o.user_id,
    name: o.name,
    count: o.count,
    total: o.total,
  }));

  return (
    <>
      <div className="p-3 space-y-4 pb-6">
        {/* Seletor de período */}
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            {(["today", "week", "month", "custom"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${period === p ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"}`}>
                {periodLabels[p]}
              </button>
            ))}
            {stats && (
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={handlePrintPdf}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1"
                  title="Exportar PDF (imprimir)"
                >
                  <Printer className="h-3 w-3" /> PDF
                </button>
                <button
                  onClick={exportCsv}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                  title="Exportar CSV"
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
              </div>
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
            {/* ── Resumo geral (com comparativo) ── */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card border border-border rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Faturamento</p>
                  {!sessionId && (
                    <span className="ml-auto">
                      <VariationBadge current={stats.totalSales} previous={prevData?.total ?? 0} />
                    </span>
                  )}
                </div>
                <p className="text-xl font-black tabular-nums text-primary">{formatBRL(stats.totalSales)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  {stats.count} venda{stats.count !== 1 ? "s" : ""}
                  {!sessionId && (
                    <VariationBadge current={stats.count} previous={prevData?.count ?? 0} />
                  )}
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Receipt className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ticket Médio</p>
                  {!sessionId && (
                    <span className="ml-auto">
                      <VariationBadge current={stats.avgTicket} previous={prevData?.avg ?? 0} />
                    </span>
                  )}
                </div>
                <p className="text-xl font-black tabular-nums text-blue-500">{formatBRL(stats.avgTicket)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">por venda</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Percent className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Descontos</p>
                </div>
                <p className="text-xl font-black tabular-nums text-amber-500">{formatBRL(stats.totalDiscount)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stats.discountRate.toFixed(1)}% do total</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Comissão</p>
                </div>
                <p className="text-xl font-black tabular-nums text-emerald-500">{formatBRL(stats.totalCommission)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">plataforma</p>
              </div>
            </div>

            {/* ── Faturamento por dia ── */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black">Faturamento por Dia</h3>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyRevenue} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                    />
                    <Tooltip
                      content={<PdvChartTooltip formatter={(v) => formatBRL(v)} />}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                    />
                    <Bar dataKey="total" name="Faturamento" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Por forma de pagamento ── */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black">Formas de Pagamento</h3>
              </div>
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {paymentData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PdvChartTooltip formatter={(v) => formatBRL(v)} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Total</p>
                  <p className="text-base font-black tabular-nums">{formatBRL(stats.totalSales)}</p>
                </div>
              </div>
              <div className="space-y-2.5 mt-2">
                {paymentData.map((entry) => {
                  const pct = stats.totalSales > 0 ? (entry.value / stats.totalSales) * 100 : 0;
                  const methodKey = Object.keys(PAYMENT_LABELS).find(
                    (k) => PAYMENT_LABELS[k].label === entry.name
                  );
                  const pm = methodKey ? PAYMENT_LABELS[methodKey] : null;
                  const Icon = pm?.icon || Receipt;
                  return (
                    <div key={entry.name}>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${entry.color}1a`, color: entry.color }}
                        >
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-semibold text-foreground flex-1">{entry.name}</span>
                        <span className="text-xs font-black tabular-nums text-foreground">{formatBRL(entry.value)}</span>
                        <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden ml-8">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: entry.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Horário de pico ── */}
            {stats.peakHour && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-black">Horário de Pico</h3>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full ml-auto tabular-nums">
                    {String(stats.peakHour.hour).padStart(2, "0")}:00 — {stats.peakHour.count} vendas
                  </span>
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                        interval={5}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip
                        content={<PdvChartTooltip />}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                      />
                      <Bar dataKey="vendas" name="Vendas" radius={[3, 3, 0, 0]}>
                        {hourData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.hour === `${String(stats.peakHour!.hour).padStart(2, "0")}h` ? "#f97316" : "#f9731655"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
            )}

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
                        <span className="text-[10px] font-black text-muted-foreground w-4 tabular-nums">{i + 1}</span>
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
                          <p className="text-xs font-black tabular-nums text-foreground">{formatBRL(p.revenue)}</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">{p.qty}x</p>
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
                        <span className="text-[10px] font-black text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-xs font-semibold text-foreground truncate">{o.name}</p>
                            <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{o.count} vendas</span>
                          </div>
                          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black tabular-nums text-foreground">{formatBRL(o.total)}</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">{share.toFixed(0)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Visão de impressão (PDF/A4) — portal no body, visível só na impressão */}
      {printStats && typeof document !== "undefined" && createPortal(
        <div className="pdv-report-print-zone">
          <PdvRelatorioPrint
            storeId={storeId}
            periodLabel={sessionId ? "Relatório do turno" : periodLabels[period]}
            dateRangeLabel={dateRangeLabel}
            stats={printStats}
            operators={printOperators}
          />
        </div>,
        document.body
      )}
    </>
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
