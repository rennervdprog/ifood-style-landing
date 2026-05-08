import { useState, useMemo } from "react";
import { 
  ShoppingBag, DollarSign, TrendingUp, Clock, 
  ArrowUpRight, ArrowDownRight, Package, Users
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area
} from "recharts";
import { formatBRL } from "@/lib/utils";
import { KpiCard, DailySalesChart, PaymentBreakdownChart, HourlyChart } from "@/components/FinanceCharts";

interface OverviewTabProps {
  metrics: any;
  adminChartData: any;
  dateFilter: string;
  setDateFilter: (f: any) => void;
  filterLabels: any;
  delayedOrders: any[];
  complianceAlerts: any[];
}

export default function OverviewTab({ 
  metrics, 
  adminChartData, 
  dateFilter, 
  setDateFilter, 
  filterLabels,
  delayedOrders,
  complianceAlerts
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-foreground">Visão Geral</h2>
        <div className="flex bg-muted/50 p-1 rounded-xl gap-1">
          {(["today", "yesterday", "week"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Vendas Brutas"
          value={formatBRL(metrics.totalSales)}
          icon={ShoppingBag}
          trend={metrics.totalSales > 0 ? "up" : null}
        />
        <KpiCard
          title="Lucro Comissões"
          value={formatBRL(metrics.commission)}
          icon={TrendingUp}
          trend={metrics.commission > 0 ? "up" : null}
        />
        <KpiCard
          title="Pedidos Ativos"
          value={metrics.activeOrders}
          icon={Clock}
          color="text-amber-500"
        />
        <KpiCard
          title="Total Pedidos"
          value={metrics.totalOrders}
          icon={Package}
          color="text-blue-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-3xl border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Vendas por Dia
          </h3>
          <div className="h-[250px]">
             <DailySalesChart data={adminChartData.dailyData} />
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Pedidos por Hora
          </h3>
          <div className="h-[250px]">
             <HourlyChart data={adminChartData.hourlyData} />
          </div>
        </div>
      </div>
      
      {/* Alert Panels */}
      {(delayedOrders.length > 0 || complianceAlerts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {delayedOrders.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-red-600 mb-3">Atrasos Ativos ({delayedOrders.length})</h3>
              <p className="text-xs text-muted-foreground">Existem pedidos que precisam de atenção imediata.</p>
            </div>
          )}
          {complianceAlerts.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-amber-600 mb-3">Alertas ({complianceAlerts.length})</h3>
              <p className="text-xs text-muted-foreground">Lojas com pendências de documentação ou comportamento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
