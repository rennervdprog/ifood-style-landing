import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminApprovals from "@/components/AdminApprovals";
import CouponManager from "@/components/CouponManager";
import AdminStoreManager from "@/components/AdminStoreManager";
import DeliveryFeeConfigPanel from "@/components/DeliveryFeeConfig";
import TestStoreCreator from "@/components/TestStoreCreator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Clock,
  Store, Copy, AlertTriangle, Users, Bike, Wallet, CheckCircle2, Banknote, XCircle, Bell, Trash2, QrCode, Loader2, ArrowUpRight, ArrowDownRight, Settings,
  LayoutDashboard, Shield, Ticket, RefreshCw, Truck, Menu, X, MapPin, Eye
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { addMoney, multiplyMoney, subtractMoney, sumMoney } from "@/lib/utils";

type DateFilter = "today" | "yesterday" | "week";
type AdminTab = "dashboard" | "approvals" | "stores" | "financeiro" | "saques" | "sync" | "coupons" | "entrega" | "cidades";

const sidebarItems: { key: AdminTab; label: string; icon: React.ElementType; group: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Principal" },
  { key: "financeiro", label: "Financeiro", icon: DollarSign, group: "Principal" },
  { key: "saques", label: "Saques", icon: Wallet, group: "Principal" },
  { key: "entrega", label: "Entrega", icon: Truck, group: "Configurações" },
  { key: "approvals", label: "Aprovações", icon: Shield, group: "Gerenciamento" },
  { key: "stores", label: "Lojas", icon: Store, group: "Gerenciamento" },
  { key: "cidades", label: "Cidades", icon: MapPin, group: "Gerenciamento" },
  { key: "coupons", label: "Cupons", icon: Ticket, group: "Gerenciamento" },
  { key: "sync", label: "Sincronizar", icon: RefreshCw, group: "Sistema" },
];

const SuperAdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [financeFilter, setFinanceFilter] = useState<"week" | "month">("week");
  const [financeSubTab, setFinanceSubTab] = useState<"stores" | "drivers">("stores");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

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

  const { data: stores } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: drivers } = useQuery({
    queryKey: ["admin-all-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: storeBalances } = useQuery({
    queryKey: ["store-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_balances").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  // Compliance alerts
  const { data: complianceAlerts } = useQuery({
    queryKey: ["compliance-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_alerts" as any)
        .select("*, stores:store_id(name)")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
  });

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

  const metrics = useMemo(() => {
    if (!orders) return { totalSales: 0, commission: 0, activeOrders: 0, totalOrders: 0 };
    const totalSales = sumMoney(orders.map((order) => order.total_price));
    const commission = sumMoney(orders.map((order) => multiplyMoney(order.subtotal, 0.15)));
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    return { totalSales, commission, activeOrders, totalOrders: orders.length };
  }, [orders]);

  const storeSettlement = useMemo(() => {
    if (!financeOrders || !stores) return [];
    const map = new Map<string, {
      name: string; storeId: string; physicalSales: number; appSales: number; totalSales: number;
      commissionDue: number; netTransfer: number; finalBalance: number; orderCount: number; deliveryFees: number;
    }>();
    stores.forEach(s => map.set(s.id, {
      name: s.name, storeId: s.id, physicalSales: 0, appSales: 0, totalSales: 0,
      commissionDue: 0, netTransfer: 0, finalBalance: 0, orderCount: 0, deliveryFees: 0,
    }));
    const filtered = selectedStore === "all" ? financeOrders : financeOrders.filter(o => o.store_id === selectedStore);
    filtered.forEach(o => {
      const entry = map.get(o.store_id);
      if (!entry) return;
      const subtotal = o.subtotal;
      const deliveryFee = o.delivery_fee;
      const isPhysical = o.payment_method === "dinheiro" || o.payment_method === "cartao";
      if (isPhysical) entry.physicalSales = addMoney(entry.physicalSales, subtotal);
      else entry.appSales = addMoney(entry.appSales, subtotal);
      entry.totalSales = addMoney(entry.totalSales, subtotal);
      entry.deliveryFees = addMoney(entry.deliveryFees, deliveryFee);
      entry.orderCount += 1;
    });
    map.forEach(entry => {
      entry.commissionDue = multiplyMoney(entry.physicalSales, 0.15);
      entry.netTransfer = subtractMoney(entry.appSales, multiplyMoney(entry.appSales, 0.15));
      entry.finalBalance = subtractMoney(entry.netTransfer, entry.commissionDue);
    });
    return Array.from(map.values()).filter(e => e.orderCount > 0).sort((a, b) => b.totalSales - a.totalSales);
  }, [financeOrders, stores, selectedStore]);

  const driverSettlement = useMemo(() => {
    if (!financeOrders || !drivers) return [];
    const map = new Map<string, {
      name: string; driverId: string; totalFees: number; cashFees: number; appFees: number; deliveryCount: number;
    }>();
    drivers.forEach(d => map.set(d.user_id, {
      name: d.name || "Entregador", driverId: d.user_id, totalFees: 0, cashFees: 0, appFees: 0, deliveryCount: 0,
    }));
    financeOrders.forEach(o => {
      if (!o.driver_id) return;
      const entry = map.get(o.driver_id);
      if (!entry) return;
      const fee = o.delivery_fee;
      entry.totalFees = addMoney(entry.totalFees, fee);
      entry.deliveryCount += 1;
      if (o.payment_method === "dinheiro") entry.cashFees = addMoney(entry.cashFees, fee);
      else entry.appFees = addMoney(entry.appFees, fee);
    });
    return Array.from(map.values()).filter(e => e.deliveryCount > 0).sort((a, b) => b.totalFees - a.totalFees);
  }, [financeOrders, drivers]);

  const financeTotals = useMemo(() => {
    const totalVolume = sumMoney(storeSettlement.map((entry) => entry.totalSales));
    const grossProfit = sumMoney(storeSettlement.map((entry) => multiplyMoney(entry.totalSales, 0.15)));
    const totalDriverFees = sumMoney(driverSettlement.map((entry) => entry.appFees));
    return { totalVolume, grossProfit, totalDriverFees };
  }, [storeSettlement, driverSettlement]);

  const storeConciliation = useMemo(() => {
    if (!orders || !stores) return [];
    const map = new Map<string, { name: string; totalSold: number; commission: number; orders: number }>();
    stores.forEach(s => map.set(s.id, { name: s.name, totalSold: 0, commission: 0, orders: 0 }));
    orders.forEach(o => {
      const entry = map.get(o.store_id);
      if (entry) {
        entry.totalSold = addMoney(entry.totalSold, o.total_price);
        entry.commission = addMoney(entry.commission, multiplyMoney(o.subtotal, 0.15));
        entry.orders += 1;
      }
    });
    return Array.from(map.values()).filter(e => e.orders > 0).sort((a, b) => b.totalSold - a.totalSold);
  }, [orders, stores]);

  const hourlyData = useMemo(() => {
    if (!orders) return [];
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, count: 0, revenue: 0 }));
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      hours[h].count += 1;
      hours[h].revenue = addMoney(hours[h].revenue, o.total_price);
    });
    return hours.filter(h => h.count > 0 || (h.hour >= "8h" && h.hour <= "23h"));
  }, [orders]);

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
    let report = `📊 *Relatório ${dateLabel} - ItaSuper*\n\n`;
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
      ? `✅ O ItaSuper deve transferir R$ ${entry.finalBalance.toFixed(2)} para você.`
      : `⚠️ Valor a acertar com o ItaSuper: R$ ${Math.abs(entry.finalBalance).toFixed(2)}.`;
    const msg = `💰 *Fechamento ItaSuper (${period})*\n\nOlá *${entry.name}*!\n\n` +
      `📦 Total de Pedidos: ${entry.orderCount}\n` +
      `💵 Vendas Físicas (Dinheiro/Cartão): R$ ${entry.physicalSales.toFixed(2)}\n` +
      `📱 Vendas App (Pix): R$ ${entry.appSales.toFixed(2)}\n\n` +
      `🏷️ Comissão 15% sobre Físicas: R$ ${entry.commissionDue.toFixed(2)}\n` +
      `💸 Repasse Líquido (App - 15%): R$ ${entry.netTransfer.toFixed(2)}\n\n` +
      `---\n${balanceText}\n---`;
    navigator.clipboard.writeText(msg);
    toast.success(`Extrato de ${entry.name} copiado!`);
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  if (authLoading) return null;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h1>
        <p className="text-sm text-muted-foreground mb-6">Apenas o administrador pode acessar este painel.</p>
        <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl">
          Voltar à Home
        </button>
      </div>
    );
  }

  const filterLabels: Record<DateFilter, string> = { today: "Hoje", yesterday: "Ontem", week: "7 dias" };
  const currentTab = sidebarItems.find(i => i.key === activeTab);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm text-foreground">ItaSuper Admin</h1>
                <p className="text-[10px] text-muted-foreground">Painel Administrativo</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="p-3 space-y-2 border-b border-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-2.5 text-center">
              <p className="text-lg font-black text-primary">{metrics.activeOrders}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Ativos</p>
            </div>
            <div className="bg-accent/50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-black text-foreground">{metrics.totalOrders}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total</p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Vendas</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">R$ {metrics.totalSales.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{filterLabels[dateFilter]}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {["Principal", "Gerenciamento", "Configurações", "Sistema"].map(group => {
            const items = sidebarItems.filter(i => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-1">{group}</p>
                {items.map(item => {
                  const isActive = activeTab === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleTabChange(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.key === "saques" && pendingWithdrawals.length > 0 && (
                        <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                          {pendingWithdrawals.length}
                        </span>
                      )}
                      {item.key === "dashboard" && delayedOrders.length > 0 && (
                        <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {delayedOrders.length}
                        </span>
                      )}
                      {item.key === "dashboard" && complianceAlerts && complianceAlerts.length > 0 && delayedOrders.length === 0 && (
                        <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                          ⚠
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">Lojas</span>
            <span className="text-xs font-bold text-foreground">{stores?.length || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">Entregadores</span>
            <span className="text-xs font-bold text-foreground">{drivers?.length || 0}</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full py-2 rounded-lg text-xs font-bold border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            ← Voltar à Home
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent">
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h2 className="font-bold text-foreground text-lg">{currentTab?.label || "Dashboard"}</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {activeTab === "dashboard" && `${metrics.totalOrders} pedidos no período`}
                {activeTab === "financeiro" && "Gestão financeira e repasses"}
                {activeTab === "saques" && `${pendingWithdrawals.length} solicitações pendentes`}
                {activeTab === "entrega" && "Configurações de taxa de entrega"}
                {activeTab === "approvals" && "Aprovar parceiros e entregadores"}
                {activeTab === "stores" && `${stores?.length || 0} lojas cadastradas`}
                {activeTab === "cidades" && "Lojas por cidade"}
                {activeTab === "coupons" && "Gerenciar cupons de desconto"}
                {activeTab === "sync" && "Sincronização com banco externo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "dashboard" && (
              <button
                onClick={generateReport}
                className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copiar Relatório</span>
              </button>
            )}
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-6xl mx-auto">
            {activeTab === "approvals" && <AdminApprovals />}
            {activeTab === "entrega" && <DeliveryFeeConfigPanel />}
            {activeTab === "sync" && <SyncExternalTab />}
            {activeTab === "coupons" && <CouponManager isAdmin />}
            {activeTab === "stores" && (
              <div className="space-y-6">
                <TestStoreCreator />
                <AdminStoreManager />
              </div>
            )}
            {activeTab === "cidades" && <CidadesTab stores={stores} />}
            {activeTab === "saques" && (
              <SaquesTab
                withdrawalRequests={withdrawalRequests}
                pendingWithdrawals={pendingWithdrawals}
                drivers={drivers}
                queryClient={queryClient}
              />
            )}
            {activeTab === "financeiro" && (
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
            )}
            {activeTab === "dashboard" && (
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
                      <div key={i} className="bg-card rounded-2xl p-4 animate-pulse h-24 border border-border" />
                    ))
                  ) : (
                    <>
                      <MetricCard icon={ShoppingBag} label="Vendas" value={`R$ ${metrics.totalSales.toFixed(2)}`} sublabel={`${metrics.totalOrders} pedidos`} />
                      <MetricCard icon={TrendingUp} label="Sua Comissão" value={`R$ ${metrics.commission.toFixed(2)}`} sublabel="15% do subtotal" highlight />
                      <MetricCard icon={Clock} label="Pedidos Ativos" value={String(metrics.activeOrders)} sublabel="em andamento" />
                      <MetricCard icon={AlertTriangle} label="Em Atraso" value={String(delayedOrders.length)} sublabel="> 60 min" alert={delayedOrders.length > 0} />
                    </>
                  )}
                </div>

                {/* Two-column layout for desktop */}
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
                              name === "count" ? `${value} pedidos` : `R$ ${value.toFixed(2)}`,
                              name === "count" ? "Pedidos" : "Receita"
                            ]}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem dados para o período</p>
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
                        {storeConciliation.map((s, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.orders} pedidos</p>
                            </div>
                            <div className="text-right ml-3">
                              <p className="text-sm font-bold text-foreground">R$ {s.totalSold.toFixed(2)}</p>
                              <p className="text-xs text-primary font-bold">R$ {s.commission.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem vendas no período</p>
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
                                  .from("compliance_alerts" as any)
                                  .update({ is_resolved: true, resolved_at: new Date().toISOString() } as any)
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
                                const { error } = await supabase.from("stores").update({ status: "bloqueado" as any }).eq("id", storeId);
                                if (error) { toast.error("Erro ao suspender."); return; }
                                await supabase
                                  .from("compliance_alerts" as any)
                                  .update({ is_resolved: true, resolved_at: new Date().toISOString() } as any)
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// ─── Finance Tab ───
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
  storeSettlement: any[]; driverSettlement: any[];
  financeTotals: { totalVolume: number; grossProfit: number; totalDriverFees: number };
  financeFilter: "week" | "month"; setFinanceFilter: (f: "week" | "month") => void;
  financeSubTab: "stores" | "drivers"; setFinanceSubTab: (t: "stores" | "drivers") => void;
  selectedStore: string; setSelectedStore: (s: string) => void;
  stores: any[]; loading: boolean; generateStoreWhatsApp: (entry: any) => void;
  storeBalances: any[]; queryClient: any; withdrawalRequests: any[];
}) => {
  const [payingStore, setPayingStore] = useState<string | null>(null);
  const [chargingStore, setChargingStore] = useState<string | null>(null);
  const [showPayoutSettings, setShowPayoutSettings] = useState(false);
  const [showPendingPayouts, setShowPendingPayouts] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingGateway, setSavingGateway] = useState(false);

  const { data: dbGateway } = useQuery({
    queryKey: ["payment-gateway"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings" as any).select("value").eq("key", "payment_gateway").single();
      if (error || !data) return { provider: "MERCADO_PAGO" };
      return (data as any).value as { provider: string };
    },
  });

  const [gatewayProvider, setGatewayProvider] = useState("MERCADO_PAGO");
  useEffect(() => { if (dbGateway) setGatewayProvider((dbGateway as any).provider || "MERCADO_PAGO"); }, [dbGateway]);

  const saveGateway = async (provider: string) => {
    setSavingGateway(true);
    setGatewayProvider(provider);
    const { error } = await supabase
      .from("admin_settings" as any)
      .upsert({ key: "payment_gateway", value: { provider }, updated_at: new Date().toISOString() } as any, { onConflict: "key" });
    if (error) toast.error("Erro ao salvar gateway.");
    else {
      const labels: Record<string, string> = { MERCADO_PAGO: "Mercado Pago", EFI_BANK: "Efí Bank", ASAAS: "Asaas", SIMULATED: "Simulação" };
      toast.success(`✅ Gateway ativo: ${labels[provider] || provider}`);
      queryClient.invalidateQueries({ queryKey: ["payment-gateway"] });
    }
    setSavingGateway(false);
  };

  const { data: dbWithdrawalLimits } = useQuery({
    queryKey: ["withdrawal-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings" as any).select("value").eq("key", "withdrawal_limits").single();
      if (error || !data) return { max_per_week: 1, min_amount: 5 };
      return (data as any).value as { max_per_week: number; min_amount: number };
    },
  });

  const [withdrawalLimits, setWithdrawalLimits] = useState({ max_per_week: 1, min_amount: 5 });
  useEffect(() => { if (dbWithdrawalLimits) setWithdrawalLimits(dbWithdrawalLimits as any); }, [dbWithdrawalLimits]);

  const { data: dbPayoutSchedule } = useQuery({
    queryKey: ["payout-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings" as any).select("value").eq("key", "payout_schedule").single();
      if (error || !data) return { day_of_week: 3, enabled: false };
      return (data as any).value as { day_of_week: number; enabled: boolean };
    },
  });

  const [payoutSchedule, setPayoutSchedule] = useState({ day_of_week: 3, enabled: false });
  useEffect(() => { if (dbPayoutSchedule) setPayoutSchedule(dbPayoutSchedule as any); }, [dbPayoutSchedule]);

  const saveWithdrawalLimits = async () => {
    setSavingLimits(true);
    const { error } = await supabase
      .from("admin_settings" as any)
      .upsert({ key: "withdrawal_limits", value: withdrawalLimits, updated_at: new Date().toISOString() } as any, { onConflict: "key" });
    if (error) toast.error("Erro ao salvar limites.");
    else { toast.success("✅ Limites de saque atualizados!"); queryClient.invalidateQueries({ queryKey: ["withdrawal-limits"] }); }
    setSavingLimits(false);
  };

  const savePayoutSchedule = async (newSchedule: typeof payoutSchedule) => {
    setPayoutSchedule(newSchedule);
    const { error } = await supabase
      .from("admin_settings" as any)
      .upsert({ key: "payout_schedule", value: newSchedule, updated_at: new Date().toISOString() } as any, { onConflict: "key" });
    if (error) toast.error("Erro ao salvar agenda.");
    else {
      const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      toast.success(`📅 Repasse automático: ${newSchedule.enabled ? days[newSchedule.day_of_week] : "Desativado"}`);
      queryClient.invalidateQueries({ queryKey: ["payout-schedule"] });
    }
  };

  const { data: dbPayoutModes } = useQuery({
    queryKey: ["admin-payout-modes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings" as any).select("value").eq("key", "payout_modes").single();
      if (error || !data) return { store_payout: "manual", driver_payout: "manual", admin_commission: "manual" };
      return (data as any).value as Record<string, string>;
    },
  });

  const [payoutModes, setPayoutModes] = useState({ store_payout: "manual", driver_payout: "manual", admin_commission: "manual" });
  useEffect(() => { if (dbPayoutModes) setPayoutModes(dbPayoutModes as any); }, [dbPayoutModes]);

  const { data: payoutHistory } = useQuery({
    queryKey: ["payout-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_history" as any).select("*").order("created_at", { ascending: false }).limit(50);
      if (error) return [];
      return data as any[];
    },
  });

  const togglePayoutMode = async (key: "store_payout" | "driver_payout" | "admin_commission") => {
    const newModes = { ...payoutModes, [key]: payoutModes[key] === "manual" ? "auto" : "manual" };
    setPayoutModes(newModes);
    await supabase
      .from("admin_settings" as any)
      .update({ value: newModes, updated_at: new Date().toISOString() } as any)
      .eq("key", "payout_modes");
    queryClient.invalidateQueries({ queryKey: ["admin-payout-modes"] });
    const label = key === "store_payout" ? "Repasse Lojista" : key === "driver_payout" ? "Repasse Motoboy" : "Comissão Admin";
    const mode = newModes[key] === "auto" ? "Automático" : "Manual";
    toast.success(`${label}: modo ${mode} ativado`);
    if (newModes[key] === "auto") toast.info("✅ Repasse automático via Asaas ativado.", { duration: 5000 });
  };

  const { data: driverBalances } = useQuery({
    queryKey: ["driver-balances-finance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_balances").select("*");
      if (error) return [];
      return data;
    },
  });

  const handleMarkStorePaidManually = async (entry: any) => {
    setMarkingPaid(entry.storeId);
    try {
      const { error } = await supabase
        .from("store_balances")
        .upsert({ store_id: entry.storeId, pending_commission: 0, comissao_pendente: 0, repasse_pendente: 0, updated_at: new Date().toISOString() } as any, { onConflict: "store_id" });
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("payout_history" as any).insert({
        entity_type: "store", entity_id: entry.storeId, entity_name: entry.name,
        amount: entry.netTransfer > 0 ? entry.netTransfer : entry.commissionDue,
        payout_type: "manual",
        notes: `Repasse manual: App R$${entry.netTransfer.toFixed(2)} | Comissão R$${entry.commissionDue.toFixed(2)}`,
        admin_user_id: userData?.user?.id || "",
      } as any);
      toast.success(`✅ ${entry.name} marcado como pago!`);
      queryClient.invalidateQueries({ queryKey: ["store-balances"] });
      queryClient.invalidateQueries({ queryKey: ["payout-history"] });
    } catch { toast.error("Erro ao marcar como pago."); }
    finally { setMarkingPaid(null); }
  };

  const handleMarkDriverPaidManually = async (driverEntry: any) => {
    setMarkingPaid(driverEntry.driverId);
    try {
      const { error } = await supabase
        .from("driver_balances" as any)
        .update({ pending_amount: 0, paid_amount: driverEntry.appFees, updated_at: new Date().toISOString() } as any)
        .eq("driver_user_id", driverEntry.driverId);
      if (error) throw error;
      await supabase.from("driver_earnings" as any).update({ status: "pago" } as any)
        .eq("driver_user_id", driverEntry.driverId).eq("status", "pendente");
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("payout_history" as any).insert({
        entity_type: "driver", entity_id: driverEntry.driverId, entity_name: driverEntry.name,
        amount: driverEntry.appFees, payout_type: "manual",
        notes: `Repasse manual motoboy: R$${driverEntry.appFees.toFixed(2)} (${driverEntry.deliveryCount} entregas)`,
        admin_user_id: userData?.user?.id || "",
      } as any);
      toast.success(`✅ ${driverEntry.name} marcado como pago!`);
      queryClient.invalidateQueries({ queryKey: ["driver-balances-finance"] });
      queryClient.invalidateQueries({ queryKey: ["payout-history"] });
    } catch { toast.error("Erro ao marcar como pago."); }
    finally { setMarkingPaid(null); }
  };

  const [payingDriver, setPayingDriver] = useState<string | null>(null);

  const handleAutoPayDriver = async (driverId: string, driverName: string, amount: number, pixKey: string, pixType: string, withdrawalRequestId?: string) => {
    if (amount <= 0) { toast.info("Não há valor pendente para pagar."); return; }
    if (!pixKey) { toast.error(`❌ ${driverName} não possui chave PIX cadastrada.`); return; }
    setPayingDriver(driverId);
    try {
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: { action: "driver_payout", driver_user_id: driverId, amount, pix_key: pixKey, pix_type: pixType || "cpf", withdrawal_request_id: withdrawalRequestId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.success) toast.success(`✅ R$ ${amount.toFixed(2)} transferido para ${driverName}! Ref: ${data.reference_code}`, { duration: 8000 });
      else toast.warning(`⚠️ ${data?.message || "Transferência falhou."}`, { duration: 10000 });
      queryClient.invalidateQueries({ queryKey: ["driver-balances-finance"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
      queryClient.invalidateQueries({ queryKey: ["payout-history"] });
    } catch (err: any) { toast.error(err.message || "Erro ao processar repasse."); }
    finally { setPayingDriver(null); }
  };

  const { data: driverProfiles } = useQuery({
    queryKey: ["driver-pix-keys", driverSettlement.map(d => d.driverId)],
    queryFn: async () => {
      const driverIds = driverSettlement.map((d: any) => d.driverId);
      if (driverIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, pix_key, pix_type").in("user_id", driverIds);
      return profiles || [];
    },
    enabled: driverSettlement.length > 0,
  });

  const getDriverPixInfo = (driverUserId: string) => driverProfiles?.find((p: any) => p.user_id === driverUserId) || null;

  const pendingStorePayouts = storeSettlement.filter(e => e.netTransfer > 0 || e.commissionDue > 0);
  const pendingDriverPayouts = driverSettlement.filter(e => {
    const bal = driverBalances?.find((b: any) => b.driver_user_id === e.driverId);
    return (bal && Number(bal.pending_amount) > 0) || e.appFees > 0;
  });

  const { data: ownerProfiles } = useQuery({
    queryKey: ["store-owner-pix-keys"],
    queryFn: async () => {
      const storeIds = stores.map((s: any) => s.id);
      if (storeIds.length === 0) return [];
      const { data: storesData } = await supabase.from("stores").select("id, owner_id").in("id", storeIds);
      if (!storesData) return [];
      const ownerIds = storesData.map(s => s.owner_id).filter(Boolean);
      if (ownerIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, pix_key, pix_type").in("user_id", ownerIds as string[]);
      return (storesData || []).map(s => ({
        storeId: s.id, ownerId: s.owner_id,
        pixKey: profiles?.find(p => p.user_id === s.owner_id)?.pix_key || null,
        pixType: profiles?.find(p => p.user_id === s.owner_id)?.pix_type || null,
      }));
    },
    enabled: stores.length > 0,
  });

  const getStorePixInfo = (storeId: string) => ownerProfiles?.find((p: any) => p.storeId === storeId) || null;

  const markAsPaid = async (storeId: string, storeName: string) => {
    const { error } = await supabase
      .from("store_balances")
      .upsert({ store_id: storeId, pending_commission: 0, comissao_pendente: 0, updated_at: new Date().toISOString() } as any, { onConflict: "store_id" });
    if (error) toast.error("Erro ao marcar como pago.");
    else { toast.success(`✅ Saldo de ${storeName} zerado!`); queryClient.invalidateQueries({ queryKey: ["store-balances"] }); }
  };

  const handleAdminPayout = async (entry: any) => {
    if (entry.netTransfer <= 0) { toast.info("Não há repasse pendente."); return; }
    const pixInfo = getStorePixInfo(entry.storeId);
    if (!pixInfo?.pixKey) { toast.error(`❌ "${entry.name}" não cadastrou chave Pix.`); return; }
    setPayingStore(entry.storeId);
    try {
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: { action: "store_payout", store_id: entry.storeId, amount: entry.netTransfer, pix_key: pixInfo.pixKey, pix_type: pixInfo.pixType || "cpf" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.status === "manual_required") toast.info(`${data.reference_code}: PIX manual: ${data.pix_key} - R$ ${data.amount.toFixed(2)}`, { duration: 15000 });
      else {
        const providerLabel = data?.provider === "efi_bank" ? "Efí Bank" : data?.provider === "asaas" ? "Asaas" : data?.provider === "simulated" ? "Simulação" : "Mercado Pago";
        toast.success(`${data.reference_code}: R$ ${data.amount.toFixed(2)} enviado via ${providerLabel}!`);
      }
      queryClient.invalidateQueries({ queryKey: ["store-balances"] });
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
    } catch (err: any) { toast.error(err.message || "Erro ao processar repasse."); }
    finally { setPayingStore(null); }
  };

  const handleChargeCommission = async (entry: any) => {
    const balance = storeBalances.find((b: any) => b.store_id === entry.storeId);
    const chargeAmount = Number(balance?.comissao_pendente || balance?.pending_commission || entry.commissionDue);
    if (chargeAmount <= 0) { toast.info("Não há comissões pendentes."); return; }
    setChargingStore(entry.storeId);
    try {
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: { action: "commission_charge", store_id: entry.storeId, amount: chargeAmount, description: `Comissão ItaSuper - ${entry.name}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const pixCode = data?.pix_code || data?.qr_code;
      if (pixCode) {
        navigator.clipboard.writeText(pixCode);
        const providerLabel = data?.provider === "efi_bank" ? "Efí Bank" : data?.provider === "asaas" ? "Asaas" : data?.provider === "simulated" ? "Simulação" : "Mercado Pago";
        toast.success(`${data.reference_code}: Cobrança PIX via ${providerLabel}! R$ ${Number(data.amount || chargeAmount).toFixed(2)}`, { duration: 10000 });
      } else toast.success(`${data.reference_code}: Cobrança registrada. R$ ${Number(data.amount || chargeAmount).toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ["store-balances"] });
    } catch (err: any) { toast.error(err.message || "Erro ao gerar cobrança."); }
    finally { setChargingStore(null); }
  };

  return (
    <div className="space-y-4">
      {/* Period filter + Settings */}
      <div className="flex gap-2 items-center flex-wrap">
        {(["week", "month"] as const).map(f => (
          <button key={f} onClick={() => setFinanceFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${financeFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {f === "week" ? "📅 Semana" : "📅 Mês"}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setShowPayoutSettings(!showPayoutSettings)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${showPayoutSettings ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          <Settings className="h-3.5 w-3.5" /> Modo Repasse
        </button>
      </div>

      {/* Payout Settings */}
      {showPayoutSettings && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Configurações de Repasse
          </h3>
          
          {/* Gateway */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gateway de Pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "MERCADO_PAGO", label: "Mercado Pago" },
                { key: "EFI_BANK", label: "Efí Bank" },
                { key: "ASAAS", label: "Asaas" },
                { key: "SIMULATED", label: "Simulação" },
              ].map(gw => (
                <button key={gw.key} onClick={() => saveGateway(gw.key)} disabled={savingGateway}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${gatewayProvider === gw.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {gw.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payout modes */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Modo de Repasse</p>
            {[
              { key: "store_payout" as const, label: "Repasse Lojista", icon: Store },
              { key: "driver_payout" as const, label: "Repasse Motoboy", icon: Bike },
              { key: "admin_commission" as const, label: "Comissão Admin", icon: DollarSign },
            ].map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{payoutModes[key] === "auto" ? "Auto" : "Manual"}</span>
                  <Switch checked={payoutModes[key] === "auto"} onCheckedChange={() => togglePayoutMode(key)} />
                </div>
              </div>
            ))}
          </div>

          {/* Withdrawal limits */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Limites de Saque</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Máx/semana</label>
                <input type="number" value={withdrawalLimits.max_per_week}
                  onChange={e => setWithdrawalLimits(p => ({ ...p, max_per_week: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor mínimo</label>
                <input type="number" value={withdrawalLimits.min_amount}
                  onChange={e => setWithdrawalLimits(p => ({ ...p, min_amount: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <button onClick={saveWithdrawalLimits} disabled={savingLimits}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
              {savingLimits ? "Salvando..." : "Salvar Limites"}
            </button>
          </div>

          {/* Payout schedule */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agenda Automática</p>
            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
              <span className="text-sm text-foreground">Repasse automático</span>
              <Switch checked={payoutSchedule.enabled} onCheckedChange={(checked) => savePayoutSchedule({ ...payoutSchedule, enabled: checked })} />
            </div>
            {payoutSchedule.enabled && (
              <select value={payoutSchedule.day_of_week}
                onChange={e => savePayoutSchedule({ ...payoutSchedule, day_of_week: Number(e.target.value) })}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
                {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Pending Payouts */}
      <div className="space-y-3">
        <button onClick={() => setShowPendingPayouts(!showPendingPayouts)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-colors ${showPendingPayouts ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:bg-accent"}`}>
          <span className="flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Repasses Pendentes ({pendingStorePayouts.length + pendingDriverPayouts.length})
          </span>
          <span className="text-xs">{showPendingPayouts ? "▲" : "▼"}</span>
        </button>

        {showPendingPayouts && (
          <div className="space-y-3">
            {pendingStorePayouts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1">🏪 Lojistas</p>
                {pendingStorePayouts.map((entry) => {
                  const balance = storeBalances.find((b: any) => b.store_id === entry.storeId);
                  const dbComissao = Number((balance as any)?.comissao_pendente || 0);
                  return (
                    <div key={entry.storeId} className="bg-card rounded-xl p-3 space-y-2 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">{entry.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{entry.orderCount} pedidos</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-green-500/10 rounded-lg p-2 text-center">
                          <p className="text-green-500 text-[10px]">A Pagar (85%)</p>
                          <p className="text-sm font-bold text-green-500">R$ {entry.netTransfer.toFixed(2)}</p>
                        </div>
                        <div className="bg-destructive/10 rounded-lg p-2 text-center">
                          <p className="text-destructive text-[10px]">A Receber (15%)</p>
                          <p className="text-sm font-bold text-destructive">R$ {(dbComissao > 0 ? dbComissao : entry.commissionDue).toFixed(2)}</p>
                        </div>
                      </div>
                      <button onClick={() => handleMarkStorePaidManually(entry)} disabled={markingPaid === entry.storeId}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-30 text-primary-foreground py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                        {markingPaid === entry.storeId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Marcar como Pago
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {pendingDriverPayouts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1">🛵 Motoboys</p>
                {pendingDriverPayouts.map((entry) => {
                  const driverPix = getDriverPixInfo(entry.driverId);
                  return (
                    <div key={entry.driverId} className="bg-card rounded-xl p-3 space-y-2 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bike className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">{entry.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{entry.deliveryCount} entregas</span>
                      </div>
                      <div className="bg-amber-500/10 rounded-lg p-2 text-center">
                        <p className="text-amber-500 text-[10px]">A Pagar (Entrega App)</p>
                        <p className="text-sm font-bold text-amber-500">R$ {entry.appFees.toFixed(2)}</p>
                      </div>
                      {driverPix?.pix_key && (
                        <div className="bg-muted rounded-lg p-2 flex items-center gap-2">
                          <Wallet className="h-3 w-3 text-green-500 flex-shrink-0" />
                          <p className="text-[10px] text-muted-foreground truncate">PIX: {driverPix.pix_key} ({driverPix.pix_type})</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleAutoPayDriver(entry.driverId, entry.name, entry.appFees, driverPix?.pix_key || "", driverPix?.pix_type || "cpf")}
                          disabled={payingDriver === entry.driverId || !driverPix?.pix_key}
                          className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-30 text-white py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                          {payingDriver === entry.driverId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          Pagar via Asaas
                        </button>
                        <button onClick={() => handleMarkDriverPaidManually(entry)} disabled={markingPaid === entry.driverId}
                          className="flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-30 text-primary-foreground py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                          {markingPaid === entry.driverId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Manual
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pendingStorePayouts.length === 0 && pendingDriverPayouts.length === 0 && (
              <div className="bg-card rounded-xl p-6 text-center border border-border">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum repasse pendente!</p>
              </div>
            )}

            {payoutHistory && payoutHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1">📋 Histórico</p>
                {payoutHistory.slice(0, 10).map((h: any) => (
                  <div key={h.id} className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {h.entity_type === "store" ? <Store className="h-3.5 w-3.5 text-primary flex-shrink-0" /> : <Bike className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{h.entity_name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-xs font-bold text-green-500">R$ {Number(h.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{h.payout_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Finance summary cards */}
      {(() => {
        const pendingDriverAmount = sumMoney((withdrawalRequests || [])
          .filter((w: any) => w.status === "solicitado")
          .map((w: any) => w.amount));
        const paidDriverAmount = sumMoney((withdrawalRequests || [])
          .filter((w: any) => w.status === "pago")
          .map((w: any) => w.amount));
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Volume Total</span>
              </div>
              <p className="text-lg font-black text-foreground">R$ {financeTotals.totalVolume.toFixed(2)}</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Lucro Bruto</span>
              </div>
              <p className="text-lg font-black text-primary">R$ {financeTotals.grossProfit.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">15% comissões</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <Bike className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Motoboys (Pend.)</span>
              </div>
              <p className="text-lg font-black text-amber-500">R$ {pendingDriverAmount.toFixed(2)}</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Motoboys (Pago)</span>
              </div>
              <p className="text-lg font-black text-green-500">R$ {paidDriverAmount.toFixed(2)}</p>
            </div>
          </div>
        );
      })()}

      {/* Sub-tabs: Stores vs Drivers */}
      <div className="flex gap-2">
        <button onClick={() => setFinanceSubTab("stores")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${financeSubTab === "stores" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          🏪 Lojas
        </button>
        <button onClick={() => setFinanceSubTab("drivers")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${financeSubTab === "drivers" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          🛵 Entregadores
        </button>
      </div>

      {/* Store filter */}
      {financeSubTab === "stores" && (
        <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
          className="w-full bg-card text-foreground border border-border rounded-xl px-4 py-2.5 text-sm">
          <option value="all">Todas as lojas</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : financeSubTab === "stores" ? (
        storeSettlement.length > 0 ? (
          <div className="space-y-3">
            {storeSettlement.map((entry, i) => {
              const balance = storeBalances.find((b: any) => b.store_id === entry.storeId);
              const dbComissao = Number((balance as any)?.comissao_pendente || balance?.pending_commission || 0);
              return (
                <div key={i} className="bg-card rounded-2xl p-4 space-y-3 border border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">{entry.name}</h3>
                    <span className="text-xs text-muted-foreground">{entry.orderCount} pedidos</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-xl p-2.5">
                      <p className="text-muted-foreground">💵 Vendas Físicas</p>
                      <p className="text-sm font-bold text-foreground">R$ {entry.physicalSales.toFixed(2)}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-2.5">
                      <p className="text-muted-foreground">📱 Vendas App</p>
                      <p className="text-sm font-bold text-foreground">R$ {entry.appSales.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <ArrowUpRight className="h-3 w-3 text-green-500" />
                        <p className="text-green-500 font-bold">A Pagar (85%)</p>
                      </div>
                      <p className="text-lg font-black text-green-500">R$ {entry.netTransfer.toFixed(2)}</p>
                    </div>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                        <p className="text-destructive font-bold">A Receber (15%)</p>
                      </div>
                      <p className="text-lg font-black text-destructive">R$ {(dbComissao > 0 ? dbComissao : entry.commissionDue).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="bg-muted rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">SALDO LÍQUIDO</p>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <p className="text-[10px] text-green-500">Crédito</p>
                        <p className="text-sm font-bold text-green-500">R$ {(dbComissao > 0 ? dbComissao : entry.commissionDue).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-destructive">Débito</p>
                        <p className="text-sm font-bold text-destructive">R$ {entry.netTransfer.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-foreground">Total</p>
                        <p className={`text-sm font-black ${entry.finalBalance >= 0 ? "text-green-500" : "text-destructive"}`}>
                          {entry.finalBalance >= 0 ? "+" : "-"}R$ {Math.abs(entry.finalBalance).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleAdminPayout(entry)} disabled={payingStore === entry.storeId || entry.netTransfer <= 0}
                      className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-30 text-white py-3 rounded-xl text-xs font-bold active:scale-95 transition-all">
                      {payingStore === entry.storeId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      Pagar Lojista
                    </button>
                    <button onClick={() => handleChargeCommission(entry)} disabled={chargingStore === entry.storeId || (entry.commissionDue <= 0 && dbComissao <= 0)}
                      className="flex items-center justify-center gap-1.5 bg-destructive hover:bg-destructive/90 disabled:opacity-30 text-destructive-foreground py-3 rounded-xl text-xs font-bold active:scale-95 transition-all">
                      {chargingStore === entry.storeId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                      Gerar Cobrança
                    </button>
                  </div>
                  {(() => {
                    const pixInfo = getStorePixInfo(entry.storeId);
                    return pixInfo?.pixKey ? (
                      <div className="bg-muted rounded-xl p-2.5 flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground">Chave PIX</p>
                          <p className="text-xs text-foreground truncate">{pixInfo.pixKey}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase">{pixInfo.pixType}</span>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        <p className="text-[10px] text-amber-500 font-bold">Sem chave PIX cadastrada</p>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <button onClick={() => generateStoreWhatsApp(entry)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 text-green-500 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      <Copy className="h-3.5 w-3.5" /> Extrato WhatsApp
                    </button>
                    <button onClick={() => markAsPaid(entry.storeId, entry.name)}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Marcar Pago
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Sem vendas finalizadas no período</p>
          </div>
        )
      ) : (
        driverSettlement.length > 0 ? (
          <div className="space-y-3">
            {driverSettlement.map((entry, i) => {
              const driverPending = withdrawalRequests
                .filter((w: any) => w.driver_user_id === entry.driverId && w.status === "solicitado")
                .map((w: any) => w.amount);
              const driverPaid = withdrawalRequests
                .filter((w: any) => w.driver_user_id === entry.driverId && w.status === "pago")
                .map((w: any) => w.amount);
              const driverPendingAmount = sumMoney(driverPending);
              const driverPaidAmount = sumMoney(driverPaid);
              return (
                <div key={i} className="bg-card rounded-2xl p-4 space-y-3 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Bike className="h-4 w-4 text-green-500" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">{entry.name}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.deliveryCount} entregas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-xl p-2.5 text-center">
                      <p className="text-muted-foreground">💵 Em mãos</p>
                      <p className="text-sm font-bold text-amber-500">R$ {entry.cashFees.toFixed(2)}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-2.5 text-center">
                      <p className="text-muted-foreground">📱 Total App</p>
                      <p className="text-sm font-bold text-foreground">R$ {entry.appFees.toFixed(2)}</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-xl p-2.5 text-center border border-amber-500/20">
                      <p className="text-amber-500">⏳ A Receber</p>
                      <p className="text-sm font-bold text-amber-500">R$ {Math.max(0, subtractMoney(entry.appFees, driverPaidAmount)).toFixed(2)}</p>
                    </div>
                    <div className="bg-green-500/10 rounded-xl p-2.5 text-center border border-green-500/20">
                      <p className="text-green-500">✅ Já Pago</p>
                      <p className="text-sm font-bold text-green-500">R$ {driverPaidAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <Bike className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Sem entregas finalizadas no período</p>
          </div>
        )
      )}
    </div>
  );
};

// ─── Metric Card ───
const MetricCard = ({ icon: Icon, label, value, sublabel, highlight, alert }: {
  icon: React.ElementType; label: string; value: string; sublabel: string; highlight?: boolean; alert?: boolean;
}) => (
  <div className={`bg-card rounded-2xl p-4 border ${alert ? "border-destructive/50" : "border-border"}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${highlight ? "text-primary" : alert ? "text-destructive" : "text-muted-foreground"}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className={`text-xl font-black ${highlight ? "text-primary" : alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
    <p className="text-xs text-muted-foreground">{sublabel}</p>
  </div>
);

// ─── Saques Tab ───
const SaquesTab = ({ withdrawalRequests, pendingWithdrawals, drivers, queryClient }: {
  withdrawalRequests: any[] | undefined; pendingWithdrawals: any[]; drivers: any[] | undefined; queryClient: any;
}) => {
  const [saquesSubTab, setSaquesSubTab] = useState<"pendentes" | "historico">("pendentes");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingList = (withdrawalRequests || []).filter((w: any) => w.status === "solicitado")
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const historyList = (withdrawalRequests || []).filter((w: any) => w.status !== "solicitado")
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleDelete = async (req: any) => {
    if (deletingId === req.id) {
      const { error } = await supabase.from("withdrawal_requests" as any).delete().eq("id", req.id);
      if (error) toast.error("Erro ao excluir.");
      else toast.success(`🗑️ Solicitação excluída.`);
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
    } else {
      setDeletingId(req.id);
      setTimeout(() => setDeletingId(null), 4000);
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
    await supabase.from("driver_earnings" as any).update({ status: "pago" } as any)
      .eq("driver_user_id", req.driver_user_id).eq("status", "pendente");
    toast.success(`✅ R$ ${Number(req.amount).toFixed(2)} para ${driverName} confirmada!`);
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
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPending ? "bg-amber-500/20" : isPaid ? "bg-green-500/20" : "bg-destructive/20"}`}>
              <DollarSign className={`h-4 w-4 ${isPending ? "text-amber-500" : isPaid ? "text-green-500" : "text-destructive"}`} />
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
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isPending ? "bg-amber-500/20 text-amber-500" : isPaid ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive"}`}>
              {isPending ? "Pendente" : isPaid ? "✅ Pago" : "Cancelado"}
            </span>
            <button onClick={() => handleDelete(req)}
              className={`p-2 rounded-lg transition-colors ${deletingId === req.id ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
              title={deletingId === req.id ? "Clique para confirmar" : "Excluir"}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {deletingId === req.id && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-3 text-center">
            <p className="text-xs text-destructive font-medium">Deseja excluir? Clique na 🗑️ novamente.</p>
          </div>
        )}
        <div className="bg-muted rounded-xl p-3 space-y-1 mb-3">
          <p className="text-xs text-muted-foreground">Entregador: <span className="text-foreground font-medium">{driverName}</span></p>
          <p className="text-xs text-muted-foreground">Valor: <span className="text-foreground font-bold">R$ {Number(req.amount).toFixed(2)}</span></p>
          <p className="text-xs text-muted-foreground">PIX: <span className="text-foreground font-medium">{req.pix_key}</span></p>
          <p className="text-xs text-muted-foreground">Tipo: <span className="text-foreground font-medium">{req.pix_type?.toUpperCase()}</span></p>
          {req.processed_at && (
            <p className="text-xs text-muted-foreground">Processado: <span className="text-foreground font-medium">
              {new Date(req.processed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span></p>
          )}
        </div>
        {isPending && (
          <button onClick={() => handleConfirmPayment(req, driverName)}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform">
            <CheckCircle2 className="h-4 w-4" /> Confirmar Pagamento
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Bell className="h-4 w-4" /> Solicitações de Saque
          </h2>
          <button onClick={async () => {
            const { data, error } = await supabase.rpc("admin_cleanup_duplicate_withdrawals");
            if (error) { toast.error("Erro ao limpar."); return; }
            toast.success(`${Number(data || 0)} duplicata(s) removida(s).`);
            queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
          }} className="px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold">
            Limpar Duplicatas
          </button>
        </div>
        <div className="flex gap-2">
          {[
            { key: "pendentes" as const, label: `⏳ Pendentes (${pendingList.length})` },
            { key: "historico" as const, label: `📋 Histórico (${historyList.length})` },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setSaquesSubTab(tab.key)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-colors ${
                saquesSubTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
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
        ) : <div className="space-y-3">{pendingList.map(renderCard)}</div>
      ) : historyList.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center border border-border">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum saque no histórico.</p>
        </div>
      ) : <div className="space-y-3">{historyList.map(renderCard)}</div>}
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
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-external", { body: { action: "test_connection" } });
      if (error) throw error;
      setTestResult({ success: data?.success ?? false, message: data?.message || "Sem resposta" });
      if (data?.success) toast.success("Conexão confirmada!");
      else toast.error(data?.message || "Falha na conexão");
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Erro desconhecido" });
      toast.error("Erro ao testar conexão");
    } finally { setTesting(false); }
  };

  const handleSyncStores = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-external", { body: { action: "sync_stores" } });
      if (error) throw error;
      setSyncResult(data?.results || {});
      if (data?.success) toast.success("Sincronizado!");
      else toast.warning("Concluído com erros.");
    } catch (err: any) { toast.error(err?.message || "Erro ao sincronizar"); }
    finally { setSyncing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" /> Sincronização Externa
        </h2>
        <p className="text-sm text-muted-foreground">
          Envie dados para seu banco externo. Certifique-se de que os Secrets estão configurados.
        </p>
        <div className="space-y-2">
          <button onClick={handleTestConnection} disabled={testing}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {testing ? "Testando..." : "Teste de Conexão"}
          </button>
          {testResult && (
            <div className={`p-3 rounded-xl text-sm font-medium ${testResult.success ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
              {testResult.success ? "✅" : "❌"} {testResult.message}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <button onClick={handleSyncStores} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-bold py-3 rounded-xl disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {syncing ? "Sincronizando..." : "Sincronizar Dados"}
          </button>
          {syncResult && (
            <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
              {Object.entries(syncResult).map(([table, info]) => (
                <div key={table} className="flex justify-between">
                  <span className="font-medium text-foreground">{table}</span>
                  <span className={info.error ? "text-destructive" : "text-green-500"}>
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

// ── Cities Tab ──
const CidadesTab = ({ stores }: { stores: any[] | undefined }) => {
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const PLATFORM_CITIES = ["itatinga"];

  const cityData = useMemo(() => {
    if (!stores) return [];
    const map = new Map<string, { stores: any[]; displayName: string }>();
    stores.forEach((s: any) => {
      const rawCity = s.address_city || "Itatinga";
      const key = rawCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      if (!map.has(key)) {
        map.set(key, { stores: [], displayName: rawCity });
      }
      map.get(key)!.stores.push(s);
    });
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => b.stores.length - a.stores.length);
  }, [stores]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-1">Cidades Cadastradas</h3>
        <p className="text-xs text-muted-foreground mb-4">{cityData.length} cidades com lojas registradas</p>
        
        <div className="space-y-3">
          {cityData.map((c) => {
            const isPlatform = PLATFORM_CITIES.includes(c.key);
            const activeStores = c.stores.filter((s: any) => s.status === "ativo").length;
            const isExpanded = expandedCity === c.key;
            return (
              <div key={c.key} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedCity(isExpanded ? null : c.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{c.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.stores.length} loja{c.stores.length !== 1 ? "s" : ""} • {activeStores} ativa{activeStores !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPlatform ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-full font-bold">✅ Plataforma</span>
                    ) : (
                      <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full font-bold">📱 Cardápio Digital</span>
                    )}
                    {isExpanded ? <X className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-2 bg-muted/30">
                    {c.stores.map((store: any) => (
                      <div key={store.id} className="flex items-center justify-between p-2 rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{store.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            store.status === "ativo" ? "bg-emerald-500/10 text-emerald-600" :
                            store.status === "analise" ? "bg-amber-500/10 text-amber-600" :
                            "bg-red-500/10 text-red-600"
                          }`}>
                            {store.status === "ativo" ? "Ativa" : store.status === "analise" ? "Em Análise" : "Bloqueada"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {store.delivery_mode === "own" ? "Motoboy Próprio" : "Plataforma"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {cityData.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma loja cadastrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
