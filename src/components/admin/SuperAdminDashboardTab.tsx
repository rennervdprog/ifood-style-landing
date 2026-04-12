import { useMemo } from "react";
import {
  DollarSign, ShoppingBag, TrendingUp, Clock,
  Users, AlertTriangle, XCircle, CheckCircle2, Shield, Copy
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { formatBRL, addMoney, multiplyMoney } from "@/lib/utils";

type DateFilter = "today" | "yesterday" | "week";

const MetricCard = ({ icon: Icon, label, value, sublabel, highlight, alert }: {
  icon: React.ElementType; label: string; value: string; sublabel?: string; highlight?: boolean; alert?: boolean;
}) => (
  <div className={`bg-card rounded-2xl p-3 border transition-all ${alert ? "border-destructive/40 bg-destructive/5" : highlight ? "border-primary/30 bg-primary/5" : "border-border"}`}>
    <div className="flex items-center gap-2 mb-1">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${alert ? "bg-destructive/10" : highlight ? "bg-primary/10" : "bg-muted/50"}`}>
        <Icon className={`h-3.5 w-3.5 ${alert ? "text-destructive" : highlight ? "text-primary" : "text-muted-foreground"}`} />
      </div>
    </div>
    <p className={`text-lg font-black ${alert ? "text-destructive" : highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    {sublabel && <p className="text-[10px] text-muted-foreground/70">{sublabel}</p>}
  </div>
);

interface SuperAdminDashboardTabProps {
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  metrics: { totalSales: number; commission: number; activeOrders: number; totalOrders: number };
  isLoading: boolean;
  hourlyData: { hour: string; count: number; revenue: number }[];
  storeConciliation: { name: string; totalSold: number; commission: number; orders: number }[];
  delayedOrders: any[];
  complianceAlerts: any[] | undefined;
  parentStorePlans: any[] | undefined;
  stores: any[] | undefined;
  queryClient: any;
  generateReport: () => void;
}

const SuperAdminDashboardTab = ({
  dateFilter, setDateFilter, metrics, isLoading,
  hourlyData, storeConciliation, delayedOrders, complianceAlerts,
  parentStorePlans, stores, queryClient,
}: SuperAdminDashboardTabProps) => {
  const filterLabels: Record<DateFilter, string> = { today: "Hoje", yesterday: "Ontem", week: "7 dias" };

  const { supabase } = require("@/integrations/supabase/client");
  const { toast } = require("sonner");

  return (
    <>
      {/* Date filter */}
      <div className="flex gap-2 mb-4">
        {(["today", "yesterday", "week"] as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              dateFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-3 animate-pulse h-20 border border-border" />
          ))
        ) : (
          <>
            <MetricCard icon={ShoppingBag} label="Vendas" value={formatBRL(metrics.totalSales)} sublabel={`${metrics.totalOrders} pedidos`} />
            <MetricCard icon={TrendingUp} label="Comissão" value={formatBRL(metrics.commission)} sublabel="taxa por loja" highlight />
            <MetricCard icon={Clock} label="Ativos" value={String(metrics.activeOrders)} sublabel="em andamento" />
            <MetricCard icon={AlertTriangle} label="Atraso" value={String(delayedOrders.length)} sublabel="> 60 min" alert={delayedOrders.length > 0} />
          </>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Hourly chart */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Pedidos por hora
          </h2>
          {isLoading ? (
            <div className="h-40 animate-pulse bg-muted rounded-xl" />
          ) : hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(value: number, name: string) => [
                    name === "count" ? `${value} pedidos` : formatBRL(value),
                    name === "count" ? "Pedidos" : "Receita"
                  ]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-muted/50 rounded-2xl flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Sem dados para o período</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Os pedidos aparecerão aqui assim que forem realizados</p>
            </div>
          )}
        </div>

        {/* Conciliation table */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Conciliação por Loja
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : storeConciliation.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {storeConciliation.map((s, i) => {
                const plan = parentStorePlans?.find((p: any) => p.store_id === stores?.find((st: any) => st.name === s.name)?.id);
                const isFixed = plan?.plan_type === "fixed";
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.orders} pedidos
                        {isFixed && <span className="ml-1 text-[10px] font-bold text-primary">• Plano Fixo</span>}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-foreground">{formatBRL(s.totalSold)}</p>
                      <p className={`text-xs font-bold ${isFixed ? "text-muted-foreground" : "text-primary"}`}>
                        {isFixed ? "Sem comissão" : formatBRL(s.commission)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-muted/50 rounded-2xl flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Sem vendas no período</p>
              <p className="text-xs text-muted-foreground/60 mt-1">As vendas por loja aparecerão aqui</p>
            </div>
          )}
        </div>
      </div>

      {/* Delayed orders */}
      {delayedOrders.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-bold text-destructive mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pedidos em Atraso ({delayedOrders.length})
          </h2>
          <div className="space-y-2">
            {delayedOrders.map((o: any) => {
              const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
              return (
                <div key={o.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-foreground">{o.stores?.name}</p>
                    <p className="text-xs text-muted-foreground">#{o.id.slice(0, 8)} — {o.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-destructive animate-pulse">{mins} min</span>
                    <button
                      onClick={async () => {
                        if (!confirm("Cancelar este pedido?")) return;
                        const { error } = await supabase.rpc("admin_cancel_order", { _order_id: o.id });
                        if (error) { toast.error("Erro ao cancelar."); return; }
                        toast.success("Pedido cancelado!");
                        queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
                      }}
                      className="bg-destructive/20 text-destructive px-2 py-1 rounded-lg text-xs font-bold hover:bg-destructive/40"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compliance Alerts */}
      {complianceAlerts && complianceAlerts.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Alertas de Compliance ({complianceAlerts.length})
          </h2>
          <div className="space-y-2">
            {complianceAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{(alert as any).stores?.name || "Loja"}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(alert.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={async () => {
                      const { error } = await supabase
                        .from("compliance_alerts")
                        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
                        .eq("id", alert.id);
                      if (error) { toast.error("Erro ao resolver."); return; }
                      toast.success("Alerta resolvido!");
                      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
                    }}
                    className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-xs font-bold hover:bg-emerald-500/40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Suspender esta loja por violação de regras?")) return;
                      const storeId = alert.store_id;
                      const { error } = await supabase.from("stores").update({ status: "bloqueado" }).eq("id", storeId);
                      if (error) { toast.error("Erro ao suspender."); return; }
                      await supabase
                        .from("compliance_alerts")
                        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
                        .eq("id", alert.id);
                      toast.success("Loja suspensa por violação!");
                      queryClient.invalidateQueries({ queryKey: ["compliance-alerts"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
                    }}
                    className="bg-destructive/20 text-destructive px-2 py-1 rounded-lg text-xs font-bold hover:bg-destructive/40"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no data at all */}
      {!isLoading && metrics.totalOrders === 0 && delayedOrders.length === 0 && (!complianceAlerts || complianceAlerts.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-muted/50 rounded-3xl flex items-center justify-center mb-5">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-black text-foreground mb-2">Nenhum pedido no período 📭</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Selecione outro período ou aguarde novos pedidos chegarem na plataforma.
          </p>
        </div>
      )}
    </>
  );
};

export default SuperAdminDashboardTab;
export { MetricCard };
