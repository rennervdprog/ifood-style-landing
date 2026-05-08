import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminApprovals from "@/components/AdminApprovals";
import CouponManager from "@/components/CouponManager";
import AdminStoreManager from "@/components/AdminStoreManager";
import DeliveryFeeConfigPanel from "@/components/DeliveryFeeConfig";
import TestStoreCreator from "@/components/TestStoreCreator";
import AdminPlanManager from "@/components/AdminPlanManager";
import AdminFixedPlanReceivables from "@/components/AdminFixedPlanReceivables";
import AdminPlanTemplatesEditor from "@/components/AdminPlanTemplatesEditor";
import ModeratorManager from "@/components/ModeratorManager";
import PartnerSplitPanel from "@/components/PartnerSplitPanel";
import FixedPlanBillingHistory from "@/components/FixedPlanBillingHistory";
import TestStoreFinancePanel from "@/components/TestStoreFinancePanel";
import AppLinksManager from "@/components/AppLinksManager";
import AdminBroadcastPush from "@/components/AdminBroadcastPush";
import PageViewsCard from "@/components/PageViewsCard";
import { AdminSubaccountsTab } from "@/components/AdminSubaccountsTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Clock,
  Store, Copy, AlertTriangle, Users, Bike, Wallet, CheckCircle2, Banknote, XCircle, Bell, Trash2, QrCode, Loader2, ArrowUpRight, ArrowDownRight, Settings,
   LayoutDashboard, Shield, Ticket, RefreshCw, Truck, Menu, X, MapPin, Eye, Scale, Search, FileText, Mail, Phone, User, Download, Calendar, CreditCard, Receipt, ChevronDown, ChevronUp, Percent, Crown, Handshake, FlaskConical, Link as LinkIcon, Megaphone, Monitor
} from "lucide-react";
 import { Switch } from "@/components/ui/switch";
 import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  DailySalesChart, PaymentBreakdownChart, HourlyChart, KpiCard,
  useFinanceChartData, CHART_COLORS, ChannelCompareChart,
} from "@/components/FinanceCharts";
 import { addMoney, multiplyMoney, subtractMoney, sumMoney, formatBRL } from "@/lib/utils";
 import { statusColors as globalStatusColors } from "@/lib/orderStatus";

type DateFilter = "today" | "yesterday" | "week";
 type AdminTab = "dashboard" | "approvals" | "stores" | "financeiro" | "pagamentos" | "saques" | "sync" | "coupons" | "entrega" | "cidades" | "juridico" | "planos" | "moderadores" | "socios" | "test_finance" | "links" | "broadcast" | "logs";

const sidebarItems: { key: AdminTab; label: string; icon: React.ElementType; group: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Principal" },
  { key: "planos", label: "Planos", icon: Crown, group: "Principal" },
  { key: "financeiro", label: "Financeiro", icon: DollarSign, group: "Principal" },
  { key: "pagamentos", label: "Pagamentos", icon: CreditCard, group: "Principal" },
  { key: "saques", label: "Saques", icon: Wallet, group: "Principal" },
  { key: "entrega", label: "Entrega", icon: Truck, group: "Configurações" },
  { key: "approvals", label: "Aprovações", icon: Shield, group: "Gerenciamento" },
  { key: "stores", label: "Lojas", icon: Store, group: "Gerenciamento" },
  { key: "cidades", label: "Cidades", icon: MapPin, group: "Gerenciamento" },
  { key: "coupons", label: "Cupons", icon: Ticket, group: "Gerenciamento" },
  { key: "moderadores", label: "Moderadores", icon: Users, group: "Gerenciamento" },
  { key: "socios", label: "Sócios", icon: Handshake, group: "Principal" },
  { key: "juridico", label: "Jurídico", icon: Scale, group: "Sistema" },
  { key: "test_finance", label: "Finanças Teste", icon: FlaskConical, group: "Sistema" },
  { key: "links", label: "Página /links", icon: LinkIcon, group: "Sistema" },
  { key: "broadcast", label: "Notificações", icon: Megaphone, group: "Sistema" },
  { key: "sync", label: "Sincronizar", icon: RefreshCw, group: "Sistema" },
  { key: "logs", label: "Logs", icon: FileText, group: "Sistema" },
];

 import { FinanceTab as FinanceTabFull, MetricCard } from "./SuperAdminDashboard";

 const SuperAdminDashboardV2 = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [financeFilter, setFinanceFilter] = useState<"week" | "month">("week");
  const [financeSubTab, setFinanceSubTab] = useState<"stores" | "drivers" | "subaccounts">("stores");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    let start: Date;
    switch (filter) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "yesterday":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(
          now.getFullYear(), now.getMonth(), now.getDate()
        );
        return {
          start: start.toISOString(),
          end: endOfYesterday.toISOString()
        };
      case "week":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
    }
    return { start: start!.toISOString(), end: new Date().toISOString() };
  };

  const getFinanceDateRange = () => {
    const now = new Date();
    const days = financeFilter === "week" ? 7 : 30;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
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

  // First: get IDs of test stores so we can filter them out everywhere
  const { data: testStoreIds = [] } = useQuery({
    queryKey: ["admin-test-store-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id").eq("is_test", true);
      if (error) throw error;
      return (data || []).map((s: any) => s.id as string);
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-all-orders", dateFilter, testStoreIds.join(",")],
    queryFn: async () => {
      const { start, end } = getDateRange(dateFilter);
      let query = supabase
        .from("orders")
        .select("*, stores(name, id)")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: financeOrders, isLoading: financeLoading } = useQuery({
    queryKey: ["finance-orders", financeFilter, testStoreIds.join(",")],
    queryFn: async () => {
      const { start, end } = getFinanceDateRange();
      let query = supabase
        .from("orders")
        .select("*, stores(name, id), order_items(quantity, unit_price), order_source")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("status", ["finalizado", "entregue"])
        .order("created_at", { ascending: false });
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  const { data: adminLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*, profiles:admin_user_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    enabled: isAdmin && activeTab === "logs",
  });

  const { data: stores } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      // 🔒 SELECT específico — evita trazer asaas_wallet_id, asaas_account_id etc.
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, status, commission_rate, delivery_mode, address_city, address_cep, owner_id, is_test, settings, delivery_fee_type, own_delivery_fee");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  const { data: drivers } = useQuery({
    queryKey: ["admin-all-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("user_id, name, is_active");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    staleTime: 2 * 60 * 1000,
  });

  const { data: storeBalances } = useQuery({
    queryKey: ["store-balances", testStoreIds.join(",")],
    queryFn: async () => {
      let query = supabase.from("store_balances").select("*");
      if (testStoreIds.length > 0) query = query.not("store_id", "in", `(${testStoreIds.join(",")})`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && activeTab === "financeiro",
  });

  const { data: parentStorePlans } = useQuery({
    // 🔒 queryKey unificada — storePlans (linha ~1200) foi removida e usa esta mesma cache
    queryKey: ["admin-store-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_plans").select("*").eq("is_active", true);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutos — planos mudam pouco
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

  // Pending approvals (lojistas / motoboys awaiting admin approval)
  const { data: pendingApprovals } = useQuery({
    queryKey: ["admin-pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, role, is_approved, created_at")
        .in("role", ["lojista", "motoboy"])
        .eq("is_approved", false);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });
  const pendingApprovalsCount = pendingApprovals?.length ?? 0;

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

  // Realtime: notify admin when a new lojista/motoboy registers (pending approval)
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-approvals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload: any) => {
          const role = payload?.new?.role;
          const approved = payload?.new?.is_approved;
          if ((role === "lojista" || role === "motoboy") && approved === false) {
            queryClient.invalidateQueries({ queryKey: ["admin-pending-approvals"] });
            const name = payload?.new?.full_name || "Novo cadastro";
            const label = role === "lojista" ? "lojista" : "entregador";
            toast.info(`🔔 Novo ${label} aguardando aprovação: ${name}`, {
              duration: 10000,
              action: { label: "Ver", onClick: () => setActiveTab("approvals") },
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-pending-approvals"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, queryClient]);

  const getStoreRate = (storeId: string) => {
    const plan = parentStorePlans?.find((p: any) => p.store_id === storeId);
    if (plan) {
      if (plan.plan_type === "fixed") return 0;
      // Garante que a taxa nunca ultrapasse 10% por segurança
      const rate = Number(plan.commission_rate ?? 5);
      const saferate = Math.min(rate, 10);
      return saferate / 100;
    }
    const store = stores?.find((s: any) => s.id === storeId);
    return (Math.min(Number((store as any)?.commission_rate ?? 5), 10)) / 100;
  };

  const metrics = useMemo(() => {
    if (!orders) return { totalSales: 0, commission: 0, commissionDelivery: 0, commissionPdv: 0, activeOrders: 0, totalOrders: 0 };
    const billableOrders = orders.filter(o => !["cancelado", "aguardando_pagamento"].includes(o.status));
    const totalSales = sumMoney(billableOrders.map((order) => order.total_price));

    // Separar pedidos por canal
    const deliveryOrders = billableOrders.filter(o => (o as any).order_source !== "pdv");
    const pdvOrders = billableOrders.filter(o => (o as any).order_source === "pdv");

    // Comissão DELIVERY: usa taxa histórica salva no pedido (commission_rate)
    // fallback para getStoreRate para pedidos antigos sem o campo
    const commissionDelivery = sumMoney(deliveryOrders.map((order) => {
      const saved = Number((order as any).commission_rate ?? 0);
      if (saved > 0) return multiplyMoney(order.subtotal, saved / 100);
      return multiplyMoney(order.subtotal, getStoreRate(order.store_id));
    }));

    // Comissão PDV: usa commission_rate do pedido (que é pdv_commission_rate, menor)
    const commissionPdv = sumMoney(pdvOrders.map((order) => {
      const saved = Number((order as any).commission_rate ?? 0);
      return multiplyMoney(order.subtotal, saved / 100);
    }));

    const commission = addMoney(commissionDelivery, commissionPdv);
    const activeStatuses = ["pendente", "preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"];
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    return { totalSales, commission, commissionDelivery, commissionPdv, activeOrders, totalOrders: billableOrders.length };
  }, [orders, stores, parentStorePlans]);

  // Hook unificado de gráficos (mesma lógica do lojista)
  const adminChartData = useFinanceChartData(orders || []);

  const storeSettlement = useMemo(() => {
    if (!financeOrders || !stores) return [];
    const map = new Map<string, {
      name: string; storeId: string; physicalSales: number; appSales: number; totalSales: number;
      commissionDue: number; netTransfer: number; finalBalance: number; orderCount: number; deliveryFees: number;
      // PDV separado
      pdvSales: number; pdvOrders: number; pdvCommission: number;
    }>();
    stores.forEach(s => map.set(s.id, {
      name: s.name, storeId: s.id, physicalSales: 0, appSales: 0, totalSales: 0,
      commissionDue: 0, netTransfer: 0, finalBalance: 0, orderCount: 0, deliveryFees: 0,
      pdvSales: 0, pdvOrders: 0, pdvCommission: 0,
    }));
    const filtered = selectedStore === "all" ? financeOrders : financeOrders.filter(o => o.store_id === selectedStore);
    filtered.forEach(o => {
      const entry = map.get(o.store_id);
      if (!entry) return;
      const subtotal = o.subtotal;
      const deliveryFee = o.delivery_fee;
      const isPdv = (o as any).order_source === "pdv";

      if (isPdv) {
        // PDV: canal separado
        entry.pdvSales = addMoney(entry.pdvSales, subtotal);
        entry.pdvOrders += 1;
        // Comissão PDV = commission_rate do pedido (taxa PDV, menor que delivery)
        const pdvRate = Number((o as any).commission_rate || 0) / 100;
        entry.pdvCommission = addMoney(entry.pdvCommission, multiplyMoney(subtotal, pdvRate));
      } else {
        // Delivery: lógica original
        const isPhysical = o.payment_method === "dinheiro" || o.payment_method === "cartao";
        if (isPhysical) entry.physicalSales = addMoney(entry.physicalSales, subtotal);
        else entry.appSales = addMoney(entry.appSales, subtotal);
      }

      entry.totalSales = addMoney(entry.totalSales, subtotal);
      entry.deliveryFees = addMoney(entry.deliveryFees, deliveryFee);
      entry.orderCount += 1;
    });
    map.forEach((entry, storeId) => {
      const rate = getStoreRate(storeId);
      entry.commissionDue = multiplyMoney(entry.physicalSales, rate);
      entry.netTransfer = subtractMoney(entry.appSales, multiplyMoney(entry.appSales, rate));
      entry.finalBalance = subtractMoney(entry.netTransfer, entry.commissionDue);
    });
    return Array.from(map.values()).filter(e => e.orderCount > 0).sort((a, b) => b.totalSales - a.totalSales);
  }, [financeOrders, stores, selectedStore, parentStorePlans]);

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
    const grossProfit = sumMoney(
      storeSettlement.map((entry) =>
        addMoney(
          entry.commissionDue,                               // comissão delivery físico
          subtractMoney(entry.appSales, entry.netTransfer),  // comissão delivery PIX
          entry.pdvCommission                                // comissão PDV
        )
      )
    );
    const totalDriverFees = sumMoney(driverSettlement.map((entry) => entry.appFees));
    return { totalVolume, grossProfit, totalDriverFees };
  }, [storeSettlement, driverSettlement, stores, parentStorePlans]);

  const storeConciliation = useMemo(() => {
    if (!orders || !stores) return [];
    // Exclude cancelled and waiting-payment orders
    const billableOrders = orders.filter(o => !["cancelado", "aguardando_pagamento"].includes(o.status));
    const map = new Map<string, { name: string; totalSold: number; commission: number; orders: number }>();
    stores.forEach(s => map.set(s.id, { name: s.name, totalSold: 0, commission: 0, orders: 0 }));
    billableOrders.forEach(o => {
      const entry = map.get(o.store_id);
      if (entry) {
        entry.totalSold = addMoney(entry.totalSold, o.total_price);
        entry.commission = addMoney(entry.commission, multiplyMoney(o.subtotal, getStoreRate(o.store_id)));
        entry.orders += 1;
      }
    });
    return Array.from(map.values()).filter(e => e.orders > 0).sort((a, b) => b.totalSold - a.totalSold);
  }, [orders, stores, parentStorePlans]);

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
    report += `💰 Vendas: ${formatBRL(metrics.totalSales)}\n`;
    report += `📦 Pedidos: ${metrics.totalOrders}\n`;
    report += `🏷️ Comissão Plataforma: ${formatBRL(metrics.commission)}\n\n`;
    report += `🏪 *Por Loja:*\n`;
    storeConciliation.forEach(s => {
      report += `• ${s.name}: ${formatBRL(s.totalSold)} (${s.orders} pedidos) — Comissão: ${formatBRL(s.commission)}\n`;
    });
    navigator.clipboard.writeText(report);
    toast.success("Relatório copiado! Cole no WhatsApp.");
  };

  const generateStoreWhatsApp = (entry: typeof storeSettlement[0]) => {
    const period = financeFilter === "week" ? "Semana" : "Mês";
    const storePlan = parentStorePlans?.find((p: any) => p.store_id === entry.storeId);
    const isFixed = storePlan?.plan_type === "fixed";
    const storeRate = Math.round(getStoreRate(entry.storeId) * 100);

    let msg: string;
    if (isFixed) {
      msg = `💰 *Resumo ItaSuper (${period})*\n\nOlá *${entry.name}*!\n\n` +
        `📋 Plano: Fixo Mensal — ${formatBRL(Number(storePlan?.monthly_fee || 180))}/mês\n\n` +
        `📦 Total de Pedidos: ${entry.orderCount}\n` +
        `💵 Vendas Totais: ${formatBRL(entry.totalSales)}\n\n` +
        `✅ Sem taxas por pedido. Toda receita é sua!\n` +
        `📌 Assinatura mensal cobrada à parte.`;
    } else {
      const balanceText = entry.finalBalance >= 0
        ? `✅ O ItaSuper deve transferir ${formatBRL(entry.finalBalance)} para você.`
        : `⚠️ Valor a acertar com o ItaSuper: ${formatBRL(Math.abs(entry.finalBalance))}.`;
      msg = `💰 *Fechamento ItaSuper (${period})*\n\nOlá *${entry.name}*!\n\n` +
        `📋 Plano: ${storePlan?.plan_type === "hybrid" ? "Assinatura + Taxa" : "Comissão"}\n\n` +
        `📦 Total de Pedidos: ${entry.orderCount}\n` +
        `💵 Vendas Físicas (Dinheiro/Cartão): ${formatBRL(entry.physicalSales)}\n` +
        `📱 Vendas App (Pix): ${formatBRL(entry.appSales)}\n` +
        (entry.pdvSales > 0 ? `🖥️ Vendas PDV (Presencial): ${formatBRL(entry.pdvSales)}\n` : "") +
        `🏷️ Comissão ${storeRate}% sobre Físicas: ${formatBRL(entry.commissionDue)}\n` +
        `💸 Repasse Líquido (App - ${storeRate}%): ${formatBRL(entry.netTransfer)}\n\n` +
        `---\n${balanceText}\n---`;
    }
    navigator.clipboard.writeText(msg);
    toast.success(`Extrato de ${entry.name} copiado!`);
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  if (authLoading || isAdminLoading) return null;

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

  // Bottom nav tabs (mobile)
  const bottomTabs: { key: AdminTab; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Início", icon: LayoutDashboard },
    { key: "financeiro", label: "Financeiro", icon: DollarSign },
    { key: "saques", label: "Saques", icon: Wallet },
    { key: "stores", label: "Lojas", icon: Store },
  ];

  const moreTabs = sidebarItems.filter(i => !bottomTabs.some(b => b.key === i.key));

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ Mobile Bottom Navigation ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around h-16">
          {bottomTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            const hasBadge = tab.key === "saques" && pendingWithdrawals.length > 0;
            return (
              <button
                key={tab.key}
                onClick={() => { handleTabChange(tab.key); setShowMoreSheet(false); }}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative ${
                  isActive ? "bg-primary/10" : ""
                }`}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {hasBadge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[8px] font-black min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full animate-pulse">
                      {pendingWithdrawals.length}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMoreSheet(!showMoreSheet)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
              showMoreSheet || moreTabs.some(t => t.key === activeTab) ? "bg-primary/10" : ""
            }`}
          >
            <Menu className={`h-5 w-5 ${showMoreSheet || moreTabs.some(t => t.key === activeTab) ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-bold ${showMoreSheet || moreTabs.some(t => t.key === activeTab) ? "text-primary" : "text-muted-foreground"}`}>Mais</span>
          </button>
        </div>
      </div>

      {/* ═══ More Sheet (mobile) ═══ */}
      {showMoreSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setShowMoreSheet(false)} />
          <div className="fixed bottom-16 left-0 right-0 z-[70] bg-card border-t border-border rounded-t-3xl shadow-2xl lg:hidden animate-in slide-in-from-bottom-4 max-h-[60vh] overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="w-12 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-2" />
            <div className="px-4 pb-4 space-y-1">
              {moreTabs.map((item) => {
                const isActive = activeTab === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => { handleTabChange(item.key); setShowMoreSheet(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-primary-foreground/15" : "bg-muted/50"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span>{item.label}</span>
                    {item.key === "approvals" && pendingApprovalsCount > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full animate-pulse">
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => { navigate("/"); setShowMoreSheet(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50">
                  <ArrowLeft className="h-4 w-4" />
                </div>
                <span>Voltar à Home</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ Desktop Sidebar ═══ */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[80vw] max-w-[320px] lg:w-[280px] bg-card/95 backdrop-blur-xl border-r border-border/50 flex-col transition-all duration-300 ease-out shadow-2xl lg:shadow-none hidden lg:flex`}>
        {/* Brand Header */}
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-sm text-foreground tracking-tight">ItaSuper</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Painel Admin</p>
            </div>
          </div>
        </div>

        {/* Live Stats Banner */}
        <div className="mx-4 mt-4 mb-2">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Resumo {filterLabels[dateFilter]}</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-black text-foreground leading-none">{metrics.activeOrders}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pedidos ativos</p>
              </div>
              <div>
                <p className="text-xl font-black text-foreground leading-none">{metrics.totalOrders}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total pedidos</p>
              </div>
            </div>
            <div className="pt-2 border-t border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[10px] text-muted-foreground">Vendas</span>
              </div>
              <span className="text-sm font-black text-foreground">{formatBRL(metrics.totalSales)}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
          {["Principal", "Gerenciamento", "Configurações", "Sistema"].map(group => {
            const items = sidebarItems.filter(i => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-4">
                <p className="text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-[0.15em] px-3 mb-1.5">{group}</p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = activeTab === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleTabChange(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isActive ? "bg-primary-foreground/15" : "bg-muted/50"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.key === "saques" && pendingWithdrawals.length > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full animate-pulse">
                            {pendingWithdrawals.length}
                          </span>
                        )}
                        {item.key === "approvals" && pendingApprovalsCount > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full animate-pulse">
                            {pendingApprovalsCount}
                          </span>
                        )}
                        {item.key === "dashboard" && delayedOrders.length > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {delayedOrders.length}
                          </span>
                        )}
                        {item.key === "dashboard" && complianceAlerts && complianceAlerts.length > 0 && delayedOrders.length === 0 && (
                          <span className="bg-amber-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                            ⚠
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Stats & Actions */}
        <div className="p-4 border-t border-border/50 space-y-3">
          <div className="bg-muted/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">Lojas</span>
              <span className="text-xs font-black text-foreground bg-accent px-2 py-0.5 rounded-md">{stores?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bike className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">Entregadores</span>
              <span className="text-xs font-black text-foreground bg-accent px-2 py-0.5 rounded-md">{drivers?.length || 0}</span>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full py-2.5 rounded-xl text-xs font-bold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar à Home
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
        {/* Top bar — Mobile header */}
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: show brand + current tab */}
            <div className="lg:hidden flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-foreground text-sm truncate">{currentTab?.label || "Dashboard"}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{formatBRL(metrics.totalSales)}</span>
                  {metrics.activeOrders > 0 && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{metrics.activeOrders} ativos</span>
                  )}
                </div>
              </div>
            </div>
            {/* Desktop: tab title */}
            <div className="hidden lg:block">
              <h2 className="font-bold text-foreground text-lg">{currentTab?.label || "Dashboard"}</h2>
              <p className="text-xs text-muted-foreground">
                {activeTab === "dashboard" && `${metrics.totalOrders} pedidos no período`}
                {activeTab === "financeiro" && "Gestão financeira e repasses"}
                {activeTab === "saques" && `${pendingWithdrawals.length} solicitações pendentes`}
                {activeTab === "entrega" && "Configurações de taxa de entrega"}
                {activeTab === "approvals" && `${pendingApprovalsCount} cadastro${pendingApprovalsCount === 1 ? "" : "s"} pendente${pendingApprovalsCount === 1 ? "" : "s"}`}
                {activeTab === "stores" && `${stores?.length || 0} lojas cadastradas`}
                {activeTab === "cidades" && "Lojas por cidade"}
                {activeTab === "pagamentos" && "Histórico de pagamentos por loja"}
                {activeTab === "coupons" && "Gerenciar cupons de desconto"}
                {activeTab === "juridico" && "Consulta jurídica e dados arquivados"}
                {activeTab === "moderadores" && "Moderadores e sistema de afiliados"}
                {activeTab === "socios" && "Divisão de lucros entre sócios"}
                {activeTab === "sync" && "Sincronização com banco externo"}
                {activeTab === "test_finance" && "Lojas de teste — finanças fictícias isoladas"}
                {activeTab === "links" && "Gerenciar botões da página pública /links"}
                {activeTab === "broadcast" && "Enviar push notifications em massa"}
                {activeTab === "planos" && "Gerenciar planos e assinaturas das lojas"}
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
            {pendingWithdrawals.length > 0 && activeTab !== "saques" && (
              <button
                onClick={() => handleTabChange("saques")}
                className="relative p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 transition-colors lg:hidden"
              >
                <Bell className="h-4 w-4 text-destructive" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                  {pendingWithdrawals.length}
                </span>
              </button>
            )}
            {pendingApprovalsCount > 0 && activeTab !== "approvals" && (
              <button
                onClick={() => handleTabChange("approvals")}
                className="relative p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors lg:hidden"
                aria-label="Cadastros pendentes"
              >
                <Shield className="h-4 w-4 text-amber-600" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                  {pendingApprovalsCount}
                </span>
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
            {activeTab === "planos" && (
              <div className="space-y-6">
                <AdminFixedPlanReceivables />
                <AdminPlanTemplatesEditor />
                <AdminPlanManager />
              </div>
            )}
            {activeTab === "pagamentos" && <PagamentosSplitTab stores={stores || []} />}
            {activeTab === "juridico" && <JuridicoTab />}
            {activeTab === "moderadores" && <ModeratorManager />}
            {activeTab === "socios" && <PartnerSplitPanel />}
            {activeTab === "test_finance" && <TestStoreFinancePanel />}
            {activeTab === "links" && <AppLinksManager />}
            {activeTab === "broadcast" && <AdminBroadcastPush />}
            {activeTab === "logs" && (
              <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <h3 className="font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Histórico de Ações Administrativas
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Admin</th>
                          <th className="px-4 py-3">Ação</th>
                          <th className="px-4 py-3">Alvo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logsLoading ? (
                          <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                        ) : adminLogs?.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {log.profiles?.full_name || "Admin"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                {log.action}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold capitalize">{log.target_type}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{log.target_id?.substring(0, 8)}...</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!logsLoading && (!adminLogs || adminLogs.length === 0) && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum log encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === "saques" && (
              <SaquesTab
                withdrawalRequests={withdrawalRequests}
                pendingWithdrawals={pendingWithdrawals}
                drivers={drivers}
                queryClient={queryClient}
              />
            )}
             {activeTab === "financeiro" && (
               <FinanceTabFull
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
                 parentStorePlans={parentStorePlans || []}
               />
             )}
             {activeTab === "dashboard" && (
               <div className="space-y-4">
                 <div className="flex gap-2 mb-4">
                   {(["today", "yesterday", "week"] as DateFilter[]).map(f => (
                     <button key={f} onClick={() => setDateFilter(f)}
                       className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${dateFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                       {filterLabels[f]}
                     </button>
                   ))}
                 </div>
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                   <MetricCard icon={ShoppingBag} label="Vendas" value={formatBRL(metrics.totalSales)} sublabel={`${metrics.totalOrders} pedidos`} />
                   <MetricCard icon={TrendingUp} label="Comissão Total" value={formatBRL(metrics.commission)} sublabel={`📦 Delivery: ${formatBRL(metrics.commissionDelivery)}`} sublabel2={`🖥️ PDV: ${formatBRL(metrics.commissionPdv)}`} highlight />
                   <MetricCard icon={Clock} label="Ativos" value={String(metrics.activeOrders)} sublabel="em andamento" />
                   <MetricCard icon={AlertTriangle} label="Atraso" value={String(delayedOrders.length)} sublabel="> 60 min" alert={delayedOrders.length > 0} />
                 </div>
                 <div className="mb-6"><PageViewsCard /></div>
                 {adminChartData.dailyData.length > 0 && (
                   <div className="bg-card rounded-2xl border border-border p-4 mb-4">
                     <div className="flex items-center justify-between mb-3">
                       <p className="text-xs font-bold text-foreground">Evolução — Delivery vs PDV</p>
                       <div className="text-[10px] text-muted-foreground flex gap-3">
                         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block"/>Delivery</span>
                         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>PDV</span>
                       </div>
                     </div>
                     <div className="h-44"><DailySalesChart data={adminChartData.dailyData} showPdv={adminChartData.totalPdv > 0} /></div>
                     <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30 text-center">
                       <div><p className="text-[10px] text-muted-foreground">Delivery</p><p className="text-sm font-black text-primary">{formatBRL(adminChartData.totalDelivery)}</p></div>
                       <div className="border-x border-border/30"><p className="text-[10px] text-muted-foreground">PDV</p><p className="text-sm font-black text-blue-500">{formatBRL(adminChartData.totalPdv)}</p></div>
                       <div><p className="text-[10px] text-muted-foreground">Ticket Médio</p><p className="text-sm font-black text-foreground">{formatBRL(adminChartData.ticketMedio)}</p></div>
                     </div>
                   </div>
                 )}
                 {adminChartData.paymentData.length > 0 && (
                   <div className="bg-card rounded-2xl border border-border p-4 mb-4">
                     <p className="text-xs font-bold text-foreground mb-3">Formas de Pagamento</p>
                     <div className="h-32"><PaymentBreakdownChart data={adminChartData.paymentData} /></div>
                   </div>
                 )}
                 <div className="bg-card rounded-2xl border border-border p-4">
                   <p className="text-xs font-bold text-foreground mb-3">Horário de Pico</p>
                   <HourlyChart data={adminChartData.hourlyData} />
                 </div>
               </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

// ─── Metric Card ───

const SaquesTab = ({
  withdrawalRequests,
  pendingWithdrawals,
  drivers,
  queryClient,
}: {
  withdrawalRequests: any[] | undefined;
  pendingWithdrawals: any[];
  drivers: any[] | undefined;
  queryClient: any;
}) => {
  const [saquesSubTab, setSaquesSubTab] = useState<"pendentes" | "historico">("pendentes");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingList = pendingWithdrawals;
  const historyList = (withdrawalRequests || []).filter((w: any) => w.status !== "solicitado");

  const handleDelete = async (req: any) => {
    if (deletingId !== req.id) {
      setDeletingId(req.id);
      setTimeout(() => setDeletingId((cur) => (cur === req.id ? null : cur)), 4000);
      return;
    }
    const { error } = await supabase.from("withdrawal_requests" as any).delete().eq("id", req.id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Solicitação excluída.");
    setDeletingId(null);
    queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
  };

  const handleConfirmPayment = async (req: any, driverName: string) => {
    const { error: updateError } = await supabase
      .from("withdrawal_requests" as any)
      .update({ status: "pago", processed_at: new Date().toISOString() } as any)
      .eq("id", req.id);
    if (updateError) { toast.error("Erro ao confirmar."); return; }
    const { data: currentBalance } = await supabase
      .from("driver_balances" as any)
      .select("paid_amount")
      .eq("driver_user_id", req.driver_user_id)
      .single();
    const previousPaid = Number((currentBalance as any)?.paid_amount || 0);
    const { error: balanceError } = await supabase
      .from("driver_balances" as any)
      .update({
        pending_amount: 0,
        paid_amount: previousPaid + Number(req.amount),
        updated_at: new Date().toISOString()
      } as any)
      .eq("driver_user_id", req.driver_user_id);
    if (balanceError) console.error("Balance update error:", balanceError);
    await supabase.from("driver_earnings" as any).update({ status: "pago" } as any)
      .eq("driver_user_id", req.driver_user_id).eq("status", "pendente");
    toast.success(`✅ ${formatBRL(Number(req.amount))} para ${driverName} confirmada!`);
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
                {formatBRL(Number(req.amount))}
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
          <p className="text-xs text-muted-foreground">Valor: <span className="text-foreground font-bold">{formatBRL(Number(req.amount))}</span></p>
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

// ── Jurídico Tab ──
const JuridicoTab = () => {
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"name" | "cpf" | "email">("name");
  const [results, setResults] = useState<any[]>([]);
  const [archivedResults, setArchivedResults] = useState<any[]>([]);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [userTerms, setUserTerms] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setSearchAttempted(true);
    setSelectedUser(null);
    setResults([]);
    setArchivedResults([]);

    try {
      const cleanSearch = search.trim();
      const normalizedDocument = cleanSearch.replace(/\D/g, "");
      const namePattern = `%${cleanSearch}%`;
      const documentPattern = `%${normalizedDocument}%`;
      const emailPattern = `%${cleanSearch.toLowerCase()}%`;

      const profileQuery = supabase.from("profiles").select("*");
      const archivedQuery = supabase.from("archived_accounts").select("*");

      const activeSearch =
        searchType === "name"
          ? profileQuery.ilike("full_name", namePattern)
          : searchType === "cpf"
            ? profileQuery.ilike("document", documentPattern)
            : profileQuery.ilike("email", emailPattern);

      const archivedSearch =
        searchType === "name"
          ? archivedQuery.ilike("full_name", namePattern)
          : searchType === "cpf"
            ? archivedQuery.ilike("document", documentPattern)
            : archivedQuery.ilike("email", emailPattern);

      const [profilesResponse, archivedResponse] = await Promise.all([
        activeSearch.limit(20),
        archivedSearch.limit(20),
      ]);

      if (profilesResponse.error) {
        console.error("Erro ao buscar perfis:", profilesResponse.error);
        throw new Error(`Erro ao buscar perfis: ${profilesResponse.error.message}`);
      }

      if (archivedResponse.error) {
        console.error("Erro ao buscar contas arquivadas:", archivedResponse.error);
        throw new Error(`Erro ao buscar contas arquivadas: ${archivedResponse.error.message}`);
      }

      const activeProfiles = (profilesResponse.data || []) as any[];
      const archivedAccounts = (archivedResponse.data || []) as any[];

      setResults(activeProfiles);
      setArchivedResults(archivedAccounts);

      const totalResults = activeProfiles.length + archivedAccounts.length;
      if (totalResults === 0) {
        toast.info(`Nenhum resultado para "${cleanSearch}"`);
      } else {
        toast.success(`${totalResults} resultado(s) encontrado(s)`);
      }
    } catch (err: any) {
      console.error("Erro na busca jurídica:", err);
      toast.error(err?.message || "Erro inesperado na busca");
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string, isArchived = false) => {
    setLoadingDetails(true);
    try {
      // Load orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, total_price, subtotal, payment_method, created_at, neighborhood, address_details")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      setUserOrders(orders || []);

      // Load terms acceptance
      const { data: terms } = await supabase
        .from("terms_acceptance")
        .select("*")
        .eq("user_id", userId)
        .order("accepted_at", { ascending: false });
      setUserTerms(terms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const selectProfile = (profile: any) => {
    setSelectedUser({ ...profile, _type: "active" });
    loadUserDetails(profile.user_id);
  };

  const selectArchived = (archived: any) => {
    setSelectedUser({ ...archived, _type: "archived" });
    loadUserDetails(archived.original_user_id, true);
  };

  const exportUserData = () => {
    if (!selectedUser) return;
    const isArchived = selectedUser._type === "archived";
    const data = {
      tipo: isArchived ? "CONTA EXCLUÍDA (ARQUIVADA)" : "CONTA ATIVA",
      dados_pessoais: {
        nome: selectedUser.full_name,
        email: selectedUser.email,
        documento: selectedUser.document,
        telefone: selectedUser.phone,
        whatsapp: selectedUser.whatsapp_number,
        cidade: selectedUser.city,
        bairro: selectedUser.neighborhood,
        cep: selectedUser.cep,
        rua: selectedUser.street,
        numero: isArchived ? selectedUser.address_number : selectedUser.number,
      },
      funcao: selectedUser.role,
      pix: { tipo: selectedUser.pix_type, chave: selectedUser.pix_key },
      termos_aceitos: selectedUser.terms_accepted_at,
      conta_criada: isArchived ? selectedUser.account_created_at : selectedUser.created_at,
      ...(isArchived && {
        conta_excluida_em: selectedUser.deleted_at,
        motivo_exclusao: selectedUser.deletion_reason,
        reter_ate: selectedUser.retain_until,
        total_pedidos: selectedUser.order_count,
        total_gasto: selectedUser.total_spent,
      }),
      historico_pedidos: userOrders.map(o => ({
        id: o.id,
        status: o.status,
        valor: o.total_price,
        pagamento: o.payment_method,
        data: o.created_at,
        endereco: o.address_details,
        bairro: o.neighborhood,
      })),
      aceites_termos: userTerms.map(t => ({
        versao_termos: t.terms_version,
        versao_privacidade: t.privacy_version,
        data: t.accepted_at,
        ip: t.ip_address,
        user_agent: t.user_agent,
      })),
      exportado_em: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados_usuario_${selectedUser.document || selectedUser.full_name || "desconhecido"}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados com sucesso!");
  };

  const roleLabels: Record<string, string> = { cliente: "Cliente", lojista: "Lojista", motoboy: "Entregador" };
  const statusLabels: Record<string, string> = {
    pendente: "Pendente", preparando: "Preparando", pronto_para_entrega: "Pronto",
    saiu_entrega: "Saiu Entrega", em_transito: "Em Trânsito", entregue: "Entregue",
    finalizado: "Finalizado", cancelado: "Cancelado", aguardando_pagamento: "Aguardando Pgto",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Consulta Jurídica</h2>
            <p className="text-xs text-muted-foreground">Busque dados de usuários para atender solicitações legais (LGPD, Judiciais)</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-3">
          {(["name", "cpf", "email"] as const).map(type => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                searchType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {type === "name" ? "Nome" : type === "cpf" ? "CPF/CNPJ" : "Email"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "name" ? "Digite o nome..." : searchType === "cpf" ? "Digite o CPF/CNPJ..." : "Digite o email..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </button>
        </div>
      </div>

      {/* Results */}
      {(results.length > 0 || archivedResults.length > 0) && !selectedUser && (
        <div className="space-y-3">
          {results.length > 0 && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Contas Ativas ({results.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {results.map((p: any) => (
                  <button key={p.id} onClick={() => selectProfile(p)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{p.email} • {p.document || "Sem doc"} • {roleLabels[p.role] || p.role}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.is_approved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {p.is_approved ? "Aprovado" : "Pendente"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {archivedResults.length > 0 && (
            <div className="bg-card rounded-2xl border border-destructive/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-destructive/5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-destructive" />
                  Contas Excluídas / Arquivadas ({archivedResults.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {archivedResults.map((a: any) => (
                  <button key={a.id} onClick={() => selectArchived(a)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{a.email} • {a.document || "Sem doc"} • Excluída em {new Date(a.deleted_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      Arquivado
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Detail View */}
      {selectedUser && (
        <div className="space-y-3">
          <button onClick={() => setSelectedUser(null)} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
            ← Voltar aos resultados
          </button>

          {/* User info card */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedUser._type === "archived" ? "bg-destructive/10" : "bg-primary/10"
                }`}>
                  <User className={`h-6 w-6 ${selectedUser._type === "archived" ? "text-destructive" : "text-primary"}`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selectedUser.full_name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedUser._type === "archived" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"
                  }`}>
                    {selectedUser._type === "archived" ? "CONTA EXCLUÍDA" : "CONTA ATIVA"}
                  </span>
                </div>
              </div>
              <button onClick={exportUserData} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                <Download className="h-3.5 w-3.5" />
                Exportar JSON
              </button>
            </div>

            {/* Data grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: User, label: "Nome", value: selectedUser.full_name },
                { icon: Mail, label: "Email", value: selectedUser.email },
                { icon: FileText, label: "CPF/CNPJ", value: selectedUser.document },
                { icon: Phone, label: "Telefone", value: selectedUser.phone },
                { icon: Phone, label: "WhatsApp", value: selectedUser.whatsapp_number },
                { icon: Shield, label: "Função", value: roleLabels[selectedUser.role] || selectedUser.role },
                { icon: MapPin, label: "Cidade", value: selectedUser.city },
                { icon: MapPin, label: "Bairro", value: selectedUser.neighborhood },
                { icon: MapPin, label: "CEP", value: selectedUser.cep },
                { icon: MapPin, label: "Rua", value: selectedUser.street },
                { icon: MapPin, label: "Número", value: selectedUser._type === "archived" ? selectedUser.address_number : selectedUser.number },
                { icon: Wallet, label: "PIX", value: selectedUser.pix_key ? `${selectedUser.pix_type}: ${selectedUser.pix_key}` : null },
                { icon: Calendar, label: "Conta criada", value: selectedUser._type === "archived" ? selectedUser.account_created_at : selectedUser.created_at },
                { icon: CheckCircle2, label: "Termos aceitos", value: selectedUser.terms_accepted_at },
              ].filter(f => f.value).map((field, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2.5">
                  <field.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">{field.label}</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {field.label.includes("criada") || field.label.includes("aceitos")
                        ? new Date(field.value).toLocaleString("pt-BR")
                        : field.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Archived-specific info */}
            {selectedUser._type === "archived" && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2">
                <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Dados de Exclusão
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Excluída em:</span> <span className="font-bold text-foreground">{new Date(selectedUser.deleted_at).toLocaleString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Motivo:</span> <span className="font-bold text-foreground">{selectedUser.deletion_reason}</span></div>
                  <div><span className="text-muted-foreground">Reter até:</span> <span className="font-bold text-foreground">{new Date(selectedUser.retain_until).toLocaleDateString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Total pedidos:</span> <span className="font-bold text-foreground">{selectedUser.order_count}</span></div>
                  <div><span className="text-muted-foreground">Total gasto:</span> <span className="font-bold text-foreground">{formatBRL(Number(selectedUser.total_spent || 0))}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Terms acceptance history */}
          {loadingDetails ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {userTerms.length > 0 && (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Aceites de Termos ({userTerms.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {userTerms.map((t: any) => (
                      <div key={t.id} className="px-4 py-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">Termos v{t.terms_version} • Privacidade v{t.privacy_version}</span>
                          <span className="text-muted-foreground">{new Date(t.accepted_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p className="text-muted-foreground">IP: {t.ip_address || "N/A"} • UA: {(t.user_agent || "N/A").substring(0, 60)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order history */}
              {userOrders.length > 0 && (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      Histórico de Pedidos ({userOrders.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border max-h-96 overflow-y-auto">
                    {userOrders.map((o: any) => (
                      <div key={o.id} className="px-4 py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-foreground">{formatBRL(Number(o.total_price))}</p>
                          <p className="text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")} • {o.neighborhood}</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            o.status === "finalizado" || o.status === "entregue" ? "bg-emerald-500/10 text-emerald-600" :
                            o.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                            "bg-amber-500/10 text-amber-600"
                          }`}>
                            {statusLabels[o.status] || o.status}
                          </span>
                          <p className="text-muted-foreground mt-0.5">{o.payment_method}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userOrders.length === 0 && userTerms.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum registro adicional encontrado.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && archivedResults.length === 0 && !loading && searchAttempted && search.trim() && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para "{search}"</p>
        </div>
      )}

      {/* Retention info */}
      <div className="bg-muted/30 rounded-2xl border border-border p-4 space-y-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Política de Retenção de Dados
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Dados de conta: mantidos enquanto ativa</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Histórico de pedidos: 5 anos (Art. 173, CTN)</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Dados financeiros: 5 anos (obrigações tributárias)</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Docs entregadores: 30 dias após exclusão</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Aceites de termos: indefinidamente (prova legal)</div>
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

// ── Pagamentos Split Tab ──
const PagamentosSplitTab = ({ stores }: { stores: any[] }) => {
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["financial-transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payoutHistoryAll } = useQuery({
    queryKey: ["payout-history-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const storeGroups = useMemo(() => {
    if (!transactions) return [];
    const map = new Map<string, { storeName: string; storeId: string; records: any[]; totalPaid: number; totalPending: number }>();
    
    transactions.forEach((tx: any) => {
      const store = stores?.find(s => s.id === tx.store_id);
      const storeName = store?.name || "Loja Desconhecida";
      if (!map.has(tx.store_id)) {
        map.set(tx.store_id, { storeName, storeId: tx.store_id, records: [], totalPaid: 0, totalPending: 0 });
      }
      const group = map.get(tx.store_id)!;
      group.records.push(tx);
      if (tx.status === "paid" || tx.status === "approved") {
        group.totalPaid += Number(tx.amount);
      } else if (tx.status === "pending") {
        group.totalPending += Number(tx.amount);
      }
    });

    // Also add payout_history records
    payoutHistoryAll?.forEach((ph: any) => {
      if (ph.entity_type === "store") {
        const existing = map.get(ph.entity_id);
        if (existing) {
          existing.records.push({ ...ph, _source: "payout_history", transaction_kind: "store_payout", status: "paid", amount: ph.amount });
        }
      }
    });

    // Sort records inside each group
    map.forEach(group => {
      group.records.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return Array.from(map.values()).sort((a, b) => b.records.length - a.records.length);
  }, [transactions, stores, payoutHistoryAll]);

  const copyReceipt = (record: any) => {
    const kindLabels: Record<string, string> = { store_payout: "Repasse", commission_charge: "Comissão", driver_payout: "Repasse Motoboy" };
    const statusLabels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", paid: "Pago", failed: "Falhou", cancelled: "Cancelado" };
    
    let receipt = `📄 *Comprovante de Pagamento*\n\n`;
    receipt += `Tipo: ${kindLabels[record.transaction_kind] || record.transaction_kind}\n`;
    receipt += `Valor: ${formatBRL(Number(record.amount))}\n`;
    receipt += `Status: ${statusLabels[record.status] || record.status}\n`;
    receipt += `Referência: ${record.reference_code || record.transaction_code || "N/A"}\n`;
    receipt += `Data: ${new Date(record.created_at).toLocaleString("pt-BR")}\n`;
    
    if (record.mercado_pago_payment_id) receipt += `ID Mercado Pago: ${record.mercado_pago_payment_id}\n`;
    if (record.pix_copy_paste) receipt += `\nPIX Copia e Cola:\n${record.pix_copy_paste}\n`;
    
    const meta = record.metadata || {};
    if (meta.pix_key) receipt += `Chave PIX: ${meta.pix_key} (${meta.pix_type || ""})\n`;
    if (meta.store_name) receipt += `Loja: ${meta.store_name}\n`;
    if (record.notes) receipt += `Obs: ${record.notes}\n`;
    if (record.settled_at) receipt += `Liquidado em: ${new Date(record.settled_at).toLocaleString("pt-BR")}\n`;

    navigator.clipboard.writeText(receipt);
    setCopiedId(record.id);
    toast.success("Comprovante copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const kindLabels: Record<string, string> = { store_payout: "Repasse", commission_charge: "Comissão", driver_payout: "Repasse Motoboy" };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Transações</span>
          </div>
          <p className="text-lg font-black text-foreground">{transactions?.length || 0}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Lojas</span>
          </div>
          <p className="text-lg font-black text-foreground">{storeGroups.length}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Total Pago</span>
          </div>
          <p className="text-lg font-black text-emerald-500">
            {formatBRL(storeGroups.reduce((acc, g) => acc + g.totalPaid, 0))}
          </p>
        </div>
      </div>

      {/* Store list */}
      {storeGroups.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center border border-border">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma transação registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {storeGroups.map((group) => {
            const isExpanded = expandedStore === group.storeId;
            return (
              <div key={group.storeId} className="bg-card rounded-2xl border border-border overflow-hidden">
                {/* Store header */}
                <button
                  onClick={() => setExpandedStore(isExpanded ? null : group.storeId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{group.storeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.records.length} registro{group.records.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {group.totalPaid > 0 && (
                        <p className="text-sm font-bold text-emerald-500">{formatBRL(group.totalPaid)}</p>
                      )}
                      {group.totalPending > 0 && (
                        <p className="text-xs text-amber-500 font-bold">{formatBRL(group.totalPending)} pend.</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded records */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {group.records.map((record: any, idx: number) => (
                      <div key={record.id || idx} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${globalStatusColors[record.status]?.bg ?? "bg-muted"} ${globalStatusColors[record.status]?.text ?? "text-muted-foreground"}`}>
                                {globalStatusColors[record.status]?.label || record.status}
                              </span>
                            <span className="text-xs font-bold text-foreground">
                              {kindLabels[record.transaction_kind] || record.transaction_kind}
                            </span>
                          </div>
                          <span className="text-sm font-black text-foreground">{formatBRL(Number(record.amount))}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-muted-foreground">Referência</p>
                            <p className="font-bold text-foreground truncate">{record.reference_code || record.transaction_code || "—"}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-muted-foreground">Data</p>
                            <p className="font-bold text-foreground">
                              {new Date(record.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        {/* PIX info */}
                        {record.pix_copy_paste && (
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground mb-1">PIX Copia e Cola</p>
                            <p className="text-xs text-foreground break-all font-mono">{record.pix_copy_paste.substring(0, 80)}...</p>
                          </div>
                        )}

                        {/* Metadata PIX key */}
                        {record.metadata?.pix_key && (
                          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                            <Wallet className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            <p className="text-xs text-foreground truncate">
                              {record.metadata.pix_type}: {record.metadata.pix_key}
                            </p>
                          </div>
                        )}

                        {/* MP payment ID */}
                        {record.mercado_pago_payment_id && (
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">ID Pagamento</p>
                            <p className="text-xs font-bold text-foreground">{record.mercado_pago_payment_id}</p>
                          </div>
                        )}

                        {/* Notes from payout_history */}
                        {record.notes && (
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">Observações</p>
                            <p className="text-xs text-foreground">{record.notes}</p>
                          </div>
                        )}

                        {/* Copy receipt button */}
                        <button
                          onClick={() => copyReceipt(record)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            copiedId === record.id
                              ? "bg-emerald-500/20 text-emerald-600"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {copiedId === record.id ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" /> Copiado!</>
                          ) : (
                            <><Copy className="h-3.5 w-3.5" /> Copiar Comprovante</>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboardV2;
