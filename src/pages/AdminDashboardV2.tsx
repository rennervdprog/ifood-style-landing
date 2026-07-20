import { useEffect, useState, useRef, useCallback, useMemo, memo, lazy, Suspense, useTransition } from "react";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import SimulationBanner from "@/components/SimulationBanner";
import SignOutConfirm from "@/components/SignOutConfirm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import {
  Wifi, WifiOff, Clock, ChefHat, Truck, CheckCircle2, Pizza,
  MapPin, Package, Settings, Banknote, CreditCard,
  UtensilsCrossed, ListOrdered, Plus, Printer, Bike,
  Volume2, VolumeX, Bell, Store, MessageCircle, Copy, Coins,
  ChevronDown, ChevronUp, DollarSign, XCircle, Loader2, Search,
  Menu, X, LayoutDashboard, CircleDot, TrendingUp, BarChart3,
  Users, Timer, Star, ShoppingBag, ArrowUpRight, ArrowDownRight,
   Filter, UserCheck, UserX, MapPinned, Repeat, Heart, AlertTriangle, LogOut, User, Shield, Navigation,
  Calendar, Download, GraduationCap, ChevronRight, Monitor
} from "lucide-react";
// recharts agora vive em chunk separado (@/components/admin/AdminCharts) —
// removido do bundle inicial do AdminDashboard (~150KB gzipped).
const DailyRevenueChart = lazy(() =>
  import("@/components/admin/AdminCharts").then(m => ({ default: m.DailyRevenueChart }))
);
const HourlyBarChart = lazy(() =>
  import("@/components/admin/AdminCharts").then(m => ({ default: m.HourlyBarChart }))
);
const WeekdayBarChart = lazy(() =>
  import("@/components/admin/AdminCharts").then(m => ({ default: m.WeekdayBarChart }))
);
const PaymentPieChart = lazy(() =>
  import("@/components/admin/AdminCharts").then(m => ({ default: m.PaymentPieChart }))
);
import { openWhatsApp, formatWhatsAppNumber } from "@/lib/whatsapp";
import WhatsAppButton from "@/components/WhatsAppButton";
const MenuBuilder = lazy(() => import("@/components/MenuBuilder"));
const SupportTicketModal = lazy(() => import("@/components/SupportTicketModal"));
import { notifyOrderStatusChange, buildWhatsAppMessage, buildRichItemsBlock, buildEtaWindow } from "@/lib/orderNotifications";
import { getStoreOpenStatus } from "@/lib/storeStatus";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
// Tabs carregadas sob demanda — só baixa o JS quando o lojista abrir a aba
const TutoriaisTab = lazy(() => import("./admin/tabs/TutoriaisTab"));
const SubscriptionTab = lazy(() => import("./admin/tabs/SubscriptionTab"));
const LoyaltyTab = lazy(() => import("./admin/tabs/LoyaltyTab"));
const RefundsTab = lazy(() => import("./admin/tabs/RefundsTab"));
const MenuTab = lazy(() => import("./admin/tabs/MenuTab"));
const CashRegisterTab = lazy(() => import("./admin/tabs/CashRegisterTab"));
const AddonsTab = lazy(() => import("./admin/tabs/AddonsTab"));
const BordasTab = lazy(() => import("./admin/tabs/BordasTab"));
const HoursTab = lazy(() => import("./admin/tabs/HoursTab"));
const FinanceTab = lazy(() => import("./admin/tabs/FinanceTab"));
const DriversTab = lazy(() => import("./admin/tabs/DriversTab"));
const SettingsTab = lazy(() => import("./admin/tabs/SettingsTab"));
const CouponsTab = lazy(() => import("./admin/tabs/CouponsTab"));
const PromotionsTab = lazy(() => import("./admin/tabs/PromotionsTab"));
const DashboardOverviewSection = lazy(() => import("./admin/sections/DashboardOverviewSection"));
const AvisosSection = lazy(() => import("./admin/sections/AvisosSection"));
const RepasseSection = lazy(() => import("./admin/sections/RepasseSection"));
const OrdersSection = lazy(() => import("./admin/sections/OrdersSection"));
import AdminOrderCard from "./admin/components/AdminOrderCard";
import ClientsTab from "./admin/components/ClientsTab";
const StoreReportsPanel = lazy(() => import("@/components/store/StoreReportsPanel"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

import { printThermalReceipt } from "@/lib/thermalPrint";
import { requestNotificationPermission, notifyNewOrder, pushNotifyDeliveryAvailable } from "@/lib/notifications";
import { sendPushNotification } from "@/lib/firebase";
import { addMoney, averageMoney, formatBRL, formatCurrency, sumMoney } from "@/lib/utils";
import ProductTour, { lojistaTourSteps } from "@/components/ProductTour";
import { useStorePlan } from "@/hooks/useStorePlan";
import { useAvisosCount } from "./admin/useAvisosCount";
import { useRepassePending } from "./admin/useRepassePending";
import TrialExpiredGuard from "@/components/TrialExpiredGuard";
import CommissionAlert from "@/components/CommissionAlert";
import PlatformSplitAlert from "@/components/PlatformSplitAlert";
import {
  ALERT_SOUND_URL,
  CASH_REGISTER_SOUND_URL,
  statusColors,
  orderTabs,
  paymentLabels,
  paymentIcons,
  dashboardGroups,
  bottomNavGroupKeys,
  moreSheetGroupKeys,
  filterSubTab,
  getGroupForTab,
  type DashboardGroup,
  type DashboardGroupKey,
} from "./admin/constants";
import GroupTabsBar from "./admin/components/GroupTabsBar";
import {
  parseOrderAddons,
  normalizeAddonName,
  pad2,
  parseDashboardDate,
  toLocalDateKey,
  formatDateKeyPtBR,
  getPeriodDateKeys,
} from "./admin/helpers";
import type {
  OrderStatus,
  OrderTabKey,
  DashboardTab,
  StoreAddonGroup,
  StoreAddonLink,
  RequiredAddonHighlight,
} from "./admin/types";

const RequiredAddonHighlights = ({ highlights }: { highlights: RequiredAddonHighlight[] }) => {
  if (highlights.length === 0) return null;

  return (
    <div className="mx-3 mb-2 space-y-1.5">
      {highlights.map((highlight, index) => (
        <div key={`${highlight.itemId}-${highlight.groupName}-${highlight.addonName}-${index}`} className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {highlight.itemName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-primary">{highlight.groupName}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm font-black uppercase text-foreground">{highlight.addonName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── At-a-Glance Card Component ──
const GlanceCard = ({ icon: Icon, label, value, subValue, color = "text-primary", trend, onClick, highlight }: {
  icon: React.ElementType; label: string; value: string | number; subValue?: string; color?: string; trend?: "up" | "down" | null; onClick?: () => void; highlight?: boolean;
}) => {
  const bgColor = color.includes("primary") ? "bg-primary/10" : color.replace("text-", "bg-").replace("500", "500/15");
  
  return (
    <div onClick={onClick} className={`group relative overflow-hidden rounded-3xl p-5 flex flex-col gap-3 transition-all duration-300 ${onClick ? "cursor-pointer hover:-translate-y-1 active:scale-[0.97]" : ""} ${
      highlight 
        ? "bg-gradient-to-br from-primary/15 via-primary/5 to-background border-2 border-primary/30 shadow-xl shadow-primary/10" 
        : "bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card hover:border-border hover:shadow-xl hover:shadow-foreground/5"
    }`}>
      {highlight && <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />}
      
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${trend === "up" ? "text-emerald-500 bg-emerald-500/15" : "text-red-500 bg-red-500/15"}`}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend === "up" ? "Cresceu" : "Caiu"}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <p className="text-3xl font-black text-foreground tracking-tighter leading-none">{value}</p>
          {highlight && <span className="relative flex h-2 w-2 mb-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>}
        </div>
        <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">{label}</p>
        {subValue && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-border" />
            <p className="text-[10px] text-muted-foreground/70 font-medium">{subValue}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Client Filter type ──
type ClientFilter =
  | "all"
  | "new"
  | "weekly"
  | "vip"
  | "atrisk"
  | "inactive30"
  | "inactive45"
  | "inactive60"
  | "highticket"
  | "location";

export type ClientSort = "orders" | "spent" | "recent" | "inactive";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isMatriz, loading: roleLoading } = useUserRole();

  // Redirecionar matriz para painel matriz (se acessar /admin diretamente)
  useEffect(() => {
    if (!roleLoading && isMatriz) {
      navigate("/matriz", { replace: true });
    }
  }, [isMatriz, roleLoading, navigate]);
  const [searchParams] = useSearchParams();
  const simulateStoreId = searchParams.get("storeId");
  const initialTabParam = searchParams.get("tab") as DashboardTab | null;
  const queryClient = useQueryClient();
  const { confirm: confirmReprint, ConfirmDialog: ReprintConfirmDialog } = useConfirmDialog();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cashSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    try {
      cashSoundRef.current = new Audio(CASH_REGISTER_SOUND_URL);
      cashSoundRef.current.volume = 1.0;
      cashSoundRef.current.preload = "auto";
    } catch {}
    return () => { cashSoundRef.current = null; };
  }, []);

  const [isOnline, setIsOnline] = useState(true);
  const [realtimeDriversConnected, setRealtimeDriversConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderTabKey>("pendente");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(
    initialTabParam || "dashboard",
  );
  const [isPendingTab, startTabTransition] = useTransition();
  // Fonte única da verdade: store.settings.auto_print_delivery (do banco).
  // O sino do topo lê/escreve direto desse setting — não há mais override local
  // por navegador, que era o principal motivo do lojista achar que estava
  // "ligado" quando na verdade estava desligado neste dispositivo.
  const [autoPrintSaving, setAutoPrintSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  const [soundMuted, setSoundMuted] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [settlementSearch, setSettlementSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<ClientFilter>("all");
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientSort, setClientSort] = useState<ClientSort>("orders");
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [showDelayedPanel, setShowDelayedPanel] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [selectedReportPeriod, setSelectedReportPeriod] = useState(30);
  const [reportSubTab, setReportSubTab] = useState<"overview" | "sales" | "products" | "hours">("overview");
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchDispatching, setBatchDispatching] = useState(false);

  const prevPendingCountRef = useRef(0);

  const toggleAddress = useCallback((orderId: string) => {
    setExpandedAddresses(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  }, []);

  // ── DATA QUERIES ──
  const { data: myProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isApproved = myProfile?.is_approved ?? false;
  const { data: adminRole, isLoading: adminRoleLoading } = useQuery({
    queryKey: ["admin-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();

      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  const isPlatformAdmin = Boolean(adminRole);
  const activeSimulateStoreId = isPlatformAdmin ? simulateStoreId : null;

  useEffect(() => {
    if (simulateStoreId && !adminRoleLoading && !isPlatformAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [simulateStoreId, adminRoleLoading, isPlatformAdmin, navigate]);

  const { data: store, error: storeError, isLoading: storeLoading } = useQuery({
    queryKey: ["my-store", user?.id, activeSimulateStoreId],
    queryFn: async () => {
      if (activeSimulateStoreId) {
        const { data, error } = await supabase.from("stores").select("*").eq("id", activeSimulateStoreId).maybeSingle();
        if (error) throw error;
        return data;
      }
      // Buscar profile para saber se é unidade (lojista_unidade tem unit_store_id)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, unit_store_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      // Se for lojista_unidade, busca a loja pela unit_store_id
      let query = supabase.from("stores").select("*");
      if ((profile as any)?.role === "lojista_unidade" && (profile as any)?.unit_store_id) {
        query = query.eq("id", (profile as any).unit_store_id);
      } else {
        query = query.eq("owner_id", user!.id);
      }
      // Defensivo: se um mesmo owner tiver >1 loja (raro, ex. dados legados),
      // pega a mais recente em vez de estourar PGRST116 e sumir a loja.
      const { data: rows, error } = await query
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        console.error("[AdminDashboard] store query error:", error);
        throw error;
      }
      return rows?.[0] ?? null;
    },
    enabled: !!user && (!simulateStoreId || !adminRoleLoading),
    staleTime: 1000 * 60 * 5, // 5min — catálogo muda raramente
  });

  const storePlan = useStorePlan(store?.id);

  // Detecta se Evolution API (WhatsApp automático) está conectado para a loja.
  // Quando conectado, os botões de fluxo de pedido NÃO abrem o wa.me manual —
  // a mensagem é enviada automaticamente pelo backend (evolution-send-message).
  const { data: evolutionConnected = false } = useQuery({
    queryKey: ["store-evo-connected", store?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_whatsapp_config")
        .select("status")
        .eq("store_id", store!.id)
        .maybeSingle();
      return data?.status === "connected";
    },
    enabled: !!store?.id,
    staleTime: 30_000,
  });

  // Keepalive Evolution: ao abrir o painel e a cada 5 min, pinga o estado
  // e reconecta automaticamente se a sessão tiver caído (sem pedir QR novo
  // se o auth do Baileys ainda existir). Resolve o caso de "dormir e
  // precisar escanear o QR de novo de manhã".
  useEffect(() => {
    if (!store?.id) return;
    let cancelled = false;
    const ping = () => {
      supabase.functions
        .invoke("evolution-keepalive", { body: {}, headers: {} as any })
        .catch(() => undefined);
    };
    // 1º ping imediato (tab visível) + intervalo
    ping();
    const id = setInterval(() => { if (!cancelled && !document.hidden) ping(); }, 5 * 60_000);
    const onVis = () => { if (!document.hidden) ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [store?.id]);

  const refreshDashboardOrders = useCallback(async () => {
    if (!store?.id) return;

    await Promise.allSettled([
      queryClient.refetchQueries({ queryKey: ["my-store", user?.id, activeSimulateStoreId], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["store-orders", store.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["store-all-orders", store.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["store-hours-check", store.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["store-drivers-list", store.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["client-profiles", store.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["online-drivers-count"], type: "active" }),
    ]);
  }, [activeSimulateStoreId, queryClient, store?.id, user?.id]);

  

  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-orders", store?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, status, total_price, subtotal, delivery_fee, payment_method, created_at, confirmed_at, client_id, store_id, driver_id, delivery_pin, address_details, neighborhood, needs_change, change_for, scheduled_for, order_source, commission_rate, pix_proof_url, pix_proof_uploaded_at, pix_expires_at, order_items(id, quantity, unit_price, observations, addons, products(name))")
        .eq("store_id", store!.id)
        .neq("status", "aguardando_pagamento" as any)
        .neq("status", "cancelado" as any)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!store,
    staleTime: 10_000, // 10s — pedidos ativos
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const { data: allOrders } = useQuery({
    queryKey: ["store-all-orders", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, quantity, unit_price, observations, addons, products(name))")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
    enabled: !!store,
    staleTime: 30_000, // 30s — histórico de pedidos
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !store?.id) return;

    let active = true;
    let cleanup: (() => void) | undefined;

    import("@capacitor/app")
      .then(async ({ App }) => {
        if (!active) return;

        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;
          refreshDashboardOrders().catch(console.error);
        });

        cleanup = () => {
          listener.remove();
        };
      })
      .catch(() => {
        cleanup = undefined;
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [refreshDashboardOrders, store?.id]);

  // ── Fase 2: atalhos de teclado (desktop/KDS) ──
  // D = dashboard, O = pedidos, P = pendentes, R = preparando, E = prontos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "d") setDashboardTab("dashboard");
      else if (k === "o") setDashboardTab("orders");
      else if (k === "p") { setDashboardTab("orders"); setActiveTab("pendente"); }
      else if (k === "r") { setDashboardTab("orders"); setActiveTab("preparando"); }
      else if (k === "e") { setDashboardTab("orders"); setActiveTab("pronto_para_entrega"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!store?.id) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshDashboardOrders().catch(console.error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshDashboardOrders, store?.id]);

  const { data: storeAddonGroups = [] } = useQuery({
    queryKey: ["store-order-addon-groups", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("id, name, min_select, product_id, addon_items(name)")
        .eq("store_id", store!.id);
      if (error) throw error;
      return (data || []) as StoreAddonGroup[];
    },
    enabled: !!store,
    staleTime: 1000 * 60 * 5,
  });

  const { data: storeAddonLinks = [] } = useQuery({
    queryKey: ["store-order-addon-links", store?.id, storeAddonGroups.length],
      staleTime: 5 * 60_000,  // 5min — adicionais raramente mudam
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("addon_group_id, product_id")
        .in("addon_group_id", storeAddonGroups.map((group) => group.id));
      if (error) throw error;
      return (data || []) as StoreAddonLink[];
    },
    enabled: !!store && storeAddonGroups.length > 0,
  });

  const { data: onlineDrivers } = useQuery({
    queryKey: ["online-drivers-count"],
    queryFn: async () => {
      const { data: allOnline, error } = await supabase.from("drivers").select("id, name, user_id").eq("is_online", true).eq("is_active", true);
      if (error) throw error;
      const { data: busyDriverIds } = await supabase.from("orders").select("driver_id").in("status", ["pronto_para_entrega", "em_transito", "saiu_entrega", "entregue"] as any[]).not("driver_id", "is", null);
      const busySet = new Set((busyDriverIds || []).map((o: any) => o.driver_id));
      return (allOnline || []).filter((d: any) => !busySet.has(d.user_id));
    },
    staleTime: 1000 * 30,
  });

  // Realtime drivers
  useEffect(() => {
    if (!store) return;
    const city = (store as any)?.address_city || null;
    const ch = supabase.channel(`drivers-online-rt-${store.id}`)
      .on(
        "postgres_changes",
        // Filter by city when available — avoids receiving driver events from other cities
        city
          ? { event: "*", schema: "public", table: "drivers", filter: `city=eq.${city}` }
          : { event: "*", schema: "public", table: "drivers" },
        () => queryClient.invalidateQueries({ queryKey: ["online-drivers-count"] })
      );
    subscribeWithRejoin(ch, (status) => setRealtimeDriversConnected(status === "SUBSCRIBED"));
    return () => { cleanupChannel(ch); };
  }, [queryClient, store]);

  const driverIds = [...new Set(orders?.map(o => o.driver_id).filter(Boolean) || [])] as string[];
  const { data: driverProfiles } = useQuery({
    queryKey: ["driver-profiles", driverIds],
    queryFn: async () => { const { data } = await supabase.from("drivers").select("user_id, name").in("user_id", driverIds); return data || []; },
    enabled: driverIds.length > 0,
    staleTime: 1000 * 60 * 3,
  });

  // Fetch store drivers list for own-delivery stores
  const { data: linkedStoreDrivers, isLoading: driversLoading } = useQuery({
    queryKey: ["store-drivers-list", store?.id],
      staleTime: 60_000,         // 1min — lista de motoboys
    queryFn: async () => {
      const { data: sdLinks } = await supabase.from("store_drivers").select("driver_user_id").eq("store_id", store!.id);
      if (!sdLinks?.length) return [];
      const userIds = sdLinks.map(d => d.driver_user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone, whatsapp_number").in("user_id", userIds);
      // If RLS blocks profile reads, still return driver links so hasLinkedDrivers is accurate
      if (!profiles?.length) {
        return sdLinks.map(d => ({ user_id: d.driver_user_id, full_name: "Motoboy", phone: null, whatsapp_number: null }));
      }
      return profiles;
    },
    enabled: !!store && (store as any)?.delivery_mode === "own",
  });

  const getDriverName = useCallback((driverId: string) => {
    const fromDrivers = driverProfiles?.find((dr: any) => dr.user_id === driverId);
    if (fromDrivers?.name) return fromDrivers.name;
    const fromLinked = linkedStoreDrivers?.find((p: any) => p.user_id === driverId);
    if (fromLinked?.full_name) return fromLinked.full_name;
    return "Entregador";
  }, [driverProfiles, linkedStoreDrivers]);

  const isStoreDriver = (driverId: string) => linkedStoreDrivers?.some((p: any) => p.user_id === driverId) ?? false;

  const clientIds = [...new Set(orders?.map(o => o.client_id) || [])];
  const { data: clientProfiles } = useQuery({
    queryKey: ["client-profiles", store?.id, orders?.length ?? 0],
    queryFn: async () => {
      const ids = (orders?.map((o: any) => o.id) || []).filter(Boolean);
      const { data } = await supabase.rpc("get_delivery_contacts", {
        _order_ids: ids.length ? ids : null,
      });
      return data || [];
    },
    // ⚡ Perf: RPC agora filtra pelos IDs visíveis (evita varrer todos os
    // pedidos da loja). Cache amplo de 15min — contato raramente muda.
    enabled: !!store && clientIds.length > 0,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const getClientWhatsApp = useCallback((clientId: string) => {
    const p = clientProfiles?.find((c: any) => c.user_id === clientId);
    return (p as any)?.whatsapp_number || (p as any)?.phone || "";
  }, [clientProfiles]);
  const getClientName = useCallback((clientId: string) => clientProfiles?.find((c: any) => c.user_id === clientId)?.full_name || "Cliente", [clientProfiles]);

  const requiredAddonGroupsByProduct = useMemo(() => {
    const groupsById = new Map(storeAddonGroups.map((group) => [group.id, group]));
    const result = new Map<string, StoreAddonGroup[]>();

    storeAddonGroups.forEach((group) => {
      if (group.min_select <= 0 || !group.product_id) return;
      const existing = result.get(group.product_id) || [];
      existing.push(group);
      result.set(group.product_id, existing);
    });

    storeAddonLinks.forEach((link) => {
      const group = groupsById.get(link.addon_group_id);
      if (!group || group.min_select <= 0) return;
      const existing = result.get(link.product_id) || [];
      if (!existing.some((entry) => entry.id === group.id)) {
        existing.push(group);
        result.set(link.product_id, existing);
      }
    });

    return result;
  }, [storeAddonGroups, storeAddonLinks]);

  const getRequiredAddonHighlights = useCallback((order: any): RequiredAddonHighlight[] => {
    const highlights: RequiredAddonHighlight[] = [];

    order.order_items?.forEach((item: any) => {
      const itemName = item.quantity > 1 ? `${item.quantity}x ${getOrderItemDisplayName(item)}` : getOrderItemDisplayName(item);
      const addons = parseOrderAddons(item.addons);

      addons
        .filter((addon: any) => addon?.required && addon?.groupName && addon?.name)
        .forEach((addon: any) => {
          highlights.push({
            itemId: item.id,
            itemName,
            groupName: addon.groupName,
            addonName: addon.name,
          });
        });

      const fallbackGroups = requiredAddonGroupsByProduct.get(item.product_id) || [];
      if (fallbackGroups.length === 0) return;

      // Dedup key uses only addonName (not groupName) so renamed groups don't cause duplicates
      const existingAddonNames = new Set(
        highlights
          .filter((highlight) => highlight.itemId === item.id)
          .map((highlight) => normalizeAddonName(highlight.addonName))
      );

      fallbackGroups.forEach((group) => {
        const groupAddonNames = new Set((group.addon_items || []).map((addon) => normalizeAddonName(addon.name || "")));

        addons.forEach((addon: any) => {
          if (!addon?.name) return;

          const normalizedAddonName = normalizeAddonName(addon.name);

          if (!groupAddonNames.has(normalizedAddonName) || existingAddonNames.has(normalizedAddonName)) return;

          highlights.push({
            itemId: item.id,
            itemName,
            groupName: group.name,
            addonName: addon.name,
          });
          existingAddonNames.add(normalizedAddonName);
        });
      });
    });

    return highlights;
  }, [requiredAddonGroupsByProduct]);

  // ── CLIENT ANALYTICS (mini-CRM) ──
  const clientAnalytics = useMemo(() => {
    if (!allOrders || !clientProfiles) return [];
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const map = new Map<string, { orders: any[]; totalSpent: number; lastOrder: string; firstOrder: string; neighborhood: string }>();

    allOrders.forEach((order: any) => {
      if (order.status === "aguardando_pagamento") return;
      const existing = map.get(order.client_id) || { orders: [], totalSpent: 0, lastOrder: "", firstOrder: "", neighborhood: "" };
      existing.orders.push(order);
      if (order.status !== "cancelado") existing.totalSpent = addMoney(existing.totalSpent, order.total_price);
      if (!existing.lastOrder || order.created_at > existing.lastOrder) existing.lastOrder = order.created_at;
      if (!existing.firstOrder || order.created_at < existing.firstOrder) existing.firstOrder = order.created_at;
      const profile = clientProfiles.find((p: any) => p.user_id === order.client_id);
      if (profile) existing.neighborhood = (profile as any).neighborhood || order.neighborhood || "";
      map.set(order.client_id, existing);
    });

    const list = Array.from(map.entries()).map(([clientId, data]) => {
      const completedOrders = data.orders.filter((o: any) => !["cancelado", "aguardando_pagamento"].includes(o.status));
      const cancelledOrders = data.orders.filter((o: any) => o.status === "cancelado");
      const ticketMedio = averageMoney(data.totalSpent, completedOrders.length);

      const productCount = new Map<string, number>();
      const paymentCount = new Map<string, number>();
      data.orders.forEach((o: any) => {
        if (o.payment_method) paymentCount.set(o.payment_method, (paymentCount.get(o.payment_method) || 0) + 1);
        o.order_items?.forEach((item: any) => {
          const name = getOrderItemDisplayName(item);
          productCount.set(name, (productCount.get(name) || 0) + item.quantity);
        });
      });
      let favProduct = "N/A"; let maxC = 0;
      productCount.forEach((c, n) => { if (c > maxC) { maxC = c; favProduct = n; } });
      let preferredPayment = ""; let maxP = 0;
      paymentCount.forEach((c, n) => { if (c > maxP) { maxP = c; preferredPayment = n; } });

      const daysSinceLastOrder = Math.floor((now - new Date(data.lastOrder).getTime()) / DAY);
      const daysSinceFirstOrder = Math.floor((now - new Date(data.firstOrder).getTime()) / DAY);
      const ordersLast30 = completedOrders.filter((o: any) => (now - new Date(o.created_at).getTime()) / DAY <= 30).length;

      // Frequência média entre pedidos (em dias)
      let avgFrequencyDays = 0;
      if (completedOrders.length >= 2) {
        const sorted = [...completedOrders].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
        let totalGap = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalGap += (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()) / DAY;
        }
        avgFrequencyDays = Math.round(totalGap / (sorted.length - 1));
      }
      const nextOrderInDays = avgFrequencyDays > 0 ? avgFrequencyDays - daysSinceLastOrder : null;
      const cancelRate = data.orders.length > 0 ? (cancelledOrders.length / data.orders.length) * 100 : 0;

      return {
        clientId,
        name: getClientName(clientId),
        phone: getClientWhatsApp(clientId),
        neighborhood: data.neighborhood,
        totalOrders: completedOrders.length,
        totalSpent: data.totalSpent,
        ticketMedio,
        favProduct,
        preferredPayment,
        lastOrder: data.lastOrder,
        firstOrder: data.firstOrder,
        daysSinceLastOrder,
        daysSinceFirstOrder,
        ordersLast30,
        avgFrequencyDays,
        nextOrderInDays,
        cancelRate,
        orders: data.orders,
      };
    });

    // segment + isVip dependem da média da loja
    const avgTicketStore = list.length > 0 ? list.reduce((s, c) => s + c.ticketMedio, 0) / list.length : 0;

    return list.map((c) => {
      const isHighTicket = avgTicketStore > 0 && c.ticketMedio > avgTicketStore * 1.2;
      const isVip = c.totalOrders >= 10 && c.daysSinceLastOrder <= 30;
      const isWeekly = c.ordersLast30 >= 4;
      const isNew = c.daysSinceFirstOrder <= 30;
      let segment: "vip" | "weekly" | "new" | "atrisk" | "inactive" | "active" = "active";
      if (c.daysSinceLastOrder >= 30) segment = "inactive";
      else if (c.daysSinceLastOrder >= 15) segment = "atrisk";
      else if (isVip) segment = "vip";
      else if (isWeekly) segment = "weekly";
      else if (isNew) segment = "new";
      return { ...c, isHighTicket, isVip, isWeekly, isNew, segment };
    }).sort((a, b) => b.totalOrders - a.totalOrders);
  }, [allOrders, clientProfiles]);

  // contagens por segmento (para mini-cards e badges dos chips)
  const clientCounts = useMemo(() => ({
    total: clientAnalytics.length,
    new: clientAnalytics.filter(c => c.isNew).length,
    weekly: clientAnalytics.filter(c => c.isWeekly).length,
    vip: clientAnalytics.filter(c => c.isVip).length,
    atrisk: clientAnalytics.filter(c => c.daysSinceLastOrder >= 15 && c.daysSinceLastOrder < 30).length,
    inactive30: clientAnalytics.filter(c => c.daysSinceLastOrder >= 30 && c.daysSinceLastOrder < 45).length,
    inactive45: clientAnalytics.filter(c => c.daysSinceLastOrder >= 45 && c.daysSinceLastOrder < 60).length,
    inactive60: clientAnalytics.filter(c => c.daysSinceLastOrder >= 60).length,
    highticket: clientAnalytics.filter(c => c.isHighTicket).length,
  }), [clientAnalytics]);

  const filteredClients = useMemo(() => {
    let list = [...clientAnalytics];
    switch (clientFilter) {
      case "new": list = list.filter(c => c.isNew); break;
      case "weekly": list = list.filter(c => c.isWeekly); break;
      case "vip": list = list.filter(c => c.isVip); break;
      case "atrisk": list = list.filter(c => c.daysSinceLastOrder >= 15 && c.daysSinceLastOrder < 30); break;
      case "inactive30": list = list.filter(c => c.daysSinceLastOrder >= 30 && c.daysSinceLastOrder < 45); break;
      case "inactive45": list = list.filter(c => c.daysSinceLastOrder >= 45 && c.daysSinceLastOrder < 60); break;
      case "inactive60": list = list.filter(c => c.daysSinceLastOrder >= 60); break;
      case "highticket": list = list.filter(c => c.isHighTicket); break;
      case "location": list.sort((a, b) => (a.neighborhood || "zzz").localeCompare(b.neighborhood || "zzz")); break;
    }

    if (clientSearch.trim()) {
      const s = clientSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s) || (c.neighborhood || "").toLowerCase().includes(s) || c.phone.includes(s));
    }

    if (clientFilter !== "location") {
      switch (clientSort) {
        case "orders": list.sort((a, b) => b.totalOrders - a.totalOrders); break;
        case "spent": list.sort((a, b) => b.totalSpent - a.totalSpent); break;
        case "recent": list.sort((a, b) => a.daysSinceLastOrder - b.daysSinceLastOrder); break;
        case "inactive": list.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder); break;
      }
    }
    return list;
  }, [clientAnalytics, clientFilter, clientSearch, clientSort]);

  // ── SOUND SYSTEM ──
   const playAlert = useCallback(async () => {
     if (!soundEnabled || soundMuted) return;
     try {
       if (!audioRef.current) {
         audioRef.current = new Audio(ALERT_SOUND_URL);
         audioRef.current.volume = 1.0;
       }
       await audioRef.current.play();
       
       // Vibration on native devices or supported browsers
       if ("vibrate" in navigator) {
         navigator.vibrate([300, 100, 300, 100, 500]);
       }
       } catch (err) {
         console.warn("[Admin] Alert sound blocked by browser:", err);
       }
     }, [soundEnabled, soundMuted]);

  const activateSound = useCallback(() => {
    const audio = new Audio(ALERT_SOUND_URL);
    audio.volume = 0.3;
    audio.play().then(() => {
      audioRef.current = audio;
      setSoundEnabled(true);
      setShowSoundPrompt(false);
      requestNotificationPermission();
      toast.success("🔔 Alertas sonoros ativados!");
    }).catch(() => toast.error("Não foi possível ativar o som."));
  }, []);

  useEffect(() => {
    const pendingCount = orders?.filter(o => o.status === "pendente").length || 0;
    if (pendingCount > 0 && soundEnabled && !soundMuted) {
      playAlert();
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = setInterval(() => {
        if (document.hidden) return;
        playAlert();
      }, 12000);
    } else {
      if (loopIntervalRef.current) { clearInterval(loopIntervalRef.current); loopIntervalRef.current = null; }
    }
    return () => { if (loopIntervalRef.current) { clearInterval(loopIntervalRef.current); loopIntervalRef.current = null; } };
  }, [orders, soundEnabled, soundMuted, playAlert]);

  // ── AUTO-PRINT HELPER ──
  // Único ponto de impressão automática para pedidos de delivery.
  // Respeita toggle rápido (localStorage.autoPrint) e settings.auto_print_delivery.
  // Dedupe via sessionStorage["printed-order:{id}"].
  const autoPrintDeliveryOrder = useCallback(async (orderId: string, source?: string | null) => {
    if (!orderId) return;
    if (source === "pdv") {
      console.info("[auto-print] pulado: motivo=pdv", orderId);
      return;
    }
    const storeAutoDelivery = (store?.settings as any)?.auto_print_delivery !== false;
    if (!storeAutoDelivery) {
      console.info("[auto-print] pulado: motivo=settings-off", orderId);
      return;
    }
    try {
      const { data: full } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("id", orderId)
        .maybeSingle();
      if (!full) return;
      if ((full as any).order_source === "pdv") return;
      // Dedupe server-side: se já tem printed_at, não imprime de novo em nenhum
      // dispositivo/aba (antes era só sessionStorage por aba).
      if ((full as any).printed_at) {
        console.info("[auto-print] pulado: motivo=already-printed", orderId);
        return;
      }
      // Marca ANTES de imprimir de forma atômica (só quem "ganhar" a corrida
      // imprime). Se a UPDATE não afetar linha, outro dispositivo já pegou.
      const { data: claim } = await supabase
        .from("orders")
        .update({ printed_at: new Date().toISOString() } as any)
        .eq("id", orderId)
        .is("printed_at", null)
        .select("id")
        .maybeSingle();
      if (!claim) {
        console.info("[auto-print] pulado: motivo=claim-lost", orderId);
        return;
      }
      const copies = (store?.settings as any)?.print_copies === 1 ? 1 : 2;
      const paperWidth = (store?.settings as any)?.print_paper_width === 58 ? 58 : 80;
      let name = getClientName((full as any).client_id);
      let phone = getClientWhatsApp((full as any).client_id);
      if (!name || name === "Cliente" || !phone) {
        try {
          const { data } = await supabase.rpc("get_delivery_contacts", { _order_ids: [orderId] });
          const row = (data || []).find((r: any) => r.user_id === (full as any).client_id) || (data || [])[0];
          if (row) {
            if (row.full_name) name = row.full_name;
            if (!phone) phone = row.whatsapp_number || row.phone || "";
          }
        } catch (e) { console.warn("[auto-print] contact fetch failed", e); }
      }
      console.info("[auto-print] imprimindo", orderId);
      try {
        printThermalReceipt(full as any, store?.name || "Loja", name || "Cliente", phone, { copies, paperWidth });
      } catch (e) {
        // Falhou depois do claim — libera o pedido pra outra tentativa/dispositivo.
        console.warn("[auto-print] print falhou, revertendo claim", e);
        await supabase.from("orders").update({ printed_at: null } as any).eq("id", orderId);
      }
    } catch (e) {
      console.warn("[auto-print] falhou", e);
    }
  }, [store?.settings, store?.name, getClientName, getClientWhatsApp]);

  // Expõe globalmente para chamadas fora da árvore React (ex: OrdersSection).
  useEffect(() => {
    (window as any).__autoPrintDeliveryOrder = autoPrintDeliveryOrder;
    return () => { try { delete (window as any).__autoPrintDeliveryOrder; } catch {} };
  }, [autoPrintDeliveryOrder]);

  // ── REALTIME ORDERS ──
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel(`admin-orders-rt-${store.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, (payload) => {
        const updated = payload.new as any;
        const previous = payload.old as any;
        // Instant cache patch for active orders
        ["store-orders", "store-all-orders"].forEach(key => {
          queryClient.setQueryData([key, store.id], (old: any[] | undefined) => {
            if (!old) return old;
            const idx = old.findIndex((o: any) => o.id === updated.id);
            const shouldShowInActiveList = key !== "store-orders"
              ? true
              : updated && updated.status !== "aguardando_pagamento" && updated.status !== "cancelado";

            if (idx >= 0) {
              if (!shouldShowInActiveList) {
                return old.filter((o: any) => o.id !== updated.id);
              }

              const c = [...old];
              c[idx] = { ...c[idx], ...updated };
              return c;
            }

            if ((payload.eventType === "INSERT" || payload.eventType === "UPDATE") && shouldShowInActiveList) {
              return [updated, ...old];
            }

            return old;
          });
        });
        // Refetch apenas para INSERT (novos pedidos precisam de relações order_items)
        // Para UPDATE, o patch do cache acima já é suficiente na maioria dos casos
        if (payload.eventType === "INSERT") {
          refreshDashboardOrders().catch(console.error);
        }
        if (payload.eventType === "INSERT" && (payload.new as any).status === "pendente") {
          playAlert();
          notifyNewOrder();
          toast.info("🔔 Novo pedido!", { duration: 8000 });
          // Aguarda 1.2s para dar tempo do refresh trazer order_items no banco.
          const orderId = (payload.new as any).id as string;
          const src = (payload.new as any).order_source;
          setTimeout(() => { autoPrintDeliveryOrder(orderId, src); }, 1200);
        }
        if (payload.eventType === "UPDATE" && (payload.new as any).status === "pendente" && previous?.status === "aguardando_pagamento") {
          try {
            if (cashSoundRef.current) {
              cashSoundRef.current.currentTime = 0;
              cashSoundRef.current.play().catch(() => {});
            }
          } catch {}
          toast.success("💰 PIX confirmado!", { duration: 8000 });
          notifyNewOrder();
          // Pix (gateway ou direto) recém-confirmado — imprime também.
          const orderId = (payload.new as any).id as string;
          const src = (payload.new as any).order_source;
          setTimeout(() => { autoPrintDeliveryOrder(orderId, src); }, 500);
        }
        if (payload.eventType === "UPDATE" && (payload.new as any).status === "finalizado") {
          toast.success("✅ Pedido finalizado!", { duration: 5000 });
        }
      });
    subscribeWithRejoin(channel, (status) => {
      const connected = status === "SUBSCRIBED";
      setIsOnline(connected);
      if (connected) {
        refreshDashboardOrders().catch(console.error);
        runAutoPrintSweep();
      }
    });
    return () => { cleanupChannel(channel); };
  }, [store, queryClient, playAlert, refreshDashboardOrders, autoPrintDeliveryOrder]);

  // Varredura: busca pendentes das últimas 6h SEM printed_at e imprime.
  // Server-side dedupe via printed_at garante que roda em vários dispositivos
  // sem imprimir duplicado.
  const runAutoPrintSweep = useCallback(async () => {
    if (!store?.id) return;
    try {
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id, order_source, status, created_at, printed_at" as any)
        .eq("store_id", store.id)
        .eq("status", "pendente")
        .is("printed_at" as any, null)
        .gte("created_at", cutoff);
      (data || []).forEach((o: any) => {
        if (o.order_source !== "pdv") autoPrintDeliveryOrder(o.id, o.order_source);
      });
    } catch (e) { console.warn("[auto-print] sweep falhou", e); }
  }, [store?.id, autoPrintDeliveryOrder]);

  // Gatilhos redundantes: polling a cada 30s + quando a aba volta ao foco.
  // Cobre casos onde Realtime falhou (aba em background, rede instável).
  useEffect(() => {
    if (!store?.id) return;
    const interval = setInterval(() => { runAutoPrintSweep(); }, 30_000);
    const onVisible = () => { if (!document.hidden) runAutoPrintSweep(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [store?.id, runAutoPrintSweep]);

  // ── ACTIONS ──
  const handlePrint = useCallback((order: any) => {
    const copies = (store?.settings as any)?.print_copies === 1 ? 1 : 2;
    const paperWidth = (store?.settings as any)?.print_paper_width === 58 ? 58 : 80;
    doPrintOrder(order, copies, paperWidth);
  }, [store?.name, store?.settings, getClientName, getClientWhatsApp]);

  // Print resiliente: se o cache de clientProfiles ainda não carregou
  // (nome fica "Cliente" e telefone vazio), busca on-demand direto na RPC
  // antes de enviar pra impressora.
  const doPrintOrder = useCallback(async (order: any, copies: 1 | 2, paperWidth: 58 | 80) => {
    let name = getClientName(order.client_id);
    let phone = getClientWhatsApp(order.client_id);
    if (!name || name === "Cliente" || !phone) {
      try {
        const { data } = await supabase.rpc("get_delivery_contacts", { _order_ids: [order.id] });
        const row = (data || []).find((r: any) => r.user_id === order.client_id) || (data || [])[0];
        if (row) {
          if (row.full_name) name = row.full_name;
          if (!phone) phone = row.whatsapp_number || row.phone || "";
        }
      } catch (e) { console.warn("print contact fetch failed", e); }
    }
    printThermalReceipt(order, store?.name || "Loja", name || "Cliente", phone, { copies, paperWidth });
  }, [store?.name, getClientName, getClientWhatsApp]);

  /**
   * Mensagem de ACEITE do pedido — sem PIN.
   * O PIN é enviado apenas quando o pedido for marcado como PRONTO.
   */
  const buildAcceptMessage = useCallback((order: any): string => {
    const itemsList = order.order_items
      ?.map((i: any) => `  • ${i.quantity}x ${getOrderItemDisplayName(i)}`)
      .join("\n") || "";
    return (
      `✅ Olá ${getClientName(order.client_id)}! Seu pedido foi aceito pela *${store?.name || "ItaSuper"}* e já está em produção! 🍳\n\n` +
      `*Pedido #${order.id.slice(0, 8).toUpperCase()}*\n` +
      (itemsList ? `${itemsList}\n\n` : "") +
      `💰 Total: *${formatBRL(Number(order.total_price))}*\n` +
      `💳 Pagamento: ${paymentLabels[order.payment_method] || "—"} ${paymentIcons[order.payment_method] || ""}\n\n` +
      `Avisaremos quando estiver pronto! 😊`
    );
  }, [store?.name, getClientName]);

  /**
   * Mensagem de PRONTO — com PIN de segurança.
   * Enviada quando o lojista marca o pedido como "pronto_para_entrega".
   */
   const buildReadyMessage = useCallback((order: any): string => {
     const pin = (order as any).delivery_pin;
     const pinBlock = pin
       ? `\n\n🔑 *CÓDIGO DE ENTREGA: ${pin}*\nGuarde este código! Informe ao motoboy *somente* quando ele chegar com seu pedido.\n\n⚠️ Não compartilhe antes da entrega.`
       : "";
     return (
       `📦 Olá ${getClientName(order.client_id)}! Seu pedido da *${store?.name || "ItaSuper"}* está *PRONTO*! 🎉\n\n` +
       `Já está a caminho! 🛵` +
       pinBlock
     );
   }, [store?.name, getClientName]);

  /**
   * Gera o href WhatsApp para o botão PRONTO (com PIN).
   */
  const buildReadyWhatsAppHref = useCallback((order: any): string => {
    // Quando Evolution API está conectado, NÃO abrimos wa.me — o backend envia automaticamente.
    if (evolutionConnected) return "#";
    const clientPhone = getClientWhatsApp(order.client_id);
    if (!clientPhone) {
      console.warn("[buildReadyWhatsAppHref] phone ausente p/ pedido", order.id.slice(0, 8));
      return "#";
    }
    const msg = buildReadyMessage(order);
    const phone = formatWhatsAppNumber(clientPhone);
    const href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    return href;
  }, [getClientWhatsApp, buildReadyMessage, clientProfiles, evolutionConnected]);

  /**
   * Gera o href completo do WhatsApp para o botão "ACEITAR PEDIDO".
   * Usando link <a> em vez de window.open() — links <a target="_blank"> não são
   * bloqueados por popup blockers do navegador, resolvendo o bug de abertura.
   */
  const buildAcceptWhatsAppHref = useCallback((order: any): string => {
    if (evolutionConnected) return "#";
    const clientPhone = getClientWhatsApp(order.client_id);
    if (!clientPhone) return "#";
    const msg = buildAcceptMessage(order);
    const phone = formatWhatsAppNumber(clientPhone);
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }, [getClientWhatsApp, buildAcceptMessage, evolutionConnected]);

  /**
   * Chamado junto com o clique em ACEITAR PEDIDO.
   * Responsabilidade: disparar o print e atualizar o status.
   * O WhatsApp é aberto via link <a> no JSX (não via window.open).
   */
  const handleAcceptOrder = useCallback(async (order: any) => {
    // Se a notinha já foi disparada automaticamente (auto-print), pergunta
    // ao lojista se quer reimprimir em vez de imprimir silenciosamente.
    if ((order as any)?.printed_at) {
      const ok = await confirmReprint({
        title: "Notinha já foi impressa",
        description: "Deseja imprimir novamente?",
        confirmText: "Imprimir de novo",
        cancelText: "Não imprimir",
      });
      if (!ok) return;
    }
    // Print da notinha
    try {
      const copies = (store?.settings as any)?.print_copies === 1 ? 1 : 2;
      const paperWidth = (store?.settings as any)?.print_paper_width === 58 ? 58 : 80;
      doPrintOrder(order, copies, paperWidth);
    } catch (e) {
      console.warn("print error", e);
    }
  }, [store?.name, store?.settings, doPrintOrder, confirmReprint]);

  // Deriva do banco (fonte única). Default ON.
  const autoPrint = (store?.settings as any)?.auto_print_delivery !== false;

  const toggleAutoPrint = async () => {
    if (!store?.id || autoPrintSaving) return;
    const next = !autoPrint;
    setAutoPrintSaving(true);
    // Optimistic update no cache do react-query.
    queryClient.setQueryData(["my-store", user?.id, activeSimulateStoreId], (old: any) => {
      if (!old) return old;
      return { ...old, settings: { ...(old.settings || {}), auto_print_delivery: next } };
    });
    const merged = { ...((store.settings as any) || {}), auto_print_delivery: next };
    const { error } = await supabase.from("stores").update({ settings: merged }).eq("id", store.id);
    setAutoPrintSaving(false);
    if (error) {
      // Reverte cache.
      queryClient.invalidateQueries({ queryKey: ["my-store", user?.id, activeSimulateStoreId] });
      toast.error("Não foi possível salvar. Tente novamente.");
      return;
    }
    // Limpa flag local antiga pra não confundir dispositivos que ainda tenham o override.
    try { localStorage.removeItem("autoPrint"); } catch {}
    toast.success(next ? "Impressão automática ativada em todos dispositivos" : "Impressão automática desativada");
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const order = orders?.find((o: any) => o.id === orderId);
    
    // Auto-print is now handled directly in the ACEITAR PEDIDO button click
    // to ensure: 1) print happens first, 2) WhatsApp opens after with PIN.

    try {
      // Direct update and refetch to ensure source of truth and instant tab switch without ghosting
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) {
        toast.error(`Erro ao atualizar pedido: ${error.message}`);
        return;
      }

      // Invalidate and switch tab before toast
      await queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      
      // Remove redundância, já estamos trocando a aba no onClick para resposta imediata
      
      toast.success("Pedido atualizado!");

      // Integrar com o Caixa (PDV) se o pedido for finalizado e pago em dinheiro
      if ((newStatus === "entregue" || newStatus === "finalizado") && order?.payment_method === "dinheiro" && store?.id) {
        try {
          const { data: activeRegister } = await supabase
            .from("cash_registers")
            .select("id")
            .eq("store_id", store.id)
            .eq("status", "open")
            .maybeSingle();

          if (activeRegister) {
            await supabase.from("cash_transactions").insert({
              cash_register_id: activeRegister.id,
              amount: Number(order.total_price),
              type: 'in',
              category: 'sale',
              description: `Venda Pedido #${order.id.slice(0, 8)}`,
              order_id: order.id,
              created_by: user?.id
            });
            queryClient.invalidateQueries({ queryKey: ["cash-transactions", activeRegister.id] });
            queryClient.invalidateQueries({ queryKey: ["active-cash-register", store.id] });
          }
        } catch (error) {
          console.error("Erro ao registrar no caixa:", error);
        }
      }

      // Notifications
      if (order) {
        const clientPhone = getClientWhatsApp(order.client_id);
        const clientName = getClientName(order.client_id);
        const items = buildRichItemsBlock(order.order_items || []);
        const storeSettings = (store?.settings || {}) as Record<string, any>;
        const deliveryFee = Number(order.delivery_fee || 0);
        const deliveryType: "delivery" | "retirada" = deliveryFee > 0 || order.address_details ? "delivery" : "retirada";
        const etaText = deliveryType === "delivery" ? buildEtaWindow() : "";
        const paymentLabel = paymentLabels?.[order.payment_method] || String(order.payment_method || "").toUpperCase();
        // Fire-and-forget — never await notification dispatch
        try {
          notifyOrderStatusChange(newStatus, {
            orderId: order.id,
            storeName: store?.name || "Loja",
            storeId: store?.id || "",
            clientId: order.client_id,
            clientPhone,
            clientName,
            totalPrice: Number(order.total_price),
            addressDetails: order.address_details,
            items,
            deliveryPin: order.delivery_pin,
            paymentMethod: order.payment_method,
            paymentLabel,
            deliveryFee,
            deliveryType,
            etaText,
            neighborhood: order.neighborhood,
          }, {
            evolutionEnabled: evolutionConnected,
            zapiEnabled: !!storeSettings.zapi_enabled,
          });
        } catch (e) { console.warn("notify error", e); }
      }

      // Notify drivers in background
      if (newStatus === "pronto_para_entrega") {
        if (!isOwnDelivery && onlineDrivers && onlineDrivers.length > 0) {
          const driverUserIds = onlineDrivers.map((d: any) => d.user_id);
          pushNotifyDeliveryAvailable(driverUserIds, orderId).catch(console.error);
        } else if (isOwnDelivery && linkedStoreDrivers && linkedStoreDrivers.length > 0) {
          const storeDriverUserIds = linkedStoreDrivers.map((d: any) => d.user_id);
          pushNotifyDeliveryAvailable(storeDriverUserIds, orderId).catch(console.error);
        }
      }
    } catch (e: any) {
      toast.error(`Erro inesperado: ${e?.message}`);
    }
  };

  const { data: storeHours } = useQuery({
    queryKey: ["store-hours-check", store?.id],
      staleTime: 5 * 60_000,    // 5min — horários raramente mudam
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase.from("opening_hours").select("*").eq("store_id", store!.id);
      return data || [];
    },
    enabled: !!store,
  });

  const { data: menuProductCount = 0 } = useQuery({
    queryKey: ["menu-product-count", store?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store!.id)
        .eq("is_available", true);
      return count || 0;
    },
    enabled: !!store,
    staleTime: 2 * 60_000, // 2min — contagem de produtos
  });

  const { allHoursClosed, isCurrentlyOpenByHours } = useMemo(() => {
    if (!storeHours || storeHours.length === 0) {
      return { allHoursClosed: true, isCurrentlyOpenByHours: false };
    }
    
    const hours = storeHours.map((h: any) => ({
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed_all_day: h.is_closed_all_day
    }));

    const status = getStoreOpenStatus(hours, false, true);
    
    return {
      allHoursClosed: storeHours.every((h: any) => h.is_closed_all_day),
      isCurrentlyOpenByHours: status.isOpen
    };
  }, [storeHours]);

  const isStoreReallyOpen = store?.is_open && isCurrentlyOpenByHours;

  const handleCancelOrder = async (order: any) => {
    if (!cancelReason) { toast.error("Selecione o motivo do cancelamento."); return; }
    setCancellingOrder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("cancel-order-refund", {
        body: { order_id: order.id, cancel_reason: cancelReason },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      // supabase-js retorna mensagem genérica em res.error; o motivo real
      // vem no corpo (res.data.error). Preferir o corpo quando existir.
      if (res.data?.error) throw new Error(res.data.error);
      if (res.error) throw new Error(res.error.message || "Falha ao cancelar pedido");

      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      setCancelConfirm(null);
      setCancelReason("");

      const clientPhone = getClientWhatsApp(order.client_id);
      const cancelSettings = (store?.settings || {}) as Record<string, any>;
      notifyOrderStatusChange("cancelado", {
        orderId: order.id,
        storeName: store?.name || "Loja",
        storeId: store?.id || "",
        clientId: order.client_id,
        clientPhone,
        clientName: getClientName(order.client_id),
        totalPrice: Number(order.total_price),
        paymentMethod: order.payment_method,
      }, {
        evolutionEnabled: evolutionConnected,
        zapiEnabled: !!cancelSettings.zapi_enabled,
      });

      toast.success(res.data?.message || "Pedido cancelado.", { duration: 8000 });
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e?.message}`);
    } finally {
      setCancellingOrder(false);
    }
  };

  // ── BATCH DISPATCH (own delivery) ──
  const toggleBatchOrder = (orderId: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const selectAllReady = () => {
    const readyIds = (orders || []).filter(o => o.status === "pronto_para_entrega").map(o => o.id);
    setBatchSelected(new Set(readyIds));
  };

  const batchDispatch = async () => {
    if (batchSelected.size === 0) return;
    setBatchDispatching(true);
    try {
      const ids = Array.from(batchSelected);
      const { error } = await supabase
        .from("orders")
        .update({ status: "saiu_entrega" as any })
        .in("id", ids);
      if (error) { toast.error("Erro ao despachar pedidos em lote"); return; }

      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      toast.success(`🛵 ${ids.length} pedido(s) enviados para entrega!`);

      // Send notifications for each order
      const storeSettings = (store?.settings || {}) as Record<string, any>;
      // Fire-and-forget em paralelo — antes rodava sequencial e travava UI com muitos pedidos
      ids.forEach((orderId) => {
        const order = orders?.find((o: any) => o.id === orderId);
        if (!order) return;
        const clientPhone = getClientWhatsApp(order.client_id);
        const clientName = getClientName(order.client_id);
        const items = order.order_items?.map((i: any) => `${i.quantity}x ${getOrderItemDisplayName(i)}`).join("\n") || "";
        try {
          notifyOrderStatusChange("saiu_entrega", {
            orderId: order.id,
            storeName: store?.name || "Loja",
            storeId: store?.id || "",
            clientId: order.client_id,
            clientPhone,
            clientName,
            totalPrice: Number(order.total_price),
            addressDetails: order.address_details,
            items,
            deliveryPin: order.delivery_pin,
            paymentMethod: order.payment_method,
          }, {
            evolutionEnabled: evolutionConnected,
            zapiEnabled: !!storeSettings.zapi_enabled,
          });
        } catch (e) { console.warn("batch notify error", e); }
      });

    } catch (e: any) {
      toast.error(`Erro: ${e?.message}`);
    } finally {
      setBatchDispatching(false);
      setBatchSelected(new Set());
    }
  };

  const toggleStoreOpen = async () => {
    if (!store) return;
    // Bloqueio: não permitir abrir a loja sem motoboy ativo
    if (!store.is_open && (onlineDrivers?.length || 0) === 0) {
      toast.error("Sem motoboy ativo. Ative um entregador antes de abrir a loja.");
      return;
    }
    // Bloqueio: não permitir abrir a loja fora do horário de funcionamento
    if (!store.is_open && !isCurrentlyOpenByHours) {
      toast.error("Fora do horário de funcionamento. Ajuste os horários para abrir a loja.");
      return;
    }
    const { error } = await supabase.from("stores").update({ is_open: !store.is_open }).eq("id", store.id);
    if (error) toast.error("Erro ao atualizar status.");
    else { toast.success(store.is_open ? "Loja pausada" : "Loja reaberta!"); queryClient.invalidateQueries({ queryKey: ["my-store", user?.id] }); }
  };

  // ── COMPUTED VALUES ──
  // Memoizados — antes rodavam 3 filter() a cada render
  const pendingCount = useMemo(
    () => orders?.filter(o => o.status === "pendente").length || 0,
    [orders]
  );
  const preparingCount = useMemo(
    () => orders?.filter(o => o.status === "preparando").length || 0,
    [orders]
  );
  const readyCount = useMemo(
    () => orders?.filter(o => o.status === "pronto_para_entrega").length || 0,
    [orders]
  );
  const delayedOrders = useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    return orders.filter(o => {
      const elapsedMin = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      return elapsedMin > 20 && ["pendente", "preparando"].includes(o.status);
    });
  }, [orders]);
  // Memoizado — recalculava todos os Date() a cada render
  const { todayOrders, todayTotal, todayCount } = useMemo(() => {
    const today = new Date().toDateString();
    const t = (orders?.filter(o => new Date(o.created_at).toDateString() === today && !["cancelado", "aguardando_pagamento"].includes(o.status))) || [];
    return {
      todayOrders: t,
      todayTotal: sumMoney(t.map((order: any) => order.total_price)),
      todayCount: t.length,
    };
  }, [orders]);

  const avgDeliveryTime = useMemo(() => {
    const delivered = (allOrders || []).filter((o: any) => {
      const isToday = new Date(o.created_at).toDateString() === new Date().toDateString();
      return isToday && ["entregue", "finalizado"].includes(o.status) && o.confirmed_at;
    });
    if (delivered.length === 0) return null;
    const totalMinutes = delivered.reduce((sum: number, o: any) => {
      const diff = (new Date(o.confirmed_at).getTime() - new Date(o.created_at).getTime()) / 60000;
      return sum + diff;
    }, 0);
    return Math.round(totalMinutes / delivered.length);
  }, [allOrders]);

  // Memoizado: evita rodar 2 filter() a cada render quando nada mudou
  const filteredOrders = useMemo(() => {
    return (orders?.filter(o => {
      if (activeTab === "delivery") return o.status === "saiu_entrega" || o.status === "em_transito";
      return o.status === activeTab;
    }) || []).filter(o => {
      if (!settlementSearch.trim()) return true;
      const search = settlementSearch.toLowerCase().trim();
      const phone = (getClientWhatsApp(o.client_id) || "").replace(/\D/g, "");
      const searchDigits = search.replace(/\D/g, "");
      return (
        o.id.slice(0, 8).toLowerCase().includes(search) ||
        (o.driver_id ? getDriverName(o.driver_id).toLowerCase().includes(search) : false) ||
        getClientName(o.client_id).toLowerCase().includes(search) ||
        (searchDigits.length >= 3 && phone.includes(searchDigits))
      );
    });
  }, [orders, activeTab, settlementSearch, getDriverName, getClientName, getClientWhatsApp]);

  // Contadores memoizados — antes eram recalculados 4x por render via IIFE inline
  const orderCounters = useMemo(() => {
    const list = orders || [];
    let pendente = 0, preparando = 0, pronto = 0, delivery = 0;
    for (const o of list) {
      if (o.status === "pendente") pendente++;
      else if (o.status === "preparando") preparando++;
      else if (o.status === "pronto_para_entrega") pronto++;
      else if (o.status === "saiu_entrega" || o.status === "em_transito") delivery++;
    }
    return { pendente, preparando, pronto, delivery, total: pendente + preparando + pronto + delivery };
  }, [orders]);

  const isOwnDelivery = (store as any)?.delivery_mode === "own";

  const hasLinkedDrivers = (linkedStoreDrivers?.length || 0) > 0;

  const avisosCount = useAvisosCount({
    store,
    storePlan,
    allHoursClosed,
    isOwnDelivery,
    hasLinkedDrivers,
    driversLoading,
  });

  const repassePending = useRepassePending(store?.id);

  const getMainAction = (status: OrderStatus, order?: any): { label: string; next: OrderStatus; emoji: string } | null => {
    const isPickupOrder = order?.neighborhood === "RETIRADA";
    switch (status) {
      case "pendente": return { label: "ACEITAR PEDIDO", next: "preparando", emoji: "✓" };
      case "preparando": 
        if (isPickupOrder) {
          return { label: "PRONTO P/ RETIRADA", next: "pronto_para_entrega" as OrderStatus, emoji: "🏪" };
        }
        return { label: "MARCAR COMO PRONTO", next: "pronto_para_entrega" as OrderStatus, emoji: "🔔" };
      case "pronto_para_entrega":
        if (isPickupOrder) {
          return { label: "CLIENTE RETIROU", next: "finalizado" as OrderStatus, emoji: "✅" };
        }
        if (isOwnDelivery) {
          if (hasLinkedDrivers || driversLoading || order?.driver_id) return null;
          return { label: "SAIU PARA ENTREGA", next: "saiu_entrega" as OrderStatus, emoji: "🛵" };
        }
        return null;
      case "saiu_entrega":
        if (isOwnDelivery && !hasLinkedDrivers && !driversLoading) return { label: "MARCAR COMO ENTREGUE", next: "finalizado" as OrderStatus, emoji: "✅" };
        return null;
      default: return null;
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    if (tab === "suporte") {
      setShowSupportModal(true);
      setShowMoreSheet(false);
      return;
    }
    startTabTransition(() => setDashboardTab(tab)); setSidebarOpen(false); setShowMoreSheet(false);
  };

  // ─── Navegação agrupada ───
  // "isPizza" controla a aba Pizzaria/Pastel — true para qualquer das duas categorias.
  const storeCats = [store?.category, ...((store as any)?.categories || [])].filter(Boolean) as string[];
  const isPizza = storeCats.includes("pizzas") || storeCats.includes("pasteis");
  const allowFullReports = storePlan.allowFullReports;
  const isPdvOnly = storePlan.planType === "pdv_only";

  // PDV-only: painel do lojista NÃO existe. Manda direto pro caixa/PDV.
  useEffect(() => {
    if (!storePlan.isLoading && isPdvOnly) {
      if (isPlatformAdmin && store?.id) {
        try {
          localStorage.setItem("pdv_admin_selected_store", store.id);
          localStorage.setItem("pdv_store_v1", JSON.stringify({
            id: store.id,
            name: store.name,
            category: store.category,
            categories: (store as any).categories,
            settings: (store as any).settings,
            store_type: (store as any).store_type,
          }));
        } catch {}
        navigate(`/admin/pdv?storeId=${store.id}`, { replace: true });
        return;
      }
      navigate("/admin/pdv", { replace: true });
    }
  }, [isPdvOnly, isPlatformAdmin, store?.id, storePlan.isLoading, navigate]);

  // Cacheia role + plan_type do usuário para que reloads futuros pulem
  // qualquer flash (landing → painel delivery) e vão direto pra tela certa.
  useEffect(() => {
    if (!user?.id || storePlan.isLoading) return;
    try {
      localStorage.setItem(`itasuper:userRole:${user.id}`, "lojista");
      localStorage.setItem(`itasuper:userPlan:${user.id}`, storePlan.planType);
    } catch {}
  }, [user?.id, storePlan.isLoading, storePlan.planType]);

  // Grupos visíveis (com pelo menos 1 sub-tab disponível)
  const visibleGroups: DashboardGroup[] = useMemo(
    () => {
      const ctx = { isPizza, allowFullReports, isPdvOnly };
      return dashboardGroups
        .map(g => ({
          ...g,
          label: isPdvOnly && g.pdvLabel ? g.pdvLabel : g.label,
          subTabs: g.subTabs
            .filter(s => filterSubTab(s, ctx))
            .map(s => ({ ...s, label: isPdvOnly && s.pdvLabel ? s.pdvLabel : s.label })),
        }))
        .filter(g => g.subTabs.length > 0);
    },
    [isPizza, allowFullReports, isPdvOnly],
  );
  const visibleGroupMap = useMemo(
    () => new Map(visibleGroups.map(g => [g.key, g])),
    [visibleGroups],
  );

  // Se a aba atual ficou oculta (ex.: loja migrada pra pdv_only), redireciona pra
  // primeira aba visível — evita tela em branco sem menu ativo.
  useEffect(() => {
    if (!visibleGroups.length) return;
    const allVisibleKeys = visibleGroups.flatMap(g => g.subTabs.map(s => s.key));
    if (!allVisibleKeys.includes(dashboardTab)) {
      const fallback = isPdvOnly ? "cash_register" : "dashboard";
      setDashboardTab(allVisibleKeys.includes(fallback as any) ? (fallback as any) : allVisibleKeys[0]);
    }
  }, [visibleGroups, dashboardTab, isPdvOnly]);

  const [preferredGroupKey, setPreferredGroupKey] = useState<DashboardGroupKey | null>(null);
  const activeGroup = useMemo(() => {
    if (preferredGroupKey) {
      const g = dashboardGroups.find(
        gr => gr.key === preferredGroupKey && gr.subTabs.some(s => s.key === dashboardTab),
      );
      if (g) return g;
    }
    return getGroupForTab(dashboardTab);
  }, [preferredGroupKey, dashboardTab]);
  const activeGroupKey = activeGroup?.key;

  const handleGroupChange = (groupKey: DashboardGroupKey) => {
    const g = visibleGroupMap.get(groupKey);
    if (!g || g.subTabs.length === 0) return;
    setPreferredGroupKey(groupKey);
    // Se já estou no grupo, mantém a sub-tab atual; senão abre a primeira
    const inGroup = g.subTabs.some(s => s.key === dashboardTab);
    handleTabChange(inGroup ? dashboardTab : g.subTabs[0].key);
  };

  const bottomNavGroups = bottomNavGroupKeys
    .map(k => visibleGroupMap.get(k))
    .filter(Boolean) as DashboardGroup[];
  const moreSheetGroups = moreSheetGroupKeys
    .map(k => visibleGroupMap.get(k))
    .filter(Boolean) as DashboardGroup[];

  const isBottomNavMore = activeGroupKey
    ? !bottomNavGroupKeys.includes(activeGroupKey)
    : false;

  // ── RENDER ──
  // PDV-only: enquanto o plano carrega OU quando é pdv_only, não renderizar
  // o dashboard de delivery — evita flash da UI errada antes do redirect.
  if (storePlan.isLoading || isPdvOnly) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">Carregando…</span>
        </div>
      </div>
    );
  }

  return (
    <TrialExpiredGuard storePlan={storePlan} storeId={store?.id || ""}>
    <div className="min-h-screen bg-background flex native-app">
      <SimulationBanner />

      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* More sheet overlay */}
      {/* ── MODAL DE SUPORTE ── */}
      {store && (
        <SupportTicketModal
          open={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          userRole="lojista"
          storeId={store.id}
          storeName={store.name}
        />
      )}

      {showMoreSheet && <div className="fixed inset-0 bg-black/60 z-[60] lg:hidden" onClick={() => setShowMoreSheet(false)} />}

      {/* ── MORE BOTTOM SHEET (mobile) ── */}
      {showMoreSheet && (
        <div className="fixed inset-x-0 bottom-0 z-[70] lg:hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-card border-t border-border rounded-t-2xl pb-safe">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              {moreSheetGroups.map(group => {
                const Icon = group.icon;
                const isActive = activeGroupKey === group.key;
                return (
                  <button key={group.key} onClick={() => handleGroupChange(group.key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-bold">{group.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR (desktop only) ── */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm text-foreground truncate">{store?.name || "Painel"}</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-destructive"}`} />
                  <span className="text-[10px] text-muted-foreground">{isOnline ? "Conectado" : "Desconectado"}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick stats in sidebar */}
        <div className="p-2 space-y-1.5 border-b border-border" data-tour="loja-stats">
          <div className="grid grid-cols-2 gap-1.5">
            <div className={`rounded-xl p-2 text-center border ${pendingCount > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/50 border-border"}`}>
              <p className={`text-lg font-black ${pendingCount > 0 ? "text-amber-500" : "text-foreground"}`}>{pendingCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Novos</p>
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-2 text-center">
              <p className="text-lg font-black text-foreground">{preparingCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Preparando</p>
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Hoje</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{formatBRL(todayTotal)}</p>
              <p className="text-[10px] text-muted-foreground">{todayCount} pedidos</p>
            </div>
          </div>
        </div>

        {/* Navigation — agrupada por grupos com sub-tabs */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visibleGroups.map(group => {
            const isActive = activeGroupKey === group.key;
            const Icon = group.icon;
            const tourKey = group.key === "pedidos" ? "loja-orders"
              : group.key === "cardapio" ? "loja-menu"
              : group.key === "clientes" ? "loja-clients"
              : undefined;
            return (
              <button key={group.key} onClick={() => handleGroupChange(group.key)}
                data-tour={tourKey}
                className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{group.label}</span>
                {group.key === "pedidos" && pendingCount > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">{pendingCount}</span>
                )}
                {group.key === "clientes" && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{clientAnalytics.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-2 border-t border-border space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <Bike className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">Entregadores</span>
            <span className={`flex items-center gap-1 text-xs font-bold ${(onlineDrivers?.length || 0) > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
              <span className={`w-2 h-2 rounded-full ${(onlineDrivers?.length || 0) > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted"}`} />
              {onlineDrivers?.length || 0}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {soundEnabled && (
              <button onClick={() => setSoundMuted(prev => { if (!prev) toast("🔇 Silenciado"); else toast.success("🔊 Ativo!"); return !prev; })}
                className={`p-2 rounded-xl border border-border ${soundMuted ? "text-destructive" : "text-emerald-500"}`}>
                {soundMuted ? <VolumeX className="h-4 w-4 mx-auto" /> : <Volume2 className="h-4 w-4 mx-auto" />}
              </button>
            )}
            <button onClick={toggleAutoPrint} disabled={autoPrintSaving}
              title={autoPrint ? "Impressão automática ligada (clique para desligar)" : "Impressão automática desligada"}
              className={`p-2 rounded-xl border border-border transition-opacity ${autoPrintSaving ? "opacity-50" : ""} ${autoPrint ? "text-primary bg-primary/5" : "text-muted-foreground"}`}>
              <Printer className="h-4 w-4 mx-auto" />
            </button>
            <div className="col-span-2 space-y-1">
              <button onClick={toggleStoreOpen}
                className={`w-full py-2 rounded-xl text-xs font-bold border transition-colors ${store?.is_open ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}
                data-tour="loja-status">
                {store?.is_open ? "✓ Online" : "✕ Offline"}
              </button>
              <div className={`text-[10px] font-black text-center uppercase tracking-tighter py-1 rounded-lg ${isStoreReallyOpen ? "text-emerald-500 bg-emerald-500/5" : "text-red-500 bg-red-500/5"}`}>
                {isStoreReallyOpen ? "Loja Aberta" : "Loja Fechada"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Desktop: hamburger for sidebar */}
            <button onClick={() => setSidebarOpen(true)} className="hidden lg:hidden p-2 -ml-2 rounded-xl hover:bg-accent">
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground text-base truncate">{store?.name || "Painel"}</h2>
              <div className="flex items-center gap-2 mt-0.5 lg:hidden">
                <button onClick={toggleStoreOpen}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                    store?.is_open
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-500"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${store?.is_open ? "bg-emerald-500" : "bg-red-500"}`} />
                  {store?.is_open ? "Online" : "Offline"}
                </button>
                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isStoreReallyOpen ? "text-emerald-500 bg-emerald-500/5" : "text-red-500 bg-red-500/5"}`}>
                  {isStoreReallyOpen ? "Aberta" : "Fechada"}
                </div>
              </div>
              {/* Desktop subtitle */}
              <p className="text-xs text-muted-foreground hidden lg:block">
                {dashboardTab === "dashboard" && "Resumo do dia em tempo real"}
                {dashboardTab === "avisos" && (avisosCount > 0 ? `${avisosCount} pendência${avisosCount > 1 ? "s" : ""} para resolver` : "Sem pendências")}
                {dashboardTab === "orders" && `${orders?.length || 0} pedidos ativos`}
                {dashboardTab === "clients" && `${clientAnalytics.length} clientes registrados`}
                {dashboardTab === "menu" && "Gerencie seu cardápio"}
                {dashboardTab === "addons" && "Grupos de adicionais do cardápio"}
                {dashboardTab === "bordas" && "Opções de borda para pizzas"}
                {dashboardTab === "hours" && "Horários de funcionamento"}
                {dashboardTab === "finance" && "Resumo financeiro"}
                {dashboardTab === "repasse" && (repassePending > 0 ? `Repasse pendente à plataforma` : "Nenhum repasse pendente")}
                {dashboardTab === "settings" && "Configurações da loja"}
                {dashboardTab === "subscription" && "Seu plano e mensalidade"}
                {dashboardTab === "loyalty" && "Programa de pontos para clientes"}
                {dashboardTab === "drivers" && "Seus entregadores vinculados"}
                {dashboardTab === "reports" && "Relatórios e estatísticas"}
                {dashboardTab === "cash_register" && "Caixa presencial — PDV"}
                {dashboardTab === "refunds" && "Reembolsos e disputas"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {showSoundPrompt && !soundEnabled && !Capacitor.isNativePlatform() && (
              <button onClick={activateSound}
                className="flex items-center gap-1 bg-amber-400/10 border border-amber-400/30 text-amber-500 px-2.5 py-1.5 rounded-xl text-[11px] font-bold animate-pulse">
                <Bell className="h-3.5 w-3.5" /> Alertas
              </button>
            )}
            {pendingCount > 0 && dashboardTab !== "orders" && !isPdvOnly && (
              <button onClick={() => { setDashboardTab("orders"); setActiveTab("pendente"); }}
                className="flex items-center gap-1 bg-amber-400 text-amber-900 px-2.5 py-1.5 rounded-xl text-[11px] font-bold animate-bounce">
                <Clock className="h-3.5 w-3.5" /> {pendingCount}
              </button>
            )}
            {soundEnabled && (
              <button onClick={() => setSoundMuted(prev => { if (!prev) toast("🔇 Silenciado"); else toast.success("🔊 Ativo!"); return !prev; })}
                className={`p-2 rounded-xl lg:hidden ${soundMuted ? "text-destructive" : "text-emerald-500"}`}>
                {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
            <SignOutConfirm redirectTo="/portal-parceiro" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {/* Sub-tabs do grupo ativo (mesmo padrão visual da aba Pizzaria) */}
          {store && activeGroup && (
            <GroupTabsBar
              group={activeGroup}
              activeTab={dashboardTab}
              onSelect={handleTabChange}
              isPizza={isPizza}
              allowFullReports={allowFullReports}
              badges={{ avisos: avisosCount }}
              pulseTabs={{ repasse: repassePending > 0 }}
            />
          )}
          {!storeLoading && isApproved && !store && (
            <div className="p-4 lg:p-6 max-w-lg mx-auto flex flex-col items-center justify-center text-center min-h-[60vh]">
              <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-5">
                <Store className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">
                {activeSimulateStoreId ? "Loja de simulação não encontrada" : "Nenhuma loja vinculada a esta conta"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {activeSimulateStoreId
                  ? "A loja simulada não pôde ser carregada agora."
                  : "Seu acesso foi liberado, mas a loja desta conta não carregou no painel."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-primary text-primary-foreground font-bold px-5 py-3 rounded-xl text-sm"
                >
                  Tentar novamente
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="bg-muted text-foreground font-bold px-5 py-3 rounded-xl text-sm"
                >
                  Ir para início
                </button>
              </div>
            </div>
          )}

          {/* ══════ DASHBOARD TAB ══════ */}
          {dashboardTab === "dashboard" && !isApproved && !profileLoading && (
            <div className="p-4 lg:p-6 max-w-lg mx-auto flex flex-col items-center justify-center text-center min-h-[60vh]">
              <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-5">
                <Shield className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">Cadastro em Análise 🔍</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-3">
                Recebemos seus dados com sucesso! Em até <span className="font-bold text-foreground">24 horas</span> o administrador do ItaSuper liberará seu acesso.
              </p>
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 max-w-xs mb-4">
                <p className="text-xs text-muted-foreground">
                  📲 Entraremos em contato via <span className="font-bold text-foreground">WhatsApp</span> assim que seu cadastro for aprovado.
                </p>
              </div>
              <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-sm">
                Verificar Status
              </button>
            </div>
          )}
          {dashboardTab === "dashboard" && isApproved && store && (
            <>
              {/* ── BANNER SETUP INCOMPLETO ── */}
              {(() => {
                const missingMenu   = menuProductCount === 0;
                const missingHours  = !storeHours || storeHours.length === 0 || (storeHours as any[]).every((h: any) => h.is_closed_all_day === true);
                const missingLogo   = !store.image_url;
                const missingDriver = isOwnDelivery && !hasLinkedDrivers && !driversLoading;
                const items = [
                  missingDriver && { key: "driver", label: "Vincular entregador",         desc: "Sem motoboy cadastrado clientes não conseguem pedir", tab: "drivers", urgente: true },
                  missingMenu   && { key: "menu",   label: "Adicionar produtos",          desc: "Seu cardápio está vazio — clientes não conseguem pedir", tab: "menu", urgente: true },
                  missingHours  && { key: "hours",  label: "Configurar horários",         desc: "Sem horários a loja aparece sempre fechada", tab: "hours", urgente: false },
                  missingLogo   && { key: "logo",   label: "Adicionar logo da loja",      desc: "Uma boa foto aumenta a conversão de clientes", tab: "settings", urgente: false },
                ].filter(Boolean) as { key: string; label: string; desc: string; tab: string; urgente: boolean }[];
                if (items.length === 0) return null;
                const temUrgente = items.some(i => i.urgente);
                return (
                  <div className="px-4 pt-4 pb-0">
                    <div className={`rounded-2xl border p-4 ${temUrgente ? "bg-amber-50 dark:bg-amber-500/8 border-amber-200 dark:border-amber-500/20" : "bg-blue-50 dark:bg-blue-500/8 border-blue-200 dark:border-blue-500/20"}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${temUrgente ? "bg-amber-500/15" : "bg-blue-500/15"}`}>
                          {temUrgente ? "⚠️" : "💡"}
                        </div>
                        <div>
                          <p className={`text-xs font-black ${temUrgente ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`}>
                            {temUrgente ? "Configure para começar a receber pedidos" : "Complete a configuração da sua loja"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{items.length} pendência{items.length > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {items.map(item => (
                          <button key={item.key} onClick={() => setDashboardTab(item.tab as any)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98] ${
                              item.urgente ? "bg-amber-100/70 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15" : "bg-blue-100/70 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15"
                            }`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black text-white ${item.urgente ? "bg-amber-500" : "bg-blue-500"}`}>
                              {item.urgente ? "!" : "→"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold ${item.urgente ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"}`}>{item.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <Suspense fallback={<TabFallback />}>
                <DashboardOverviewSection
                store={store}
                storePlan={storePlan}
                isApproved={isApproved}
                isStoreReallyOpen={isStoreReallyOpen}
                allHoursClosed={allHoursClosed}
                isOwnDelivery={isOwnDelivery}
                driversLoading={driversLoading}
                hasLinkedDrivers={hasLinkedDrivers}
                pendingCount={pendingCount}
                preparingCount={preparingCount}
                readyCount={readyCount}
                todayCount={todayCount}
                todayTotal={todayTotal}
                avgDeliveryTime={avgDeliveryTime}
                clientAnalytics={clientAnalytics}
                delayedOrders={delayedOrders}
                showDelayedPanel={showDelayedPanel}
                setShowDelayedPanel={setShowDelayedPanel}
                orders={orders}
                statusColors={statusColors}
                paymentIcons={paymentIcons}
                paymentLabels={paymentLabels}
                setDashboardTab={setDashboardTab}
                setActiveTab={setActiveTab}
                navigate={navigate}
                avisosCount={avisosCount}
                getClientName={getClientName}
                getClientWhatsApp={getClientWhatsApp}
                getOrderItemDisplayName={getOrderItemDisplayName}
                buildAcceptWhatsAppHref={buildAcceptWhatsAppHref}
                buildReadyMessage={buildReadyMessage}
                openWhatsApp={openWhatsApp}
                evolutionConnected={evolutionConnected}
                cancelConfirm={cancelConfirm}
                cancelReason={cancelReason}
                setCancelConfirm={setCancelConfirm}
                setCancelReason={setCancelReason}
                cancellingOrder={cancellingOrder}
                updateOrderStatus={updateOrderStatus}
                handleAcceptOrder={handleAcceptOrder}
                handleCancelOrder={handleCancelOrder}
              />
            </Suspense>
            </>
          )}

          {/* ══════ AVISOS TAB ══════ */}
          {dashboardTab === "avisos" && store && (
            <Suspense fallback={<TabFallback />}>
              <AvisosSection
                store={store}
                storePlan={storePlan}
                allHoursClosed={allHoursClosed}
                isOwnDelivery={isOwnDelivery}
                driversLoading={driversLoading}
                hasLinkedDrivers={hasLinkedDrivers}
                setDashboardTab={setDashboardTab}
                count={avisosCount}
              />
            </Suspense>
          )}

          {/* ══════ REPASSE TAB ══════ */}
          {dashboardTab === "repasse" && store && (
            <Suspense fallback={<TabFallback />}>
              <RepasseSection
                store={store}
                storePlan={storePlan}
                setDashboardTab={setDashboardTab}
                pendingTotal={repassePending}
              />
            </Suspense>
          )}

          {/* ══════ CLIENTS TAB ══════ */}
          {dashboardTab === "clients" && store && (
            <ClientsTab
              clientFilter={clientFilter}
              setClientFilter={setClientFilter}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              filteredClients={filteredClients}
              expandedClient={expandedClient}
              setExpandedClient={setExpandedClient}
              storeName={store?.name}
              clientCounts={clientCounts}
              clientSort={clientSort}
              setClientSort={setClientSort}
            />
          )}

          {/* ══════ ORDERS TAB ══════ */}
          {dashboardTab === "orders" && store && (
            <Suspense fallback={<TabFallback />}>
              <OrdersSection
                store={store}
                orders={orders}
                isLoading={isLoading}
                filteredOrders={filteredOrders}
                orderCounters={orderCounters}
                orderTabs={orderTabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                batchSelected={batchSelected}
                setBatchSelected={setBatchSelected}
                expandedAddresses={expandedAddresses}
                cancelConfirm={cancelConfirm}
                setCancelConfirm={setCancelConfirm}
                cancelReason={cancelReason}
                setCancelReason={setCancelReason}
                cancellingOrder={cancellingOrder}
                isOwnDelivery={isOwnDelivery}
                hasLinkedDrivers={hasLinkedDrivers}
                driversLoading={driversLoading}
                onlineDrivers={onlineDrivers || []}
                linkedStoreDrivers={linkedStoreDrivers}
                pendingCount={pendingCount}
                settlementSearch={settlementSearch}
                setSettlementSearch={setSettlementSearch}
                batchDispatch={batchDispatch}
                batchDispatching={batchDispatching}
                selectAllReady={selectAllReady}
                toggleBatchOrder={toggleBatchOrder}
                toggleAddress={toggleAddress}
                storeName={store?.name}
                getClientName={getClientName}
                getClientWhatsApp={getClientWhatsApp}
                getDriverName={getDriverName}
                getRequiredAddonHighlights={getRequiredAddonHighlights}
                getMainAction={getMainAction}
                buildAcceptWhatsAppHref={buildAcceptWhatsAppHref}
                buildReadyWhatsAppHref={buildReadyWhatsAppHref}
                evolutionConnected={evolutionConnected}
                updateOrderStatus={updateOrderStatus}
                handleAcceptOrder={handleAcceptOrder}
                handleCancelOrder={handleCancelOrder}
                handlePrint={handlePrint}
                invalidateOrders={() => queryClient.invalidateQueries({ queryKey: ["admin-orders"] })}
              />
            </Suspense>
          )}

          {/* ══════ OTHER TABS ══════ */}
          {!["dashboard", "avisos", "repasse", "orders", "clients"].includes(dashboardTab) && store && (
            <div className="p-4 lg:p-6 max-w-6xl mx-auto">
              <Suspense fallback={<TabFallback />}>
                {dashboardTab === "menu" && <MenuTab storeId={store.id} storeCategory={store.category} />}
                {dashboardTab === "cash_register" && <CashRegisterTab storeId={store.id} />}
                {dashboardTab === "tutoriais" && <TutoriaisTab />}
                {dashboardTab === "addons" && <AddonsTab storeId={store.id} />}
                {dashboardTab === "bordas" && <BordasTab storeId={store.id} category={store.category} categories={(store as any).categories} />}
                {dashboardTab === "hours" && <HoursTab storeId={store.id} forceClosed={(store as any).force_closed || false} />}
                {dashboardTab === "settings" && <SettingsTab store={store} />}
                {dashboardTab === "finance" && (
                  <FinanceTab 
                    storeId={store.id} 
                    storeName={store.name} 
                    hasCommission={storePlan.hasCommission} 
                    isPlatformAdmin={isPlatformAdmin}
                  />
                )}
                {dashboardTab === "subscription" && (
                  <SubscriptionTab storeId={store.id} storeName={store.name} />
                )}
                {dashboardTab === "loyalty" && (
                  <LoyaltyTab storeId={store.id} allowLoyalty={storePlan.allowLoyalty} />
                )}
                {dashboardTab === "coupons" && <CouponsTab storeId={store.id} />}
                {dashboardTab === "promotions" && <PromotionsTab storeId={store.id} />}
                {dashboardTab === "drivers" && store && <DriversTab storeId={store.id} />}
                {dashboardTab === "refunds" && store && <RefundsTab storeId={store.id} />}
              </Suspense>
              {dashboardTab === "reports" && (
                <Suspense fallback={<TabFallback />}>
                  <StoreReportsPanel storeId={store.id} storeName={store.name} />
                </Suspense>
              )}
            </div>
          )}
        </div>

        {/* ── FIXED MODERN BOTTOM NAVIGATION (mobile only) ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 lg:hidden pb-safe">
          <div className="flex items-center justify-around h-16 px-2">
            {bottomNavGroups.map(group => {
              const Icon = group.icon;
              const isActive = activeGroupKey === group.key && !showMoreSheet;
              return (
                <button key={group.key} onClick={() => handleGroupChange(group.key)}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 relative ${
                    isActive ? "text-primary translate-y-[-2px]" : "text-muted-foreground/60 hover:text-muted-foreground"
                  }`}>
                  {isActive && <div className="absolute top-0 w-8 h-1 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />}
                  <div className="relative mt-1">
                    <Icon className={`h-6 w-6 transition-transform duration-300 ${isActive ? "scale-110" : "group-active:scale-90"}`} strokeWidth={isActive ? 2.5 : 2} />
                    {group.key === "pedidos" && pendingCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-background shadow-lg animate-pulse">{pendingCount}</span>
                    )}
                  </div>
                  <span className={`text-[11px] mt-1 transition-all duration-300 ${isActive ? "font-black tracking-tight" : "font-bold"}`}>{group.label}</span>
                </button>
              );
            })}
            {/* More button */}
            <button onClick={() => setShowMoreSheet(!showMoreSheet)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 relative ${
                (isBottomNavMore || showMoreSheet) ? "text-primary translate-y-[-2px]" : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}>
              {(isBottomNavMore || showMoreSheet) && <div className="absolute top-0 w-8 h-1 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />}
              <div className="relative mt-1">
                <div className={`transition-all duration-300 ${showMoreSheet ? "rotate-90 scale-110" : ""}`}>
                  {showMoreSheet ? <X className="h-6 w-6" strokeWidth={2.5} /> : <Menu className="h-6 w-6" strokeWidth={2} />}
                </div>
              </div>
              <span className={`text-[11px] mt-1 transition-all duration-300 ${(isBottomNavMore || showMoreSheet) ? "font-black tracking-tight" : "font-bold"}`}>Mais</span>
            </button>
          </div>
        </nav>
      </main>
      <ProductTour steps={lojistaTourSteps} tourKey="lojista" />
    </div>
    <ReprintConfirmDialog />
    </TrialExpiredGuard>
  );
};

export default AdminDashboard;
