/**
 * FinanceChartsCore — Parte LEVE de FinanceCharts (sem recharts).
 *
 * Contém: hook de dados, paleta de cores, KpiCard e CommissionSummary.
 * Permite que páginas que só usam KPIs (ou que querem lazy-load dos gráficos)
 * importem aqui sem puxar o chunk recharts (~150 KB gzipped) no boot.
 */

import { useMemo } from "react";
import { formatBRL } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Cores padrão ────────────────────────────────────────────────────────────

export const CHART_COLORS = {
  delivery: "#f97316",
  pdv:      "#3b82f6",
  profit:   "#10b981",
  commission:"#f59e0b",
  refund:   "#ef4444",
  neutral:  "#6b7280",
};

// ─── Tipos compartilhados ────────────────────────────────────────────────────

export interface DailyData {
  day: string;
  delivery: number;
  pdv: number;
  total: number;
  orders_delivery: number;
  orders_pdv: number;
}

export interface PaymentData {
  name: string;
  value: number;
  color: string;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: number;
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

// ─── Commission Summary ──────────────────────────────────────────────────────

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

// ─── Hook de dados unificado ─────────────────────────────────────────────────

export function useFinanceChartData(orders: any[], pdvMovements?: any[]) {
  return useMemo(() => {
    const deliveryOrders = orders.filter(o => (o.order_source || "delivery") !== "pdv");
    const pdvOrders = orders.filter(o => o.order_source === "pdv");

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

    const totalDelivery = deliveryOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const totalPdv = pdvOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
    const totalRevenue = totalDelivery + totalPdv;
    const ticketMedio = orders.length > 0 ? totalRevenue / orders.length : 0;
    const avgDelivery = deliveryOrders.length > 0 ? totalDelivery / deliveryOrders.length : 0;
    const avgPdv = pdvOrders.length > 0 ? totalPdv / pdvOrders.length : 0;

    const deliveryCommission = deliveryOrders.reduce((s, o) => {
      const saved = Number(o.commission_rate || 0);
      return s + (saved > 0 ? Number(o.subtotal || 0) * saved / 100 : 0);
    }, 0);
    const pdvCommission = pdvOrders.reduce((s, o) => {
      const saved = Number(o.commission_rate || 0);
      return s + (saved > 0 ? Number(o.subtotal || 0) * saved / 100 : 0);
    }, 0);

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