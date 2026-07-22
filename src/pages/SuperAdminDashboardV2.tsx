import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminApprovals from "@/components/AdminApprovals";
import CouponManager from "@/components/CouponManager";
import AdminStoreManager from "@/components/AdminStoreManager";
import DeliveryFeeConfigPanel from "@/components/DeliveryFeeConfig";
import TestStoreCreator from "@/components/TestStoreCreator";
import PlanosTab from "@/components/PlanosTab";
import AdminPlanManager from "@/components/AdminPlanManager";
import AdminPlanTemplatesEditor from "@/components/AdminPlanTemplatesEditor";
import ModeratorManager from "@/components/ModeratorManager";
import SupportAdminPanel from "@/components/SupportAdminPanel";
import AppStorePageAdmin from "@/components/AppStorePageAdmin";
import PartnerSplitPanel from "@/components/PartnerSplitPanel";
import TestStoreFinancePanel from "@/components/TestStoreFinancePanel";
import AppLinksManager from "@/components/AppLinksManager";
import AdminBroadcastPush from "@/components/AdminBroadcastPush";
import SalesCoachPanel from "@/components/SalesCoachPanel";
import PageViewsCard from "@/components/PageViewsCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { planLabel } from "@/lib/plansInfo";
import {
  ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Clock,
  Store, Copy, AlertTriangle, Users, Bike, Wallet, CheckCircle2, Banknote, XCircle, Bell, Trash2, QrCode, Loader2, ArrowUpRight, ArrowDownRight, Settings,
  LayoutDashboard, Shield, Ticket, RefreshCw, Truck, Menu, X, MapPin, Eye, Scale, Search, FileText, Mail, Phone, User, Download, Calendar, CreditCard, Receipt, ChevronDown, ChevronUp, Percent, Crown, Handshake, FlaskConical, Link as LinkIcon, Megaphone, Monitor, Sparkles,
  MessageCircle, Smartphone, ShieldCheck, Puzzle,
} from "lucide-react";
 import { Switch } from "@/components/ui/switch";
 import { Badge } from "@/components/ui/badge";
// Hook + KPI/cores leves (sem recharts) — eager
import {
  KpiCard, useFinanceChartData, CHART_COLORS,
} from "@/components/FinanceChartsCore";
// Gráficos pesados (recharts) — carregados sob demanda
const DailySalesChart = lazy(() =>
  import("@/components/FinanceCharts").then(m => ({ default: m.DailySalesChart }))
);
const PaymentBreakdownChart = lazy(() =>
  import("@/components/FinanceCharts").then(m => ({ default: m.PaymentBreakdownChart }))
);
const HourlyChart = lazy(() =>
  import("@/components/FinanceCharts").then(m => ({ default: m.HourlyChart }))
);
const ChannelCompareChart = lazy(() =>
  import("@/components/FinanceCharts").then(m => ({ default: m.ChannelCompareChart }))
);
 import { addMoney, multiplyMoney, subtractMoney, sumMoney, formatBRL } from "@/lib/utils";
 import { statusColors as globalStatusColors } from "@/lib/orderStatus";

// Lazy-loaded tabs (carregadas só ao abrir)
const SyncExternalTab = lazy(() => import("./super-admin/tabs/SyncExternalTab"));
const JuridicoTab = lazy(() => import("./super-admin/tabs/JuridicoTab"));
const CidadesTab = lazy(() => import("./super-admin/tabs/CidadesTab"));
const SaquesTab = lazy(() => import("./super-admin/tabs/SaquesTab"));
const PagamentosSplitTab = lazy(() => import("./super-admin/tabs/PagamentosSplitTab"));
const AuditoriaTab = lazy(() => import("./super-admin/tabs/AuditoriaTab"));
const AReceberTab = lazy(() => import("./super-admin/tabs/AReceberTab"));
const HistoricoRepassesTab = lazy(() => import("./super-admin/tabs/HistoricoRepassesTab"));
const DebugLojaTab = lazy(() => import("./super-admin/tabs/DebugLojaTab"));
const PlatformWhatsAppTab = lazy(() => import("./super-admin/tabs/PlatformWhatsAppTab"));
const AddonsMrrTab = lazy(() => import("./super-admin/tabs/AddonsMrrTab"));
const RevendedoresTab = lazy(() => import("./super-admin/tabs/RevendedoresTab"));
// Painéis financeiros profissionais (Fase 1)
const FluxoCaixaPanel = lazy(() => import("@/components/finance/FluxoCaixaPanel"));
const ConciliacaoAsaasPanel = lazy(() => import("@/components/finance/ConciliacaoAsaasPanel"));
const AuditoriaFinanceiraPanel = lazy(() => import("@/components/finance/AuditoriaFinanceiraPanel"));
const MensalidadesPanel = lazy(() => import("@/components/finance/MensalidadesPanel"));
const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// Barra de sub-abas reutilizável (usada pelas seções consolidadas: Financeiro, Lojas, App, Auditoria)
const SubTabsBar = ({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { key: string; label: string; icon?: React.ElementType; badge?: number }[];
}) => (
  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
    {items.map((it) => {
      const Icon = it.icon;
      const isActive = value === it.key;
      return (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span>{it.label}</span>
          {!!it.badge && it.badge > 0 && (
            <span className={`ml-1 text-[10px] font-black rounded-full px-1.5 py-0.5 ${isActive ? "bg-primary-foreground/20" : "bg-destructive text-destructive-foreground"}`}>
              {it.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

type DateFilter = "today" | "yesterday" | "week";
type AdminTab = "dashboard" | "approvals" | "stores" | "financeiro" | "pagamentos" | "saques" | "sync" | "coupons" | "entrega" | "cidades" | "juridico" | "planos" | "moderadores" | "socios" | "suporte" | "app-page" | "test_finance" | "links" | "broadcast" | "logs" | "coach" | "auditoria" | "whatsapp_plataforma";

const sidebarItems: { key: AdminTab; label: string; icon: React.ElementType; group: string }[] = [
  // Início
  { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard, group: "Início" },
  // Operação (Cidades + Entrega agora vivem dentro de "Lojas")
  { key: "stores", label: "Lojas", icon: Store, group: "Operação" },
  { key: "coupons", label: "Cupons", icon: Ticket, group: "Operação" },
  // Financeiro unificado (Pagamentos / Saques / Planos / Sócios / Teste viraram sub-abas)
  { key: "financeiro", label: "Financeiro", icon: DollarSign, group: "Financeiro" },
  // Pessoas
  { key: "moderadores", label: "Moderadores", icon: Users, group: "Pessoas" },
  { key: "suporte", label: "Suporte", icon: MessageCircle, group: "Pessoas" },
  // Marketing (Links virou sub-aba de "Página do App")
  { key: "app-page", label: "Página do App", icon: Smartphone, group: "Marketing" },
  { key: "broadcast", label: "Notificações", icon: Megaphone, group: "Marketing" },
  { key: "coach", label: "Coach Vendas IA", icon: Sparkles, group: "Marketing" },
  // Sistema (Logs virou sub-aba de "Auditoria")
  { key: "sync", label: "Sincronizar", icon: RefreshCw, group: "Sistema" },
  { key: "auditoria", label: "Auditoria", icon: ShieldCheck, group: "Sistema" },
  { key: "whatsapp_plataforma", label: "WhatsApp Plataforma", icon: MessageCircle, group: "Sistema" },
  { key: "juridico", label: "Jurídico", icon: Scale, group: "Sistema" },
];

// Subtítulo padronizado por aba — evita if/else espalhado no header.
const TAB_SUBTITLE: Record<string, (ctx: {
  totalOrders: number;
  pendingWithdrawals: number;
  pendingApprovals: number;
  storesCount: number;
}) => string> = {
  dashboard: (c) => `${c.totalOrders} pedidos no período`,
  financeiro: () => "Gestão financeira e repasses",
  saques: (c) => `${c.pendingWithdrawals} solicitação${c.pendingWithdrawals === 1 ? "" : "ões"} pendente${c.pendingWithdrawals === 1 ? "" : "s"}`,
  entrega: () => "Configurações de taxa de entrega",
  approvals: (c) => `${c.pendingApprovals} cadastro${c.pendingApprovals === 1 ? "" : "s"} pendente${c.pendingApprovals === 1 ? "" : "s"}`,
  stores: (c) => `${c.storesCount} lojas cadastradas`,
  cidades: () => "Lojas por cidade",
  pagamentos: () => "Histórico de pagamentos por loja",
  coupons: () => "Gerenciar cupons de desconto",
  juridico: () => "Consulta jurídica e dados arquivados",
  moderadores: () => "Moderadores e sistema de afiliados",
  socios: () => "Divisão de lucros entre sócios",
  sync: () => "Sincronização com banco externo",
  test_finance: () => "Lojas de teste — finanças fictícias isoladas",
  links: () => "Gerenciar botões da página pública /links",
  broadcast: () => "Enviar push notifications em massa",
  coach: () => "Assistente de IA para captar e fechar lojistas",
  planos: () => "Gerenciar planos e assinaturas das lojas",
  "app-page": () => "Página pública do app e links",
  suporte: () => "Painel de suporte ao lojista",
  auditoria: () => "Auditoria, logs e debug",
  whatsapp_plataforma: () => "WhatsApp oficial da plataforma (avisos automáticos)",
};

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
  // Sub-seções dos grupos unificados
  type FinanceSection =
    | "overview"
    | "fluxo"
    | "saques"
    | "areceber"
    | "historico"
    | "conciliacao"
    | "socios"
    | "test"
    | "mensalidades"
    | "planos-lojas"
    | "planos-templates"
    | "addons"
    | "revendedores"
    | "auditoria";
  const [financeSection, setFinanceSection] = useState<FinanceSection>("overview");
  type StoresSection = "lojas" | "cidades" | "entrega";
  const [storesSection, setStoresSection] = useState<StoresSection>("lojas");
  type AppPageSection = "page" | "links";
  const [appPageSection, setAppPageSection] = useState<AppPageSection>("page");
  type AuditoriaSection = "auditoria" | "logs" | "debug-loja";
  const [auditoriaSection, setAuditoriaSection] = useState<AuditoriaSection>("auditoria");

  // Redireciona deep-links de abas antigas para a aba consolidada correspondente
  useEffect(() => {
    const legacyFinance: AdminTab[] = ["pagamentos", "saques", "planos", "socios", "test_finance"];
    const legacyMap: Partial<Record<AdminTab, { tab: AdminTab; apply: () => void }>> = {
      pagamentos:   { tab: "financeiro", apply: () => setFinanceSection("areceber") },
      saques:       { tab: "financeiro", apply: () => setFinanceSection("saques") },
      planos:       { tab: "financeiro", apply: () => setFinanceSection("planos-lojas") },
      socios:       { tab: "financeiro", apply: () => setFinanceSection("socios") },
      test_finance: { tab: "financeiro", apply: () => setFinanceSection("test") },
      cidades:      { tab: "stores",     apply: () => setStoresSection("cidades") },
      entrega:      { tab: "stores",     apply: () => setStoresSection("entrega") },
      links:        { tab: "app-page",   apply: () => setAppPageSection("links") },
      logs:         { tab: "auditoria",  apply: () => setAuditoriaSection("logs") },
    };
    const hit = legacyMap[activeTab];
    if (hit) {
      hit.apply();
      setActiveTab(hit.tab);
    }
    void legacyFinance;
  }, [activeTab]);

  // Memoizado para evitar recriação a cada render (causava re-fetch de queries)
  const getDateRange = useMemo(() => (filter: DateFilter) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

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
  }, [isAdmin]); // Remover queryClient das deps - é estável mas força re-subscribe

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
  }, [isAdmin]); // queryClient é estável, remover das deps evita re-subscribe

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
    const testIds = new Set((stores || []).filter((s: any) => s.is_test).map((s: any) => s.id));
    const map = new Map<string, {
      name: string; storeId: string; physicalSales: number; appSales: number; totalSales: number;
      commissionDue: number; netTransfer: number; finalBalance: number; orderCount: number; deliveryFees: number;
      // PDV separado
      pdvSales: number; pdvOrders: number; pdvCommission: number;
    }>();
    stores.filter((s: any) => !s.is_test).forEach(s => map.set(s.id, {
      name: s.name, storeId: s.id, physicalSales: 0, appSales: 0, totalSales: 0,
      commissionDue: 0, netTransfer: 0, finalBalance: 0, orderCount: 0, deliveryFees: 0,
      pdvSales: 0, pdvOrders: 0, pdvCommission: 0,
    }));
    const filtered = (selectedStore === "all" ? financeOrders : financeOrders.filter(o => o.store_id === selectedStore))
      .filter(o => !testIds.has(o.store_id));
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
    const testIds = new Set((stores || []).filter((s: any) => s.is_test).map((s: any) => s.id));
    const map = new Map<string, {
      name: string; driverId: string; totalFees: number; cashFees: number; appFees: number; deliveryCount: number;
    }>();
    drivers.forEach(d => map.set(d.user_id, {
      name: d.name || "Entregador", driverId: d.user_id, totalFees: 0, cashFees: 0, appFees: 0, deliveryCount: 0,
    }));
    financeOrders.forEach(o => {
      if (!o.driver_id) return;
      if (testIds.has(o.store_id)) return;
      const entry = map.get(o.driver_id);
      if (!entry) return;
      const fee = o.delivery_fee;
      entry.totalFees = addMoney(entry.totalFees, fee);
      entry.deliveryCount += 1;
      if (o.payment_method === "dinheiro") entry.cashFees = addMoney(entry.cashFees, fee);
      else entry.appFees = addMoney(entry.appFees, fee);
    });
    return Array.from(map.values()).filter(e => e.deliveryCount > 0).sort((a, b) => b.totalFees - a.totalFees);
  }, [financeOrders, drivers, stores]);

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
    report += `💰 Faturamento: ${formatBRL(metrics.totalSales)}\n`;
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
        `📋 Plano: ${planLabel(storePlan?.plan_type)} — ${formatBRL(Number(storePlan?.monthly_fee || 90))}/mês\n\n` +
        `📦 Total de Pedidos: ${entry.orderCount}\n` +
        `💵 Vendas Totais: ${formatBRL(entry.totalSales)}\n\n` +
        `✅ Sem taxas por pedido. Toda receita é sua!\n` +
        `📌 Assinatura mensal cobrada à parte.`;
    } else {
      const balanceText = entry.finalBalance >= 0
        ? `✅ O ItaSuper deve transferir ${formatBRL(entry.finalBalance)} para você.`
        : `⚠️ Valor a acertar com o ItaSuper: ${formatBRL(Math.abs(entry.finalBalance))}.`;
      msg = `💰 *Fechamento ItaSuper (${period})*\n\nOlá *${entry.name}*!\n\n` +
        `📋 Plano: ${planLabel(storePlan?.plan_type)}\n\n` +
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
        <AlertTriangle className="h-16 w-16 text-amber-500 dark:text-amber-400 mb-4" />
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
    { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
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
            <div className="px-4 pb-4 space-y-3">
              {["Início", "Operação", "Financeiro", "Pessoas", "Marketing", "Sistema"].map((group) => {
                const groupItems = moreTabs.filter((i) => i.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-[0.15em] px-2 mb-1.5">{group}</p>
                    <div className="space-y-1">
                      {groupItems.map((item) => {
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
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => { navigate("/"); setShowMoreSheet(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground border-t border-border/50 pt-4"
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
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-black text-foreground leading-none tabular-nums">{metrics.activeOrders}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pedidos ativos</p>
              </div>
              <div>
                <p className="text-xl font-black text-foreground leading-none tabular-nums">{metrics.totalOrders}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total pedidos</p>
              </div>
            </div>
            <div className="pt-2 border-t border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] text-muted-foreground">Vendas</span>
              </div>
              <span className="text-sm font-black text-foreground tabular-nums">{formatBRL(metrics.totalSales)}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
          {["Início", "Operação", "Financeiro", "Pessoas", "Marketing", "Sistema"].map((group, groupIdx) => {
            const items = sidebarItems.filter(i => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className={`mb-3 pb-2 ${groupIdx > 0 ? "pt-3 border-t border-border/40" : ""}`}>
                <p className="text-[10px] font-extrabold text-muted-foreground/70 uppercase tracking-[0.15em] px-3 mb-1.5">{group}</p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = activeTab === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleTabChange(item.key)}
                        className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                          isActive
                            ? "bg-primary/10 text-primary before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-primary"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isActive ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.key === "saques" && pendingWithdrawals.length > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {pendingWithdrawals.length}
                          </span>
                        )}
                        {item.key === "approvals" && pendingApprovalsCount > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {pendingApprovalsCount}
                          </span>
                        )}
                        {item.key === "dashboard" && delayedOrders.length > 0 && (
                          <span className="tabular-nums bg-destructive text-destructive-foreground text-[10px] font-black min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full">
                            {delayedOrders.length}
                          </span>
                        )}
                        {item.key === "dashboard" && complianceAlerts && complianceAlerts.length > 0 && delayedOrders.length === 0 && (
                          <span className="text-amber-600 dark:text-amber-400 text-sm leading-none">⚠</span>
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
              <span className="text-xs font-black text-foreground bg-accent px-2 py-0.5 rounded-md tabular-nums">{stores?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bike className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">Entregadores</span>
              <span className="text-xs font-black text-foreground bg-accent px-2 py-0.5 rounded-md tabular-nums">{drivers?.length || 0}</span>
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
                {TAB_SUBTITLE[activeTab]?.({
                  totalOrders: metrics.totalOrders,
                  pendingWithdrawals: pendingWithdrawals.length,
                  pendingApprovals: pendingApprovalsCount,
                  storesCount: stores?.length || 0,
                }) || " "}
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
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full tabular-nums">
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
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full tabular-nums">
                  {pendingApprovalsCount}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-6xl mx-auto">
            {/* Banner unificado de pendências */}
            {(pendingWithdrawals.length > 0 || pendingApprovalsCount > 0) &&
              activeTab !== "approvals" && activeTab !== "saques" && activeTab !== "financeiro" && (
                <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex flex-wrap items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 mr-1">Pendências:</span>
                  {pendingApprovalsCount > 0 && (
                    <button
                      onClick={() => handleTabChange("approvals")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Shield className="h-3 w-3" />
                      {pendingApprovalsCount} cadastro{pendingApprovalsCount === 1 ? "" : "s"}
                    </button>
                  )}
                  {pendingWithdrawals.length > 0 && (
                    <button
                      onClick={() => handleTabChange("financeiro")}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Wallet className="h-3 w-3" />
                      {pendingWithdrawals.length} saque{pendingWithdrawals.length === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              )}
            {activeTab === "approvals" && <AdminApprovals />}
            {activeTab === "entrega" && <DeliveryFeeConfigPanel />}
            {activeTab === "sync" && <Suspense fallback={<TabFallback />}><SyncExternalTab /></Suspense>}
            {activeTab === "coupons" && <CouponManager isAdmin />}
            {activeTab === "stores" && (
              <div className="space-y-4">
                <SubTabsBar
                  value={storesSection}
                  onChange={(v) => setStoresSection(v as StoresSection)}
                  items={[
                    { key: "lojas", label: "Lojas", icon: Store },
                    { key: "cidades", label: "Cidades", icon: MapPin },
                    { key: "entrega", label: "Entrega", icon: Truck },
                  ]}
                />
                {storesSection === "lojas" && (
                  <div className="space-y-6">
                    <TestStoreCreator />
                    <AdminStoreManager />
                  </div>
                )}
                {storesSection === "cidades" && (
                  <Suspense fallback={<TabFallback />}><CidadesTab stores={stores} /></Suspense>
                )}
                {storesSection === "entrega" && <DeliveryFeeConfigPanel />}
              </div>
            )}
            {activeTab === "planos" && <AdminPlanManager />}
            {activeTab === "pagamentos" && <Suspense fallback={<TabFallback />}><PagamentosSplitTab stores={stores || []} /></Suspense>}
            {activeTab === "juridico" && <Suspense fallback={<TabFallback />}><JuridicoTab /></Suspense>}
            {activeTab === "moderadores" && <ModeratorManager />}
            {activeTab === "suporte" && <SupportAdminPanel />}
            {activeTab === "app-page" && (
              <div className="space-y-4">
                <SubTabsBar
                  value={appPageSection}
                  onChange={(v) => setAppPageSection(v as AppPageSection)}
                  items={[
                    { key: "page", label: "Página do App", icon: Smartphone },
                    { key: "links", label: "Página /links", icon: LinkIcon },
                  ]}
                />
                {appPageSection === "page" && <AppStorePageAdmin />}
                {appPageSection === "links" && <AppLinksManager />}
              </div>
            )}
            {activeTab === "socios" && <PartnerSplitPanel />}
            {activeTab === "test_finance" && <TestStoreFinancePanel />}
            {activeTab === "links" && <AppLinksManager />}
            {activeTab === "broadcast" && <AdminBroadcastPush />}
            {activeTab === "coach" && <SalesCoachPanel />}
            {activeTab === "whatsapp_plataforma" && <Suspense fallback={<TabFallback />}><PlatformWhatsAppTab /></Suspense>}
            {activeTab === "auditoria" && (
              <div className="space-y-4">
                <SubTabsBar
                  value={auditoriaSection}
                  onChange={(v) => setAuditoriaSection(v as AuditoriaSection)}
                  items={[
                    { key: "auditoria", label: "Auditoria", icon: ShieldCheck },
                    { key: "logs", label: "Logs", icon: FileText },
                    { key: "debug-loja", label: "Debug Loja", icon: AlertTriangle },
                  ]}
                />
                {auditoriaSection === "auditoria" && (
                  <Suspense fallback={<TabFallback />}><AuditoriaTab /></Suspense>
                )}
                {auditoriaSection === "debug-loja" && (
                  <Suspense fallback={<TabFallback />}><DebugLojaTab /></Suspense>
                )}
                {auditoriaSection === "logs" && (
                  <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <h3 className="font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Histórico de Ações Administrativas
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm tabular-nums">
                      <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Admin</th>
                          <th className="px-4 py-3">Ação</th>
                          <th className="px-4 py-3">Alvo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logsLoading ? (
                          Array.from({ length: 6 }).map((_, i) => (
                            <tr key={`sk-${i}`} className={i % 2 ? "bg-muted/20" : ""}>
                              <td className="px-4 py-3"><div className="h-3 w-32 rounded bg-muted animate-pulse" /></td>
                              <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-muted animate-pulse" /></td>
                              <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-muted animate-pulse" /></td>
                              <td className="px-4 py-3"><div className="h-3 w-28 rounded bg-muted animate-pulse" /></td>
                            </tr>
                          ))
                        ) : adminLogs?.map((log, i) => (
                          <tr key={log.id} className={`hover:bg-muted/40 transition-colors ${i % 2 ? "bg-muted/20" : ""}`}>
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                              {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')}
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
                                <span className="text-[10px] text-muted-foreground font-mono">{log.target_id?.substring(0, 8)}…</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!logsLoading && (!adminLogs || adminLogs.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-12">
                              <div className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                                <FileText className="h-8 w-8 opacity-40" />
                                <p className="text-sm font-bold text-foreground">Nenhum log ainda</p>
                                <p className="text-xs">Ações administrativas aparecerão aqui.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </div>
                )}
              </div>
            )}
             {activeTab === "financeiro" && (
               <div className="space-y-4">
                 <SubTabsBar
                   value={financeSection}
                   onChange={(v) => setFinanceSection(v as FinanceSection)}
                   items={[
                     { key: "overview", label: "Visão Geral", icon: LayoutDashboard },
                     { key: "areceber", label: "A Receber", icon: Wallet },
                      { key: "mensalidades", label: "Mensalidades", icon: Crown },
                     { key: "planos-lojas", label: "Planos (Lojas)", icon: Store },
                     { key: "planos-templates", label: "Planos (Templates)", icon: FileText },
                      { key: "addons", label: "Add-ons / MRR", icon: Puzzle },
                      { key: "revendedores", label: "Revendedores", icon: Handshake },
                     { key: "historico", label: "Histórico Pago", icon: CheckCircle2 },
                     { key: "fluxo", label: "Fluxo de Caixa", icon: TrendingUp },
                     { key: "saques", label: "Saques", icon: Wallet, badge: pendingWithdrawals.length },
                     { key: "conciliacao", label: "Conciliação", icon: ShieldCheck },
                     { key: "socios", label: "Sócios", icon: Handshake },
                     { key: "test", label: "Lojas Teste", icon: FlaskConical },
                     { key: "auditoria", label: "Auditoria Financeira", icon: FileText },
                   ]}
                 />
                 {financeSection === "overview" && (
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
                 {financeSection === "saques" && (
                   <Suspense fallback={<TabFallback />}>
                     <SaquesTab
                       withdrawalRequests={withdrawalRequests}
                       pendingWithdrawals={pendingWithdrawals}
                       drivers={drivers}
                       queryClient={queryClient}
                     />
                   </Suspense>
                 )}
                 {financeSection === "areceber" && (
                   <Suspense fallback={<TabFallback />}><AReceberTab /></Suspense>
                 )}
                 {financeSection === "historico" && (
                   <Suspense fallback={<TabFallback />}><HistoricoRepassesTab /></Suspense>
                 )}
                 {financeSection === "socios" && <PartnerSplitPanel />}
                 {financeSection === "test" && <TestStoreFinancePanel />}
                 {financeSection === "fluxo" && (
                   <Suspense fallback={<TabFallback />}><FluxoCaixaPanel /></Suspense>
                 )}
                 {financeSection === "conciliacao" && (
                   <Suspense fallback={<TabFallback />}><ConciliacaoAsaasPanel /></Suspense>
                 )}
                 {financeSection === "auditoria" && (
                   <Suspense fallback={<TabFallback />}><AuditoriaFinanceiraPanel /></Suspense>
                 )}
                  {financeSection === "mensalidades" && (
                    <Suspense fallback={<TabFallback />}><MensalidadesPanel /></Suspense>
                  )}
                  {financeSection === "planos-lojas" && <AdminPlanManager />}
                  {financeSection === "planos-templates" && <AdminPlanTemplatesEditor />}
                   {financeSection === "addons" && (
                     <Suspense fallback={<TabFallback />}><AddonsMrrTab /></Suspense>
                   )}
                   {financeSection === "revendedores" && (
                     <Suspense fallback={<TabFallback />}><RevendedoresTab /></Suspense>
                   )}
               </div>
             )}
             {activeTab === "dashboard" && (
               <div className="space-y-4">
                 <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-xl mb-4">
                   {(["today", "yesterday", "week"] as DateFilter[]).map(f => (
                     <button
                       key={f}
                       onClick={() => setDateFilter(f)}
                       className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                         dateFilter === f
                           ? "bg-background text-foreground shadow-sm"
                           : "text-muted-foreground hover:text-foreground"
                       }`}
                     >
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
                         <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block"/>PDV</span>
                       </div>
                     </div>
                      <div className="h-44">
                        <Suspense fallback={null}>
                          <DailySalesChart data={adminChartData.dailyData} showPdv={adminChartData.totalPdv > 0} />
                        </Suspense>
                      </div>
                     <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30 text-center">
                       <div><p className="text-[10px] text-muted-foreground">Delivery</p><p className="text-sm font-black text-primary">{formatBRL(adminChartData.totalDelivery)}</p></div>
                       <div className="border-x border-border/30"><p className="text-[10px] text-muted-foreground">PDV</p><p className="text-sm font-black text-sky-600 dark:text-sky-400 tabular-nums">{formatBRL(adminChartData.totalPdv)}</p></div>
                       <div><p className="text-[10px] text-muted-foreground">Ticket Médio</p><p className="text-sm font-black text-foreground">{formatBRL(adminChartData.ticketMedio)}</p></div>
                     </div>
                   </div>
                 )}
                 {adminChartData.paymentData.length > 0 && (
                   <div className="bg-card rounded-2xl border border-border p-4 mb-4">
                     <p className="text-xs font-bold text-foreground mb-3">Formas de Pagamento</p>
                      <div className="h-32">
                        <Suspense fallback={null}>
                          <PaymentBreakdownChart data={adminChartData.paymentData} />
                        </Suspense>
                      </div>
                   </div>
                 )}
                 <div className="bg-card rounded-2xl border border-border p-4">
                   <p className="text-xs font-bold text-foreground mb-3">Horário de Pico</p>
                    <Suspense fallback={null}>
                      <HourlyChart data={adminChartData.hourlyData} />
                    </Suspense>
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





export default SuperAdminDashboardV2;
