/**
 * FinanceCharts — Gráficos financeiros profissionais
 * Usados tanto pelo StoreFinancePanel (lojista) quanto pelo SuperAdminDashboard
 * Garante linguagem visual consistente entre os dois painéis.
 */

import { useMemo } from "react";
import { formatBRL } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Cores padrão ────────────────────────────────────────────────────────────

export const CHART_COLORS = {
  delivery: "#f97316",      // primary (laranja)
  pdv:      "#3b82f6",      // azul
  profit:   "#10b981",      // verde
  commission:"#f59e0b",     // âmbar
  refund:   "#ef4444",      // vermelho
  neutral:  "#6b7280",      // cinza
};

const DELIVERY_PAYMENTS = ["pix", "dinheiro", "cartao", "card_delivery", "money"];
const PDV_PAYMENTS = ["dinheiro", "maquininha_credito", "maquininha_debito", "maquininha_pix"];

// ─── Tooltip customizado ─────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-3 min-w-[140px]">
      {label && <p className="text-[10px] text-muted-foreground font-semibold mb-1.5">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="text-xs font-black text-foreground">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── 1. Gráfico de evolução diária (delivery + PDV) ──────────────────────────

interface DailyData {
  day: string;        // "01/05"
  delivery: number;
  pdv: number;
  total: number;
  orders_delivery: number;
  orders_pdv: number;
}

interface DailySalesChartProps {
  data: DailyData[];
  showPdv?: boolean;
}

export const DailySalesChart = ({ data, showPdv = true }: DailySalesChartProps) => {
  const hasData = data.some(d => d.total > 0);
  if (!hasData) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-muted-foreground">Sem dados no período</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradDelivery" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.delivery} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.delivery} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPdv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.pdv} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.pdv} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.1)" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
          tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v}`} width={48} />
        <Tooltip content={<CustomTooltip formatter={formatBRL} />} />
        {showPdv && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Area type="monotone" dataKey="delivery" name="Delivery" stroke={CHART_COLORS.delivery}
          strokeWidth={2} fill="url(#gradDelivery)" dot={false} activeDot={{ r: 4 }} />
        {showPdv && (
          <Area type="monotone" dataKey="pdv" name="PDV" stroke={CHART_COLORS.pdv}
            strokeWidth={2} fill="url(#gradPdv)" dot={false} activeDot={{ r: 4 }} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ─── 2. Gráfico de distribuição por método de pagamento ──────────────────────

interface PaymentData {
  name: string;
  value: number;
  color: string;
}

export const PaymentBreakdownChart = ({ data }: { data: PaymentData[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-muted-foreground">Sem dados</p>
    </div>
  );

  return (
    <div className="flex items-center gap-4 h-full">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={52}
            dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip formatter={formatBRL} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[11px] text-muted-foreground flex-1 truncate">{item.name}</span>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-black text-foreground">{formatBRL(item.value)}</p>
              <p className="text-[9px] text-muted-foreground">{total > 0 ? ((item.value/total)*100).toFixed(0) : 0}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── 3. Gráfico de horário de pico ──────────────────────────────────────────

export const HourlyChart = ({ data }: { data: { hour: number; count: number; revenue: number }[] }) => {
  const chartData = Array.from({ length: 24 }, (_, h) => {
    const found = data.find(d => d.hour === h);
    return { hour: `${String(h).padStart(2,"0")}h`, count: found?.count || 0, revenue: found?.revenue || 0 };
  });
  const max = Math.max(...chartData.map(d => d.count), 1);
  const peak = chartData.reduce((a, b) => b.count > a.count ? b : a, chartData[0]);

  return (
    <div className="space-y-2">
      {peak.count > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Pico:</span>
          <span className="text-[11px] font-black text-foreground">{peak.hour}</span>
          <span className="text-[10px] text-muted-foreground">— {peak.count} pedido{peak.count !== 1 ? "s" : ""}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={8}>
          <Bar dataKey="count" radius={[3,3,0,0]}>
            {chartData.map((entry, i) => (
              <Cell key={i}
                fill={entry.hour === peak.hour ? CHART_COLORS.delivery : "rgba(156,163,175,0.3)"}
              />
            ))}
          </Bar>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              if (!d.count) return null;
              return (
                <div className="bg-card border border-border rounded-lg px-2.5 py-1.5 shadow-lg">
                  <p className="text-[11px] font-bold text-foreground">{d.hour}</p>
                  <p className="text-[11px] text-muted-foreground">{d.count} pedido{d.count !== 1 ? "s" : ""}</p>
                  <p className="text-[11px] text-foreground font-semibold">{formatBRL(d.revenue)}</p>
                </div>
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </div>
  );
};

// ─── 4. Comparativo delivery vs PDV (canal por canal) ───────────────────────

interface ChannelCompareData {
  period: string;
  delivery: number;
  pdv: number;
}

export const ChannelCompareChart = ({ data }: { data: ChannelCompareData[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barGap={4}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.1)" />
      <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} width={40} />
      <Tooltip content={<CustomTooltip formatter={formatBRL} />} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <Bar dataKey="delivery" name="Delivery" fill={CHART_COLORS.delivery} radius={[4,4,0,0]} maxBarSize={40} />
      <Bar dataKey="pdv" name="PDV" fill={CHART_COLORS.pdv} radius={[4,4,0,0]} maxBarSize={40} />
    </BarChart>
  </ResponsiveContainer>
);

// ─── 5. KPI Card com tendência ───────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: number;  // positivo = crescimento, negativo = queda
  color?: "primary" | "emerald" | "blue" | "amber" | "red";
  mini?: boolean;
}

export const KpiCard = ({ label, value, sublabel, trend, color = "primary", mini = false }: KpiCardProps) => {
  const colorMap = {
    primary: "text-primary from-primary/5",
    emerald: "text-emerald-500 from-emerald-500/5",
    blue:    "text-blue-500 from-blue-500/5",
    amber:   "text-amber-500 from-amber-500/5",
    red:     "text-red-500 from-red-500/5",
  };
  const [textColor, gradFrom] = colorMap[color].split(" ");

  return (
    <div className={`bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 relative overflow-hidden ${mini ? "p-3" : "p-4"}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradFrom} to-transparent`} />
      <div className="relative">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        <p className={`font-black tracking-tight mt-0.5 ${textColor} ${mini ? "text-xl" : "text-2xl"}`}>{value}</p>
        {(sublabel || trend !== undefined) && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend !== undefined && (
              trend > 0
                ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                : trend < 0
                  ? <TrendingDown className="h-3 w-3 text-red-400" />
                  : <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            {trend !== undefined && (
              <span className={`text-[10px] font-bold ${trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
              </span>
            )}
            {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 6. Resumo de comissão (delivery + PDV) ──────────────────────────────────

interface CommissionSummaryProps {
  deliveryCommission: number;
  pdvCommission: number;
  pdvCommissionPending: number;
  planType: string;
  deliveryRate: number;
  pdvRate: number;
}

export const CommissionSummary = ({
  deliveryCommission, pdvCommission, pdvCommissionPending,
  planType, deliveryRate, pdvRate,
}: CommissionSummaryProps) => {
  const isFixed = planType === "fixed" || planType === "supporter";
  const total = deliveryCommission + pdvCommission;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-foreground flex items-center gap-1.5">
          💰 Comissões a Repassar
        </p>
        <p className="text-lg font-black text-amber-500">{formatBRL(total)}</p>
      </div>

      <div className="space-y-2">
        {/* Delivery */}
        <div className="flex items-center justify-between bg-card/50 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-foreground">Delivery</p>
              <p className="text-[10px] text-muted-foreground">
                {isFixed ? "Taxa PIX R$1,99/transação" : `${deliveryRate}% sobre subtotal`}
              </p>
            </div>
          </div>
          <p className="text-sm font-black text-foreground">{formatBRL(deliveryCommission)}</p>
        </div>

        {/* PDV */}
        <div className="flex items-center justify-between bg-card/50 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-foreground">PDV Presencial</p>
              <p className="text-[10px] text-muted-foreground">
                {pdvRate === 0 ? "Isento" : `${pdvRate}% sobre subtotal`}
                {pdvCommissionPending > 0 && ` · pendente na fatura`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-foreground">{formatBRL(pdvCommission)}</p>
            {pdvCommissionPending > 0 && (
              <p className="text-[10px] text-amber-500 font-bold">{formatBRL(pdvCommissionPending)} fatura</p>
            )}
          </div>
        </div>
      </div>

      {total === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-1">
          ✅ Nenhuma comissão pendente no período
        </p>
      )}
    </div>
  );
};

// ─── 7. Hook de dados unificado ───────────────────────────────────────────────

/**
 * Processa uma lista de pedidos e retorna dados normalizados
 * para todos os gráficos. Usado por StoreFinancePanel e SuperAdminDashboard.
 */
export function useFinanceChartData(orders: any[], pdvMovements?: any[]) {
  return useMemo(() => {
    const deliveryOrders = orders.filter(o => (o.order_source || "delivery") !== "pdv");
    const pdvOrders = orders.filter(o => o.order_source === "pdv");

    // ── Dados diários ──
    const dailyMap: Record<string, DailyData> = {};
    [...deliveryOrders, ...pdvOrders].forEach(o => {
      const d = new Date(o.created_at);
      const key = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!dailyMap[key]) dailyMap[key] = { day: key, delivery: 0, pdv: 0, total: 0, orders_delivery: 0, orders_pdv: 0 };
      const isPdv = o.order_source === "pdv";
      const val = Number(o.total_price || 0);
      if (isPdv) { dailyMap[key].pdv += val; dailyMap[key].orders_pdv += 1; }
      else { dailyMap[key].delivery += val; dailyMap[key].orders_delivery += 1; }
      dailyMap[key].total += val;
    });
    const dailyData = Object.values(dailyMap).sort((a, b) => {
      const [da, ma] = a.day.split("/").map(Number);
      const [db, mb] = b.day.split("/").map(Number);
      return ma !== mb ? ma - mb : da - db;
    });

    // ── Por método de pagamento ──
    const paymentMap: Record<string, number> = {};
    const paymentLabels: Record<string, string> = {
      pix: "PIX Online", dinheiro: "Dinheiro",
      cartao: "Cartão Entrega", card_delivery: "Cartão Entrega",
      money: "Dinheiro",
      maquininha_credito: "Crédito (PDV)", maquininha_debito: "Débito (PDV)",
      maquininha_pix: "PIX Maquininha",
    };
    const paymentColors: Record<string, string> = {
      pix: "#f97316", dinheiro: "#10b981", cartao: "#3b82f6",
      card_delivery: "#3b82f6", money: "#10b981",
      maquininha_credito: "#6366f1", maquininha_debito: "#8b5cf6",
      maquininha_pix: "#f59e0b",
    };
    orders.forEach(o => {
      const m = o.payment_method || "outros";
      paymentMap[m] = (paymentMap[m] || 0) + Number(o.total_price || 0);
    });
    const paymentData: PaymentData[] = Object.entries(paymentMap)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({
        name: paymentLabels[k] || k,
        value: v,
        color: paymentColors[k] || CHART_COLORS.neutral,
      }))
      .sort((a, b) => b.value - a.value);

    // ── Horário de pico (usa pdvMovements se disponível para PDV, orders para delivery) ──
    const hourMap: Record<number, { count: number; revenue: number }> = {};
    const allItems = [...orders, ...(pdvMovements || [])];
    allItems.forEach(o => {
      const h = new Date(o.created_at).getHours();
      if (!hourMap[h]) hourMap[h] = { count: 0, revenue: 0 };
      hourMap[h].count += 1;
      hourMap[h].revenue += Number(o.total_price || o.amount || 0);
    });
    const hourlyData = Object.entries(hourMap).map(([h, v]) => ({
      hour: Number(h), ...v
    }));

    // ── Totais ──
    const totalDelivery = deliveryOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const totalPdv = pdvOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const totalRevenue = totalDelivery + totalPdv;
    const ticketMedio = orders.length > 0 ? totalRevenue / orders.length : 0;
    const avgDelivery = deliveryOrders.length > 0 ? totalDelivery / deliveryOrders.length : 0;
    const avgPdv = pdvOrders.length > 0 ? totalPdv / pdvOrders.length : 0;

    // ── Comissões ──
    const deliveryCommission = deliveryOrders.reduce((s, o) => {
      const saved = Number(o.commission_rate || 0);
      return s + (saved > 0 ? Number(o.subtotal || 0) * saved / 100 : 0);
    }, 0);
    const pdvCommission = pdvOrders.reduce((s, o) => {
      const saved = Number(o.commission_rate || 0);
      return s + (saved > 0 ? Number(o.subtotal || 0) * saved / 100 : 0);
    }, 0);

    // ── Top produtos (PDV) ──
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    pdvOrders.forEach(o => {
      (o.order_items || []).forEach((item: any) => {
        const name = item.products?.name || "Item";
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
        productMap[name].qty += Number(item.quantity || 1);
        productMap[name].revenue += Number(item.unit_price || 0) * Number(item.quantity || 1);
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    return {
      dailyData, paymentData, hourlyData,
      totalRevenue, totalDelivery, totalPdv,
      ticketMedio, avgDelivery, avgPdv,
      deliveryOrders, pdvOrders,
      deliveryCommission, pdvCommission,
      topProducts,
    };
  }, [orders, pdvMovements]);
}
