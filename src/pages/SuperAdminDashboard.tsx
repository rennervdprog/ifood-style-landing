import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminApprovals from "@/components/AdminApprovals";
import AdminStoreManager from "@/components/AdminStoreManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Clock,
  Store, Copy, AlertTriangle, Users, Bike, Wallet, CheckCircle2, Banknote, XCircle, Bell, Trash2, QrCode, Loader2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

type DateFilter = "today" | "yesterday" | "week";
type AdminTab = "dashboard" | "approvals" | "stores" | "financeiro" | "saques" | "sync" | "coupons";

const SuperAdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [financeFilter, setFinanceFilter] = useState<"week" | "month">("week");
  const [financeSubTab, setFinanceSubTab] = useState<"stores" | "drivers">("stores");
  const [selectedStore, setSelectedStore] = useState<string>("all");

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

  const getFinanceDateRange = () => {
    const now = new Date();
    const days = financeFilter === "week" ? 7 : 30;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const isAdmin = user?.email === "vinivias13@gmail.com";

  // Fetch all orders for dashboard period
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

  // Fetch orders for finance period (finalized only)
  const { data: financeOrders, isLoading: financeLoading } = useQuery({
    queryKey: ["finance-orders", financeFilter],
    queryFn: async () => {
      const { start, end } = getFinanceDateRange();
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, id), order_items(quantity, unit_price)")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("status", ["finalizado", "entregue"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
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

  // Fetch store balances
  const { data: storeBalances } = useQuery({
    queryKey: ["store-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_balances").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  // Fetch withdrawal requests
  const { data: withdrawalRequests } = useQuery({
    queryKey: ["withdrawal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

  const pendingWithdrawals = withdrawalRequests?.filter((w: any) => w.status === "solicitado") || [];

  // Realtime for new withdrawal requests
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-withdrawals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
          if (payload.eventType === "INSERT") {
            toast.info("🔔 Nova solicitação de saque recebida!", { duration: 8000 });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, queryClient]);

  // Dashboard metrics
  const metrics = useMemo(() => {
    if (!orders) return { totalSales: 0, commission: 0, activeOrders: 0, totalOrders: 0 };
    const totalSales = orders.reduce((s, o) => s + Number(o.total_price), 0);
    const commission = orders.reduce((s, o) => s + (Number(o.subtotal) * 0.12) + Number((o as any).app_fee || 0), 0);
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    return { totalSales, commission, activeOrders, totalOrders: orders.length };
  }, [orders]);

  // Finance: Store settlement data
  const storeSettlement = useMemo(() => {
    if (!financeOrders || !stores) return [];
    const map = new Map<string, {
      name: string;
      storeId: string;
      physicalSales: number; // dinheiro + cartao
      appSales: number; // pix
      totalSales: number;
      commissionDue: number; // 15% of physical
      netTransfer: number; // appSales - 15% commission on app
      finalBalance: number;
      orderCount: number;
      deliveryFees: number;
    }>();

    stores.forEach(s => map.set(s.id, {
      name: s.name,
      storeId: s.id,
      physicalSales: 0,
      appSales: 0,
      totalSales: 0,
      commissionDue: 0,
      netTransfer: 0,
      finalBalance: 0,
      orderCount: 0,
      deliveryFees: 0,
    }));

    const filtered = selectedStore === "all" ? financeOrders : financeOrders.filter(o => o.store_id === selectedStore);

    filtered.forEach(o => {
      const entry = map.get(o.store_id);
      if (!entry) return;
      const subtotal = Number(o.subtotal);
      const deliveryFee = Number(o.delivery_fee);
      const isPhysical = o.payment_method === "dinheiro" || o.payment_method === "cartao";

      if (isPhysical) {
        entry.physicalSales += subtotal;
      } else {
        entry.appSales += subtotal;
      }
      entry.totalSales += subtotal;
      entry.deliveryFees += deliveryFee;
      entry.orderCount += 1;
    });

    // Calculate balances
    map.forEach(entry => {
      entry.commissionDue = entry.physicalSales * 0.15; // Store owes admin 15% on physical
      entry.netTransfer = entry.appSales - (entry.appSales * 0.15); // Admin owes store (app sales minus 15%)
      entry.finalBalance = entry.netTransfer - entry.commissionDue; // Positive = admin pays store, Negative = store pays admin
    });

    return Array.from(map.values()).filter(e => e.orderCount > 0).sort((a, b) => b.totalSales - a.totalSales);
  }, [financeOrders, stores, selectedStore]);

  // Finance: Driver settlement data
  const driverSettlement = useMemo(() => {
    if (!financeOrders || !drivers) return [];
    const map = new Map<string, {
      name: string;
      driverId: string;
      totalFees: number;
      cashFees: number; // received in hand (dinheiro orders)
      appFees: number; // to receive from admin (pix orders)
      deliveryCount: number;
    }>();

    drivers.forEach(d => map.set(d.user_id, {
      name: d.name || "Entregador",
      driverId: d.user_id,
      totalFees: 0,
      cashFees: 0,
      appFees: 0,
      deliveryCount: 0,
    }));

    financeOrders.forEach(o => {
      if (!o.driver_id) return;
      const entry = map.get(o.driver_id);
      if (!entry) return;
      const fee = Number(o.delivery_fee);
      entry.totalFees += fee;
      entry.deliveryCount += 1;
      if (o.payment_method === "dinheiro") {
        entry.cashFees += fee; // driver already got this cash
      } else {
        entry.appFees += fee; // admin needs to pay driver
      }
    });

    return Array.from(map.values()).filter(e => e.deliveryCount > 0).sort((a, b) => b.totalFees - a.totalFees);
  }, [financeOrders, drivers]);

  // Finance totals
  const financeTotals = useMemo(() => {
    const totalVolume = storeSettlement.reduce((s, e) => s + e.totalSales, 0);
    const grossProfit = storeSettlement.reduce((s, e) => s + (e.totalSales * 0.15), 0);
    const totalDriverFees = driverSettlement.reduce((s, e) => s + e.appFees, 0);
    return { totalVolume, grossProfit, totalDriverFees };
  }, [storeSettlement, driverSettlement]);

  // Store conciliation (dashboard)
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

  // Hourly chart
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

  // Delayed orders
  const delayedOrders = useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega"];
    return orders.filter(o => {
      if (!activeStatuses.includes(o.status)) return false;
      return (now - new Date(o.created_at).getTime()) > 60 * 60 * 1000;
    });
  }, [orders]);

  const generateReport = () => {
    const dateLabel = dateFilter === "today" ? "Hoje" : dateFilter === "yesterday" ? "Ontem" : "Últimos 7 dias";
    let report = `📊 *Relatório ${dateLabel} - FoodIta*\n\n`;
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

  const generateStoreWhatsApp = (entry: typeof storeSettlement[0]) => {
    const period = financeFilter === "week" ? "Semana" : "Mês";
    const balanceText = entry.finalBalance >= 0
      ? `✅ O FoodIta deve transferir R$ ${entry.finalBalance.toFixed(2)} para você.`
      : `⚠️ Valor a acertar com o FoodIta: R$ ${Math.abs(entry.finalBalance).toFixed(2)}.`;

    const msg = `💰 *Fechamento FoodIta (${period})*\n\nOlá *${entry.name}*!\n\n` +
      `📦 Total de Pedidos: ${entry.orderCount}\n` +
      `💵 Vendas Físicas (Dinheiro/Cartão): R$ ${entry.physicalSales.toFixed(2)}\n` +
      `📱 Vendas App (Pix): R$ ${entry.appSales.toFixed(2)}\n\n` +
      `🏷️ Comissão 15% sobre Físicas: R$ ${entry.commissionDue.toFixed(2)}\n` +
      `💸 Repasse Líquido (App - 15%): R$ ${entry.netTransfer.toFixed(2)}\n\n` +
      `---\n${balanceText}\n---`;

    navigator.clipboard.writeText(msg);
    toast.success(`Extrato de ${entry.name} copiado!`);
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
              <p className="text-xs text-gray-400">FoodIta</p>
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
        {([
          { key: "dashboard" as AdminTab, label: "📊 Dashboard" },
          { key: "financeiro" as AdminTab, label: "💰 Financeiro" },
          { key: "saques" as AdminTab, label: "🏧 Saques" },
          { key: "approvals" as AdminTab, label: "🛡️ Aprovações" },
          { key: "stores" as AdminTab, label: "🏪 Lojas" },
          { key: "sync" as AdminTab, label: "🔄 Sincronizar" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${activeTab === tab.key ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
          >
            {tab.label}
            {tab.key === "saques" && pendingWithdrawals.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                {pendingWithdrawals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "approvals" ? (
        <div className="px-4 py-4"><AdminApprovals /></div>
      ) : activeTab === "sync" ? (
        <SyncExternalTab />
      ) : activeTab === "stores" ? (
        <div className="px-4 py-4"><AdminStoreManager /></div>
      ) : activeTab === "saques" ? (
        <SaquesTab
          withdrawalRequests={withdrawalRequests}
          pendingWithdrawals={pendingWithdrawals}
          drivers={drivers}
          queryClient={queryClient}
        />
      
      ) : activeTab === "financeiro" ? (
        <FinanceTab
          storeSettlement={storeSettlement}
          driverSettlement={driverSettlement}
          financeTotals={financeTotals}
          financeFilter={financeFilter}
          setFinanceFilter={setFinanceFilter}
          financeSubTab={financeSubTab}
          setFinanceSubTab={setFinanceSubTab}
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
          stores={stores || []}
          loading={financeLoading}
          generateStoreWhatsApp={generateStoreWhatsApp}
          storeBalances={storeBalances || []}
          queryClient={queryClient}
          withdrawalRequests={withdrawalRequests || []}
        />
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
            <MetricCard icon={ShoppingBag} label="Vendas" value={`R$ ${metrics.totalSales.toFixed(2)}`} sublabel={`${metrics.totalOrders} pedidos`} />
            <MetricCard icon={TrendingUp} label="Sua Comissão" value={`R$ ${metrics.commission.toFixed(2)}`} sublabel="12% + taxas" highlight />
            <MetricCard icon={Clock} label="Pedidos Ativos" value={String(metrics.activeOrders)} sublabel="em andamento" />
            <MetricCard icon={AlertTriangle} label="Em Atraso" value={String(delayedOrders.length)} sublabel="> 60 min" alert={delayedOrders.length > 0} />
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
                    <p className="text-xs text-yellow-400 font-bold">Comissão: R$ {s.commission.toFixed(2)}</p>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-red-400 animate-pulse">{mins} min</span>
                      <button
                        onClick={async () => {
                          if (!confirm("Cancelar este pedido?")) return;
                          const { error } = await supabase.rpc("admin_cancel_order", { _order_id: o.id });
                          if (error) { toast.error("Erro ao cancelar."); return; }
                          toast.success("Pedido cancelado!");
                          queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
                        }}
                        className="bg-red-500/20 text-red-400 px-2 py-1 rounded-lg text-xs font-bold hover:bg-red-500/40"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

// Finance Tab Component
const FinanceTab = ({
  storeSettlement, driverSettlement, financeTotals,
  financeFilter, setFinanceFilter,
  financeSubTab, setFinanceSubTab,
  selectedStore, setSelectedStore,
  stores, loading,
  generateStoreWhatsApp,
  storeBalances, queryClient,
  withdrawalRequests,
}: {
  storeSettlement: any[];
  driverSettlement: any[];
  financeTotals: { totalVolume: number; grossProfit: number; totalDriverFees: number };
  financeFilter: "week" | "month";
  setFinanceFilter: (f: "week" | "month") => void;
  financeSubTab: "stores" | "drivers";
  setFinanceSubTab: (t: "stores" | "drivers") => void;
  selectedStore: string;
  setSelectedStore: (s: string) => void;
  stores: any[];
  loading: boolean;
  generateStoreWhatsApp: (entry: any) => void;
  storeBalances: any[];
  queryClient: any;
  withdrawalRequests: any[];
}) => {
  const [payingStore, setPayingStore] = useState<string | null>(null);
  const [chargingStore, setChargingStore] = useState<string | null>(null);

  // Fetch store owner PIX keys
  const { data: ownerProfiles } = useQuery({
    queryKey: ["store-owner-pix-keys"],
    queryFn: async () => {
      const storeIds = stores.map((s: any) => s.id);
      if (storeIds.length === 0) return [];
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, owner_id")
        .in("id", storeIds);
      if (!storesData) return [];
      const ownerIds = storesData.map(s => s.owner_id).filter(Boolean);
      if (ownerIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, pix_key, pix_type")
        .in("user_id", ownerIds as string[]);
      return (storesData || []).map(s => ({
        storeId: s.id,
        ownerId: s.owner_id,
        pixKey: profiles?.find(p => p.user_id === s.owner_id)?.pix_key || null,
        pixType: profiles?.find(p => p.user_id === s.owner_id)?.pix_type || null,
      }));
    },
    enabled: stores.length > 0,
  });

  const getStorePixInfo = (storeId: string) => {
    return ownerProfiles?.find((p: any) => p.storeId === storeId) || null;
  };

  const markAsPaid = async (storeId: string, storeName: string) => {
    const { error } = await supabase
      .from("store_balances")
      .upsert({ store_id: storeId, pending_commission: 0, comissao_pendente: 0, updated_at: new Date().toISOString() } as any, { onConflict: "store_id" });
    if (error) {
      toast.error("Erro ao marcar como pago.");
    } else {
      toast.success(`✅ Saldo de ${storeName} zerado!`);
      queryClient.invalidateQueries({ queryKey: ["store-balances"] });
    }
  };

  const handleAdminPayout = async (entry: any) => {
    if (entry.netTransfer <= 0) {
      toast.info("Não há repasse pendente para esta loja.");
      return;
    }

    const pixInfo = getStorePixInfo(entry.storeId);
    if (!pixInfo?.pixKey) {
      toast.error(`❌ Erro: O lojista de "${entry.name}" ainda não cadastrou uma chave Pix para recebimento. Peça para ele configurar em Configurações → Dados para Recebimento (Pix).`);
      return;
    }

    const ownerProfile = { pix_key: pixInfo.pixKey, pix_type: pixInfo.pixType };

    setPayingStore(entry.storeId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-payout-store", {
        body: {
          store_id: entry.storeId,
          amount: entry.netTransfer,
          pix_key: ownerProfile.pix_key,
          pix_type: ownerProfile.pix_type || "cpf",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.status === "manual_required") {
        toast.info(`${data.reference_code}: Transferência manual necessária. PIX: ${data.pix_key} (${data.pix_type}) - R$ ${data.amount.toFixed(2)}`, { duration: 15000 });
      } else {
        toast.success(`${data.reference_code}: Repasse de R$ ${data.amount.toFixed(2)} enviado para ${entry.name}!`);
      }

      queryClient.invalidateQueries({ queryKey: ["store-balances"] });
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar repasse.");
    } finally {
      setPayingStore(null);
    }
  };

  const handleChargeCommission = async (entry: any) => {
    const balance = storeBalances.find((b: any) => b.store_id === entry.storeId);
    const chargeAmount = Number(balance?.comissao_pendente || balance?.pending_commission || entry.commissionDue);

    if (chargeAmount <= 0) {
      toast.info("Não há comissões pendentes para cobrar.");
      return;
    }

    setChargingStore(entry.storeId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-commission-charge", {
        body: {
          store_id: entry.storeId,
          amount: chargeAmount,
          description: `Comissão FoodIta - ${entry.name}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.qr_code) {
        navigator.clipboard.writeText(data.qr_code);
        toast.success(`${data.reference_code}: Cobrança PIX gerada! Código copiado. R$ ${data.amount.toFixed(2)}`, { duration: 10000 });
      } else {
        toast.success(`${data.reference_code}: Cobrança registrada. R$ ${data.amount.toFixed(2)}`);
      }

      queryClient.invalidateQueries({ queryKey: ["store-balances"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar cobrança.");
    } finally {
      setChargingStore(null);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Period filter */}
      <div className="flex gap-2">
        {(["week", "month"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFinanceFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${financeFilter === f ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
          >
            {f === "week" ? "📅 Semana" : "📅 Mês"}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {(() => {
        const pendingDriverAmount = withdrawalRequests
          .filter((w: any) => w.status === "solicitado")
          .reduce((s: number, w: any) => s + Number(w.amount), 0);
        const paidDriverAmount = withdrawalRequests
          .filter((w: any) => w.status === "pago")
          .reduce((s: number, w: any) => s + Number(w.amount), 0);
        return (
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1E293B] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Volume Total</span>
          </div>
          <p className="text-lg font-black text-white">R$ {financeTotals.totalVolume.toFixed(2)}</p>
        </div>
        <div className="bg-[#1E293B] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Lucro Bruto</span>
          </div>
          <p className="text-lg font-black text-yellow-400">R$ {financeTotals.grossProfit.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">15% comissões</p>
        </div>
        <div className="bg-[#1E293B] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bike className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-gray-400">Motoboys (Pendente)</span>
          </div>
          <p className="text-lg font-black text-amber-400">R$ {pendingDriverAmount.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">solicitações ativas</p>
        </div>
        <div className="bg-[#1E293B] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Motoboys (Pago)</span>
          </div>
          <p className="text-lg font-black text-green-400">R$ {paidDriverAmount.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">já transferido</p>
        </div>
      </div>
        );
      })()}

      {/* Sub-tabs: Stores vs Drivers */}
      <div className="flex gap-2">
        <button
          onClick={() => setFinanceSubTab("stores")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${financeSubTab === "stores" ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
        >
          🏪 Lojas
        </button>
        <button
          onClick={() => setFinanceSubTab("drivers")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${financeSubTab === "drivers" ? "bg-yellow-500 text-gray-900" : "bg-[#1E293B] text-gray-400"}`}
        >
          🛵 Entregadores
        </button>
      </div>

      {/* Store filter */}
      {financeSubTab === "stores" && (
        <select
          value={selectedStore}
          onChange={e => setSelectedStore(e.target.value)}
          className="w-full bg-[#1E293B] text-white border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
        >
          <option value="all">Todas as lojas</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#1E293B] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : financeSubTab === "stores" ? (
        /* Store settlement cards */
        storeSettlement.length > 0 ? (
          <div className="space-y-3">
            {storeSettlement.map((entry, i) => {
              const balance = storeBalances.find((b: any) => b.store_id === entry.storeId);
              const dbRepasse = Number((balance as any)?.repasse_pendente || 0);
              const dbComissao = Number((balance as any)?.comissao_pendente || balance?.pending_commission || 0);
              return (
                <div key={i} className="bg-[#1E293B] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{entry.name}</h3>
                    <span className="text-xs text-gray-400">{entry.orderCount} pedidos</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#0F172A] rounded-xl p-2.5">
                      <p className="text-gray-400">💵 Vendas Físicas</p>
                      <p className="text-sm font-bold text-white">R$ {entry.physicalSales.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#0F172A] rounded-xl p-2.5">
                      <p className="text-gray-400">📱 Vendas App</p>
                      <p className="text-sm font-bold text-white">R$ {entry.appSales.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Separated balances */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* A Pagar ao Lojista (Admin owes store) */}
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <ArrowUpRight className="h-3 w-3 text-green-400" />
                        <p className="text-green-400 font-bold">A Pagar (85% App)</p>
                      </div>
                      <p className="text-lg font-black text-green-400">R$ {entry.netTransfer.toFixed(2)}</p>
                    </div>

                    {/* A Receber do Lojista (Store owes admin) */}
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <ArrowDownRight className="h-3 w-3 text-red-400" />
                        <p className="text-red-400 font-bold">A Receber (15%)</p>
                      </div>
                      <p className="text-lg font-black text-red-400">R$ {(dbComissao > 0 ? dbComissao : entry.commissionDue).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Net balance */}
                  <div className="bg-[#0F172A] rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">SALDO LÍQUIDO</p>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <p className="text-[10px] text-green-400">Crédito (Comissões)</p>
                        <p className="text-sm font-bold text-green-400">R$ {(dbComissao > 0 ? dbComissao : entry.commissionDue).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-red-400">Débito (Repasses)</p>
                        <p className="text-sm font-bold text-red-400">R$ {entry.netTransfer.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white">Total Líquido</p>
                        <p className={`text-sm font-black ${entry.finalBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {entry.finalBalance >= 0 ? "+" : "-"}R$ {Math.abs(entry.finalBalance).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Pagar Lojista via Pix */}
                    <button
                      onClick={() => handleAdminPayout(entry)}
                      disabled={payingStore === entry.storeId || entry.netTransfer <= 0}
                      className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:bg-green-500/30 disabled:text-green-400/50 text-white py-3 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    >
                      {payingStore === entry.storeId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                      Pagar Lojista via Pix
                    </button>

                    {/* Gerar Cobrança Pix */}
                    <button
                      onClick={() => handleChargeCommission(entry)}
                      disabled={chargingStore === entry.storeId || (entry.commissionDue <= 0 && dbComissao <= 0)}
                      className="flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:text-red-400/50 text-white py-3 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    >
                      {chargingStore === entry.storeId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <QrCode className="h-3.5 w-3.5" />
                      )}
                      Gerar Cobrança Pix
                    </button>
                  </div>

                  {/* PIX Key display */}
                  {(() => {
                    const pixInfo = getStorePixInfo(entry.storeId);
                    return pixInfo?.pixKey ? (
                      <div className="bg-[#0F172A] rounded-xl p-2.5 flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500">Chave PIX do Lojista</p>
                          <p className="text-xs text-gray-300 truncate">{pixInfo.pixKey}</p>
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase">{pixInfo.pixType}</span>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        <p className="text-[10px] text-amber-400 font-bold">Lojista não cadastrou chave PIX</p>
                      </div>
                    );
                  })()}

                  {/* Secondary actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateStoreWhatsApp(entry)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 text-green-400 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Extrato WhatsApp
                    </button>
                    <button
                      onClick={() => markAsPaid(entry.storeId, entry.name)}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-500/20 text-blue-400 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Marcar Pago
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#1E293B] rounded-2xl p-8 text-center">
            <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Sem vendas finalizadas no período</p>
          </div>
        )
      ) : (
        /* Driver settlement cards */
        driverSettlement.length > 0 ? (
          <div className="space-y-3">
            {driverSettlement.map((entry, i) => {
              const driverPending = withdrawalRequests
                .filter((w: any) => w.driver_user_id === entry.driverId && w.status === "solicitado")
                .reduce((s: number, w: any) => s + Number(w.amount), 0);
              const driverPaid = withdrawalRequests
                .filter((w: any) => w.driver_user_id === entry.driverId && w.status === "pago")
                .reduce((s: number, w: any) => s + Number(w.amount), 0);
              return (
              <div key={i} className="bg-[#1E293B] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <Bike className="h-4 w-4 text-green-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white">{entry.name}</h3>
                  </div>
                  <span className="text-xs text-gray-400">{entry.deliveryCount} entregas</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center">
                    <p className="text-gray-400">💵 Em mãos</p>
                    <p className="text-sm font-bold text-yellow-400">R$ {entry.cashFees.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center">
                    <p className="text-gray-400">📱 Total Ganho App</p>
                    <p className="text-sm font-bold text-white">R$ {entry.appFees.toFixed(2)}</p>
                  </div>
                  <div className="bg-amber-500/10 rounded-xl p-2.5 text-center border border-amber-500/20">
                    <p className="text-amber-400">⏳ A Receber</p>
                    <p className="text-sm font-bold text-amber-400">R$ {Math.max(0, entry.appFees - driverPaid).toFixed(2)}</p>
                  </div>
                  <div className="bg-green-500/10 rounded-xl p-2.5 text-center border border-green-500/20">
                    <p className="text-green-400">✅ Já Pago</p>
                    <p className="text-sm font-bold text-green-400">R$ {driverPaid.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#1E293B] rounded-2xl p-8 text-center">
            <Bike className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Sem entregas finalizadas no período</p>
          </div>
        )
      )}
    </div>
  );
};

// Metric card
const MetricCard = ({ icon: Icon, label, value, sublabel, highlight, alert }: {
  icon: React.ElementType; label: string; value: string; sublabel: string; highlight?: boolean; alert?: boolean;
}) => (
  <div className={`bg-[#1E293B] rounded-2xl p-4 ${alert ? "border border-red-500/50" : ""}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${highlight ? "text-yellow-400" : alert ? "text-red-400" : "text-gray-400"}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
    <p className={`text-xl font-black ${highlight ? "text-yellow-400" : alert ? "text-red-400" : "text-white"}`}>{value}</p>
    <p className="text-xs text-gray-500">{sublabel}</p>
  </div>
);

// Saques Tab Component
const SaquesTab = ({ withdrawalRequests, pendingWithdrawals, drivers, queryClient }: {
  withdrawalRequests: any[] | undefined;
  pendingWithdrawals: any[];
  drivers: any[] | undefined;
  queryClient: any;
}) => {
  const [saquesSubTab, setSaquesSubTab] = useState<"pendentes" | "historico">("pendentes");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingList = (withdrawalRequests || []).filter((w: any) => w.status === "solicitado")
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const historyList = (withdrawalRequests || []).filter((w: any) => w.status !== "solicitado")
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleDelete = async (req: any) => {
    if (deletingId === req.id) {
      // Confirmed - actually delete
      const { error } = await supabase
        .from("withdrawal_requests" as any)
        .delete()
        .eq("id", req.id);
      if (error) { toast.error("Erro ao excluir solicitação."); }
      else { toast.success(`🗑️ Solicitação ${req.transaction_code || ""} excluída.`); }
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
    } else {
      setDeletingId(req.id);
      setTimeout(() => setDeletingId(null), 4000); // auto-cancel confirmation after 4s
    }
  };

  const handleConfirmPayment = async (req: any, driverName: string) => {
    const { error: updateError } = await supabase
      .from("withdrawal_requests" as any)
      .update({ status: "pago", processed_at: new Date().toISOString() } as any)
      .eq("id", req.id);
    if (updateError) { toast.error("Erro ao confirmar."); return; }

    const { error: balanceError } = await supabase
      .from("driver_balances" as any)
      .update({ pending_amount: 0, paid_amount: Number(req.amount), updated_at: new Date().toISOString() } as any)
      .eq("driver_user_id", req.driver_user_id);
    if (balanceError) console.error("Balance update error:", balanceError);

    await supabase
      .from("driver_earnings" as any)
      .update({ status: "pago" } as any)
      .eq("driver_user_id", req.driver_user_id)
      .eq("status", "pendente");

    toast.success(`✅ Transferência de R$ ${Number(req.amount).toFixed(2)} para ${driverName} confirmada!`);
    queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
  };

  const renderCard = (req: any) => {
    const isPending = req.status === "solicitado";
    const isPaid = req.status === "pago";
    const driverName = drivers?.find((d: any) => d.user_id === req.driver_user_id)?.name || "Entregador";

    return (
      <div key={req.id} className={`bg-card rounded-2xl p-4 border ${isPending ? "border-amber-500/30" : "border-border"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPending ? "bg-amber-500/20" : isPaid ? "bg-green-500/20" : "bg-red-500/20"}`}>
              <DollarSign className={`h-4 w-4 ${isPending ? "text-amber-400" : isPaid ? "text-green-400" : "text-red-400"}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{driverName}</p>
              <p className="text-xs text-muted-foreground font-bold">
                {req.transaction_code && <span className="text-primary mr-1">{req.transaction_code}</span>}
                R$ {Number(req.amount).toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(req.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isPending ? "bg-amber-500/20 text-amber-400" : isPaid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {isPending ? "Pendente" : isPaid ? "✅ Pago" : "Cancelado"}
            </span>
            <button
              onClick={() => handleDelete(req)}
              className={`p-2 rounded-lg transition-colors ${deletingId === req.id ? "bg-red-500 text-white" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}
              title={deletingId === req.id ? "Clique novamente para confirmar" : "Excluir solicitação"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {deletingId === req.id && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3 text-center">
            <p className="text-xs text-red-400 font-medium">
              Deseja excluir esta solicitação? Isso não estornará o saldo, apenas removerá o aviso do painel.
            </p>
            <p className="text-[10px] text-red-400/70 mt-1">Clique na 🗑️ novamente para confirmar</p>
          </div>
        )}

        <div className="bg-muted rounded-xl p-3 space-y-1 mb-3">
          <p className="text-xs text-muted-foreground">Entregador: <span className="text-foreground font-medium">{driverName}</span></p>
          <p className="text-xs text-muted-foreground">Valor: <span className="text-foreground font-bold">R$ {Number(req.amount).toFixed(2)}</span></p>
          <p className="text-xs text-muted-foreground">Chave PIX: <span className="text-foreground font-medium">{req.pix_key}</span></p>
          <p className="text-xs text-muted-foreground">Tipo: <span className="text-foreground font-medium">{req.pix_type?.toUpperCase()}</span></p>
          {req.processed_at && (
            <p className="text-xs text-muted-foreground">Processado em: <span className="text-foreground font-medium">
              {new Date(req.processed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span></p>
          )}
        </div>

        {isPending && (
          <button
            onClick={() => handleConfirmPayment(req, driverName)}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar Pagamento
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4" /> Solicitações de Saque
          </h2>
          <button
            onClick={async () => {
              const { data, error } = await supabase.rpc("admin_cleanup_duplicate_withdrawals");
              if (error) {
                toast.error("Erro ao limpar duplicatas.");
                return;
              }
              toast.success(`Limpeza concluída: ${Number(data || 0)} duplicata(s) removida(s).`);
              queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
            }}
            className="px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold"
          >
            Limpar Duplicatas
          </button>
        </div>

        <div className="flex gap-2">
          {[
            { key: "pendentes" as const, label: `⏳ Pendentes (${pendingList.length})` },
            { key: "historico" as const, label: `📋 Histórico (${historyList.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSaquesSubTab(tab.key)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-colors ${
                saquesSubTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {saquesSubTab === "pendentes" ? (
        pendingList.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div className="space-y-3">{pendingList.map(renderCard)}</div>
        )
      ) : historyList.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center border border-border">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum saque no histórico.</p>
        </div>
      ) : (
        <div className="space-y-3">{historyList.map(renderCard)}</div>
      )}
    </div>
  );
};

// ─── Sync External Tab ───
const SyncExternalTab = () => {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, { count: number; error?: string }> | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-external", {
        body: { action: "test_connection" },
      });
      if (error) throw error;
      setTestResult({ success: data?.success ?? false, message: data?.message || "Sem resposta" });
      if (data?.success) {
        toast.success("Conexão com banco externo confirmada!");
      } else {
        toast.error(data?.message || "Falha na conexão");
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Erro desconhecido" });
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSyncStores = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-external", {
        body: { action: "sync_stores" },
      });
      if (error) throw error;
      setSyncResult(data?.results || {});
      if (data?.success) {
        toast.success("Dados sincronizados com sucesso!");
      } else {
        toast.warning("Sincronização concluída com alguns erros. Verifique os detalhes.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao sincronizar dados");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          🔄 Sincronização com Banco Externo
        </h2>
        <p className="text-sm text-muted-foreground">
          Envie dados (lojas, produtos, perfis) para seu banco externo. Certifique-se de que os Secrets EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_SERVICE_KEY estão configurados.
        </p>

        {/* Test Connection */}
        <div className="space-y-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {testing ? "Testando..." : "Teste de Conexão"}
          </button>
          {testResult && (
            <div className={`p-3 rounded-xl text-sm font-medium ${testResult.success ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
              {testResult.success ? "✅" : "❌"} {testResult.message}
            </div>
          )}
        </div>

        {/* Sync Stores */}
        <div className="space-y-2">
          <button
            onClick={handleSyncStores}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar Dados de Lojistas"}
          </button>
          {syncResult && (
            <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
              {Object.entries(syncResult).map(([table, info]) => (
                <div key={table} className="flex justify-between">
                  <span className="font-medium">{table}</span>
                  <span className={info.error ? "text-destructive" : "text-green-400"}>
                    {info.error ? `❌ ${info.error}` : `✅ ${info.count} registros`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
