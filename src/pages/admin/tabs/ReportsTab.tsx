import { useState, useMemo } from "react";
import { Calendar, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { formatBRL, formatCurrency, sumMoney, averageMoney } from "@/lib/utils";
import { parseDashboardDate, toLocalDateKey, getPeriodDateKeys, formatDateKeyPtBR } from "../helpers";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { toast } from "sonner";

interface ReportsTabProps {
  allOrders: any[];
  store: any;
}

const ReportsTab = ({ allOrders, store }: ReportsTabProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const periods = [7, 14, 30, 90];

  const reportData = useMemo(() => {
    const parsedOrders = (allOrders || []).flatMap((o: any) => {
      const parsed = parseDashboardDate(o.created_at);
      if (!parsed) return [];
      return [{ ...o, __reportCreatedAt: parsed, __reportDateKey: toLocalDateKey(parsed) }];
    });

    const periodDayKeys = getPeriodDateKeys(selectedPeriod);
    const periodDaySet = new Set(periodDayKeys);

    const periodOrders = parsedOrders.filter(o => periodDaySet.has(o.__reportDateKey) && o.status !== "cancelado" && o.status !== "aguardando_pagamento");
    const completedOrders = periodOrders.filter(o => ["entregue", "finalizado"].includes(o.status));

    const totalRevenue = sumMoney(completedOrders.map(o => o.total_price));
    const totalOrders = completedOrders.length;

    const dailyChart = periodDayKeys.map(date => {
      const dayOrders = completedOrders.filter(o => o.__reportDateKey === date);
      const [, m, d] = date.split("-");
      return { day: `${d}/${m}`, vendas: Math.round(sumMoney(dayOrders.map(o => o.total_price)) * 100) / 100 };
    });

    return { totalRevenue, totalOrders, dailyChart };
  }, [allOrders, selectedPeriod]);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {periods.map(p => (
          <button key={p} onClick={() => setSelectedPeriod(p)}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${selectedPeriod === p ? "bg-primary text-white" : "bg-card border"}`}>
            {p}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card p-4 rounded-2xl border border-border">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-black text-emerald-500">{formatCurrency(reportData.totalRevenue)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Pedidos Concluídos</p>
          <p className="text-2xl font-black text-blue-500">{reportData.totalOrders}</p>
        </div>
      </div>

      <div className="bg-card p-5 rounded-2xl border border-border h-64">
        <p className="text-xs font-bold mb-4">📈 Evolução de Vendas</p>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={reportData.dailyChart}>
            <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <RechartsTooltip />
            <Area type="monotone" dataKey="vendas" stroke="#10b981" fill="#10b98120" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <button className="w-full bg-primary text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
        onClick={() => toast.success("Exportação iniciada...")}>
        <Download className="h-4 w-4" /> Exportar Relatório CSV
      </button>
    </div>
  );
};

export default ReportsTab;