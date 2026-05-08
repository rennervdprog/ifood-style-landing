import { useState } from "react";
import { 
  ShoppingBag, TrendingUp, Clock, Package
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { KpiCard, DailySalesChart, HourlyChart } from "@/components/FinanceCharts";

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Vendas Brutas"
          value={formatBRL(metrics.totalSales)}
          trend={metrics.totalSales > 0 ? 100 : 0}
          color="primary"
        />
        <KpiCard
          label="Lucro Comissões"
          value={formatBRL(metrics.commission)}
          trend={metrics.commission > 0 ? 100 : 0}
          color="emerald"
        />
        <KpiCard
          label="Pedidos Ativos"
          value={String(metrics.activeOrders)}
          color="amber"
        />
        <KpiCard
          label="Total Pedidos"
          value={String(metrics.totalOrders)}
          color="blue"
        />
      </div>

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
    </div>
  );
}
