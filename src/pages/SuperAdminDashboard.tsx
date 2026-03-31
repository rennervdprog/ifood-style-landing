import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminApprovals from "@/components/AdminApprovals";
import AdminStoreManager from "@/components/AdminStoreManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Clock,
  Store, Copy, AlertTriangle, Users, Bike
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

type DateFilter = "today" | "yesterday" | "week";
type AdminTab = "dashboard" | "approvals" | "stores";

const SuperAdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    let start: Date;
    switch (filter) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "yesterday":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        now.setHours(0, 0, 0, 0);
        break;
      case "week":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
    }
    return { start: start!.toISOString(), end: filter === "yesterday" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() : new Date().toISOString() };
  };

  // Auth check
  const isAdmin = user?.email === "vinivias13@gmail.com";

  // Fetch all orders for the period
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-all-orders", dateFilter],
    queryFn: async () => {
      const { start, end } = getDateRange(dateFilter);
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, id)")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all stores
  const { data: stores } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all drivers
  const { data: drivers } = useQuery({
    queryKey: ["admin-all-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Calculated metrics
  const metrics = useMemo(() => {
    if (!orders) return { totalSales: 0, commission: 0, activeOrders: 0, totalOrders: 0 };
    const totalSales = orders.reduce((s, o) => s + Number(o.total_price), 0);
    const commission = orders.reduce((s, o) => s + (Number(o.subtotal) * 0.12) + Number((o as any).app_fee || 0), 0);
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    return { totalSales, commission, activeOrders, totalOrders: orders.length };
  }, [orders]);

  // Store conciliation
  const storeConciliation = useMemo(() => {
    if (!orders || !stores) return [];
    const map = new Map<string, { name: string; totalSold: number; commission: number; orders: number }>();
    stores.forEach(s => map.set(s.id, { name: s.name, totalSold: 0, commission: 0, orders: 0 }));
    orders.forEach(o => {
      const entry = map.get(o.store_id);
      if (entry) {
        entry.totalSold += Number(o.total_price);
        entry.commission += Number(o.subtotal) * 0.12;
        entry.orders += 1;
      }
    });
    return Array.from(map.values()).filter(e => e.orders > 0).sort((a, b) => b.totalSold - a.totalSold);
  }, [orders, stores]);

  // Hourly chart data
  const hourlyData = useMemo(() => {
    if (!orders) return [];
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, count: 0, revenue: 0 }));
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      hours[h].count += 1;
      hours[h].revenue += Number(o.total_price);
    });
    return hours.filter(h => h.count > 0 || (h.hour >= "8h" && h.hour <= "23h"));
  }, [orders]);

  // Delayed orders (> 60 min active)
  const delayedOrders = useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega"];
    return orders.filter(o => {
      if (!activeStatuses.includes(o.status)) return false;
      return (now - new Date(o.created_at).getTime()) > 60 * 60 * 1000;
    });
  }, [orders]);

  // Generate daily report
  const generateReport = () => {
    const dateLabel = dateFilter === "today" ? "Hoje" : dateFilter === "yesterday" ? "Ontem" : "Últimos 7 dias";
    let report = `📊 *Relatório ${dateLabel} - ItaFood*\n\n`;
    report += `💰 Vendas: R$ ${metrics.totalSales.toFixed(2)}\n`;
    report += `📦 Pedidos: ${metrics.totalOrders}\n`;
    report += `🏷️ Comissão Plataforma: R$ ${metrics.commission.toFixed(2)}\n\n`;
    report += `🏪 *Por Loja:*\n`;
    storeConciliation.forEach(s => {
      report += `• ${s.name}: R$ ${s.totalSold.toFixed(2)} (${s.orders} pedidos) — Comissão: R$ ${s.commission.toFixed(2)}\n`;
    });
    navigator.clipboard.writeText(report);
    toast.success("Relatório copiado! Cole no WhatsApp.");
  };

  if (authLoading) return null;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Acesso Negado</h1>
        <p className="text-sm text-gray-400 mb-6">Apenas o administrador pode acessar este painel.</p>
        <button onClick={() => navigate("/")} className="bg-white text-gray-900 font-bold px-6 py-3 rounded-xl">
          Voltar à Home
        </button>
      </div>
    );
  }

  const filterLabels: Record<DateFilter, string> = { today: "Hoje", yesterday: "Ontem", week: "7 dias" };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1E293B] border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm">Painel Administrativo</h1>
              <p className="text-xs text-gray-400">ItaFood</p>
            </div>
          </div>
          <button
            onClick={generateReport}
            className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-3 py-2 rounded-xl text-xs font-bold"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar Relatório
          </button>
        </div>
      </header>

      {/* Main tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-800 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${activeTab === "dashboard" ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab("approvals")}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${activeTab === "approvals" ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
        >
          🛡️ Aprovações
        </button>
        <button
          onClick={() => setActiveTab("stores")}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${activeTab === "stores" ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
        >
          🏪 Lojas
        </button>
      </div>

      {activeTab === "approvals" ? (
        <div className="px-4 py-4">
          <AdminApprovals />
        </div>
      ) : activeTab === "stores" ? (
        <div className="px-4 py-4">
          <AdminStoreManager />
        </div>
      ) : (
      <>
      {/* Date filter */}
      <div className="flex gap-2 px-4 py-3">
        {(["today", "yesterday", "week"] as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              dateFilter === f ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1E293B] rounded-2xl p-4 animate-pulse h-24" />
          ))
        ) : (
          <>
            <MetricCard
              icon={ShoppingBag}
              label="Vendas"
              value={`R$ ${metrics.totalSales.toFixed(2)}`}
              sublabel={`${metrics.totalOrders} pedidos`}
            />
            <MetricCard
              icon={TrendingUp}
              label="Sua Comissão"
              value={`R$ ${metrics.commission.toFixed(2)}`}
              sublabel="12% + taxas"
              highlight
            />
            <MetricCard
              icon={Clock}
              label="Pedidos Ativos"
              value={String(metrics.activeOrders)}
              sublabel="em andamento"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Em Atraso"
              value={String(delayedOrders.length)}
              sublabel="> 60 min"
              alert={delayedOrders.length > 0}
            />
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="px-4 flex gap-3 mb-4">
        <div className="flex-1 bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3">
          <Store className="h-5 w-5 text-yellow-400" />
          <div>
            <p className="text-lg font-black">{stores?.length || 0}</p>
            <p className="text-xs text-gray-400">Lojas</p>
          </div>
        </div>
        <div className="flex-1 bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3">
          <Bike className="h-5 w-5 text-yellow-400" />
          <div>
            <p className="text-lg font-black">{drivers?.length || 0}</p>
            <p className="text-xs text-gray-400">Entregadores</p>
          </div>
        </div>
      </div>

      {/* Hourly chart */}
      <div className="px-4 mb-4">
        <div className="bg-[#1E293B] rounded-2xl p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-yellow-400" />
            Pedidos por hora
          </h2>
          {isLoading ? (
            <div className="h-40 animate-pulse bg-gray-800 rounded-xl" />
          ) : hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#94A3B8" }}
                  formatter={(value: number, name: string) => [
                    name === "count" ? `${value} pedidos` : `R$ ${value.toFixed(2)}`,
                    name === "count" ? "Pedidos" : "Receita"
                  ]}
                />
                <Bar dataKey="count" fill="#EAB308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Sem dados para o período</p>
          )}
        </div>
      </div>

      {/* Conciliation table */}
      <div className="px-4 mb-4">
        <div className="bg-[#1E293B] rounded-2xl p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-400" />
            Conciliação por Loja
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : storeConciliation.length > 0 ? (
            <div className="space-y-2">
              {storeConciliation.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0F172A] rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.orders} pedidos</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-bold text-white">R$ {s.totalSold.toFixed(2)}</p>
                    <p className="text-xs text-yellow-400 font-bold">
                      Comissão: R$ {s.commission.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">Sem vendas no período</p>
          )}
        </div>
      </div>

      {/* Delayed orders */}
      {delayedOrders.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <h2 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pedidos em Atraso ({delayedOrders.length})
            </h2>
            <div className="space-y-2">
              {delayedOrders.map((o: any) => {
                const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
                return (
                  <div key={o.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-white">{o.stores?.name}</p>
                      <p className="text-xs text-gray-400">#{o.id.slice(0, 8)} — {o.status}</p>
                    </div>
                    <span className="text-sm font-bold text-red-400 animate-pulse">{mins} min</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

// Metric card component
const MetricCard = ({ icon: Icon, label, value, sublabel, highlight, alert }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel: string;
  highlight?: boolean;
  alert?: boolean;
}) => (
  <div className={`bg-[#1E293B] rounded-2xl p-4 ${alert ? "border border-red-500/50 animate-pulse-border" : ""}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${highlight ? "text-yellow-400" : alert ? "text-red-400" : "text-gray-400"}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
    <p className={`text-xl font-black ${highlight ? "text-yellow-400" : alert ? "text-red-400" : "text-white"}`}>
      {value}
    </p>
    <p className="text-xs text-gray-500">{sublabel}</p>
  </div>
);

export default SuperAdminDashboard;
