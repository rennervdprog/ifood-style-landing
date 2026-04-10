import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import SimulationBanner from "@/components/SimulationBanner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Clock, ChefHat, Truck, CheckCircle2, Pizza,
  MapPin, Package, Settings, Banknote, CreditCard,
  UtensilsCrossed, ListOrdered, Plus, Printer, Bike,
  Volume2, VolumeX, Bell, Store, MessageCircle, Copy, Coins,
  ChevronDown, ChevronUp, DollarSign, XCircle, Loader2, Search,
  Menu, X, LayoutDashboard, CircleDot, TrendingUp, BarChart3,
  Users, Timer, Star, ShoppingBag, ArrowUpRight, ArrowDownRight,
  Filter, UserCheck, UserX, MapPinned, Repeat, Heart, AlertTriangle, LogOut, User, Shield,
  Calendar, Download
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { openWhatsApp } from "@/lib/whatsapp";
import WhatsAppButton from "@/components/WhatsAppButton";
import { notifyOrderStatusChange } from "@/lib/orderNotifications";
import MenuBuilder from "@/components/MenuBuilder";
import StoreHoursManager from "@/components/StoreHoursManager";
import AddonManager from "@/components/AddonManager";
import StoreSettings from "@/components/StoreSettings";
import StoreFinancePanel from "@/components/StoreFinancePanel";
import StoreFinanceBasic from "@/components/StoreFinanceBasic";
import StoreSubscription from "@/components/StoreSubscription";
import CommissionAlert from "@/components/CommissionAlert";
import PlatformSplitAlert from "@/components/PlatformSplitAlert";
import LoyaltyConfigPanel from "@/components/LoyaltyConfigPanel";
import PizzaBorderManager from "@/components/PizzaBorderManager";
import OrderChat from "@/components/OrderChat";
import { printThermalReceipt } from "@/lib/thermalPrint";
import { requestNotificationPermission, notifyNewOrder, pushNotifyDeliveryAvailable } from "@/lib/notifications";
import { sendPushNotification } from "@/lib/firebase";
import { addMoney, averageMoney, formatCurrency, sumMoney } from "@/lib/utils";
import ProductTour, { lojistaTourSteps } from "@/components/ProductTour";
import { useStorePlan } from "@/hooks/useStorePlan";
import TrialExpiredGuard from "@/components/TrialExpiredGuard";

type OrderStatus = "pendente" | "preparando" | "pronto_para_entrega" | "saiu_entrega" | "em_transito" | "entregue" | "finalizado";
type DashboardTab = "dashboard" | "orders" | "menu" | "addons" | "bordas" | "hours" | "settings" | "finance" | "clients" | "reports" | "subscription" | "loyalty";

const ALERT_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
const CASH_REGISTER_SOUND_URL = "https://actions.google.com/sounds/v1/office/cash_register.ogg";

// Semantic color system
const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pendente: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Novo Pedido" },
  preparando: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Em Preparo" },
  pronto_para_entrega: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Pronto" },
  saiu_entrega: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Saiu Entrega" },
  em_transito: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Em Trânsito" },
  entregue: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Entregue" },
  finalizado: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Finalizado" },
  cancelado: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Cancelado" },
};

const orderTabs: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pendente", label: "Novos", icon: Clock },
  { status: "preparando", label: "Preparando", icon: ChefHat },
  { status: "pronto_para_entrega", label: "Pronto", icon: Package },
  { status: "saiu_entrega", label: "Saiu", icon: Truck },
  { status: "em_transito", label: "Trânsito", icon: Truck },
  { status: "entregue", label: "Entregue", icon: CheckCircle2 },
  { status: "finalizado", label: "Finalizados", icon: CheckCircle2 },
];

const paymentLabels: Record<string, string> = { pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro" };
const paymentIcons: Record<string, string> = { pix: "⚡", cartao: "💳", dinheiro: "💵" };

const baseSidebarItems: { key: DashboardTab; label: string; icon: React.ElementType; pizzaOnly?: boolean }[] = [
  { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { key: "orders", label: "Pedidos", icon: ListOrdered },
  { key: "clients", label: "Clientes", icon: Users },
  { key: "menu", label: "Cardápio", icon: UtensilsCrossed },
  
  { key: "addons", label: "Adicionais", icon: Plus },
  { key: "bordas", label: "Bordas", icon: CircleDot, pizzaOnly: true },
  { key: "hours", label: "Horários", icon: Clock },
  { key: "finance", label: "Finanças", icon: Coins },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "subscription", label: "Assinatura", icon: CreditCard },
  { key: "loyalty", label: "Fidelidade", icon: Star },
  { key: "settings", label: "Configurações", icon: Settings },
];

// Bottom nav tabs (mobile)
const bottomNavTabs: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Início", icon: LayoutDashboard },
  { key: "orders", label: "Pedidos", icon: ListOrdered },
  { key: "menu", label: "Cardápio", icon: UtensilsCrossed },
  { key: "clients", label: "Clientes", icon: Users },
];

// "More" sheet items
const moreSheetItems: { key: DashboardTab; label: string; icon: React.ElementType; pizzaOnly?: boolean }[] = [
  { key: "addons", label: "Adicionais", icon: Plus },
  { key: "bordas", label: "Bordas", icon: CircleDot, pizzaOnly: true },
  { key: "hours", label: "Horários", icon: Clock },
  { key: "finance", label: "Finanças", icon: Coins },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "subscription", label: "Assinatura", icon: CreditCard },
  { key: "loyalty", label: "Fidelidade", icon: Star },
  { key: "settings", label: "Configurações", icon: Settings },
];

// ── At-a-Glance Card Component ──
const GlanceCard = ({ icon: Icon, label, value, subValue, color = "text-primary", trend, onClick }: {
  icon: React.ElementType; label: string; value: string | number; subValue?: string; color?: string; trend?: "up" | "down" | null; onClick?: () => void;
}) => (
  <div onClick={onClick} className={`bg-card border border-border rounded-2xl p-3 flex flex-col gap-1.5 hover:shadow-md transition-shadow ${onClick ? "cursor-pointer active:scale-[0.97]" : ""}`}>
    <div className="flex items-center justify-between">
      <div className={`w-8 h-8 rounded-lg ${color.replace("text-", "bg-").replace("500", "500/10")} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-xs font-bold ${trend === "up" ? "text-emerald-500" : "text-red-500"}`}>
          {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        </div>
      )}
    </div>
    <div>
      <p className="text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      {subValue && <p className="text-[10px] text-muted-foreground/70 hidden sm:block">{subValue}</p>}
    </div>
  </div>
);

// ── Client Filter type ──
type ClientFilter = "all" | "loyal" | "inactive" | "location";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const simulateStoreId = searchParams.get("storeId");
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [realtimeDriversConnected, setRealtimeDriversConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderStatus>("pendente");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("dashboard");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrint") === "true");
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  const [soundMuted, setSoundMuted] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [settlementSearch, setSettlementSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<ClientFilter>("all");
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [showDelayedPanel, setShowDelayedPanel] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [selectedReportPeriod, setSelectedReportPeriod] = useState(30);

  const prevPendingCountRef = useRef(0);

  const toggleAddress = (orderId: string) => {
    setExpandedAddresses(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  // ── DATA QUERIES ──
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
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
      const { data, error } = await supabase.from("stores").select("*").eq("owner_id", user!.id).maybeSingle();
      if (error) {
        console.error("[AdminDashboard] store query error:", error);
        throw error;
      }
      console.log("[AdminDashboard] store loaded:", data?.name, "is_open:", data?.is_open);
      return data;
    },
    enabled: !!user,
  });

  const storePlan = useStorePlan(store?.id);

  console.log("[AdminDashboard] store:", store?.name, "storeError:", storeError, "storeLoading:", storeLoading, "isApproved:", isApproved, "user:", user?.id);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-orders", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("store_id", store!.id)
        .neq("status", "aguardando_pagamento" as any)
        .neq("status", "cancelado" as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store,
  });

  const { data: allOrders } = useQuery({
    queryKey: ["store-all-orders", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name))")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store,
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
  });

  // Realtime drivers
  useEffect(() => {
    const ch = supabase.channel("drivers-online-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => queryClient.invalidateQueries({ queryKey: ["online-drivers-count"] }))
      .subscribe((status) => setRealtimeDriversConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const driverIds = [...new Set(orders?.map(o => o.driver_id).filter(Boolean) || [])] as string[];
  const { data: driverProfiles } = useQuery({
    queryKey: ["driver-profiles", driverIds],
    queryFn: async () => { const { data } = await supabase.from("drivers").select("user_id, name").in("user_id", driverIds); return data || []; },
    enabled: driverIds.length > 0,
  });

  const getDriverName = (driverId: string) => driverProfiles?.find((dr: any) => dr.user_id === driverId)?.name || "Entregador";

  const clientIds = [...new Set(orders?.map(o => o.client_id) || [])];
  const { data: clientProfiles } = useQuery({
    queryKey: ["client-profiles", clientIds],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, whatsapp_number, phone, full_name, neighborhood").in("user_id", clientIds);
      return data || [];
    },
    enabled: clientIds.length > 0,
  });

  const getClientWhatsApp = (clientId: string) => {
    const p = clientProfiles?.find((c: any) => c.user_id === clientId);
    return (p as any)?.whatsapp_number || (p as any)?.phone || "";
  };
  const getClientName = (clientId: string) => clientProfiles?.find((c: any) => c.user_id === clientId)?.full_name || "Cliente";

  // ── CLIENT ANALYTICS ──
  const clientAnalytics = useMemo(() => {
    if (!allOrders || !clientProfiles) return [];
    const map = new Map<string, { orders: any[]; totalSpent: number; lastOrder: string; neighborhood: string }>();

    allOrders.forEach((order: any) => {
      if (order.status === "aguardando_pagamento") return;
      const existing = map.get(order.client_id) || { orders: [], totalSpent: 0, lastOrder: "", neighborhood: "" };
      existing.orders.push(order);
      if (order.status !== "cancelado") existing.totalSpent = addMoney(existing.totalSpent, order.total_price);
      if (!existing.lastOrder || order.created_at > existing.lastOrder) existing.lastOrder = order.created_at;
      const profile = clientProfiles.find((p: any) => p.user_id === order.client_id);
      if (profile) existing.neighborhood = (profile as any).neighborhood || order.neighborhood || "";
      map.set(order.client_id, existing);
    });

    return Array.from(map.entries()).map(([clientId, data]) => {
      const completedOrders = data.orders.filter((o: any) => !["cancelado", "aguardando_pagamento"].includes(o.status));
      const ticketMedio = averageMoney(data.totalSpent, completedOrders.length);

      const productCount = new Map<string, number>();
      data.orders.forEach((o: any) => {
        o.order_items?.forEach((item: any) => {
          const name = getOrderItemDisplayName(item);
          productCount.set(name, (productCount.get(name) || 0) + item.quantity);
        });
      });
      let favProduct = "N/A";
      let maxCount = 0;
      productCount.forEach((count, name) => { if (count > maxCount) { maxCount = count; favProduct = name; } });

      const daysSinceLastOrder = Math.floor((Date.now() - new Date(data.lastOrder).getTime()) / (1000 * 60 * 60 * 24));

      return {
        clientId,
        name: getClientName(clientId),
        phone: getClientWhatsApp(clientId),
        neighborhood: data.neighborhood,
        totalOrders: completedOrders.length,
        totalSpent: data.totalSpent,
        ticketMedio,
        favProduct,
        lastOrder: data.lastOrder,
        daysSinceLastOrder,
        orders: data.orders,
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders);
  }, [allOrders, clientProfiles]);

  const filteredClients = useMemo(() => {
    let list = clientAnalytics;
    if (clientFilter === "loyal") list = list.filter(c => c.totalOrders >= 3);
    else if (clientFilter === "inactive") list = list.filter(c => c.daysSinceLastOrder >= 15);
    else if (clientFilter === "location") list = list.sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));

    if (clientSearch.trim()) {
      const s = clientSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s) || c.neighborhood.toLowerCase().includes(s) || c.phone.includes(s));
    }
    return list;
  }, [clientAnalytics, clientFilter, clientSearch]);

  // ── SOUND SYSTEM ──
  const playAlert = useCallback(() => {
    if (!soundEnabled || soundMuted) return;
    if (!audioRef.current) { audioRef.current = new Audio(ALERT_SOUND_URL); audioRef.current.volume = 1.0; }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
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
      loopIntervalRef.current = setInterval(() => playAlert(), 12000);
    } else {
      if (loopIntervalRef.current) { clearInterval(loopIntervalRef.current); loopIntervalRef.current = null; }
    }
    return () => { if (loopIntervalRef.current) { clearInterval(loopIntervalRef.current); loopIntervalRef.current = null; } };
  }, [orders, soundEnabled, soundMuted, playAlert]);

  // ── REALTIME ORDERS ──
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["store-orders", store.id] });
        queryClient.invalidateQueries({ queryKey: ["store-all-orders", store.id] });
        if (payload.eventType === "INSERT" && (payload.new as any).status === "pendente") {
          playAlert();
          notifyNewOrder();
          toast.info("🔔 Novo pedido!", { duration: 8000 });
        }
        if (payload.eventType === "UPDATE" && (payload.new as any).status === "pendente" && (payload.old as any)?.status === "aguardando_pagamento") {
          const cashSound = new Audio(CASH_REGISTER_SOUND_URL);
          cashSound.volume = 1.0;
          cashSound.play().catch(() => {});
          toast.success("💰 PIX confirmado!", { duration: 8000 });
          notifyNewOrder();
        }
        if (payload.eventType === "UPDATE" && (payload.new as any).status === "finalizado") {
          toast.success("✅ Pedido finalizado!", { duration: 5000 });
        }
      })
      .subscribe((status) => setIsOnline(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [store, queryClient, playAlert]);

  // ── ACTIONS ──
  const handlePrint = useCallback((order: any) => {
    printThermalReceipt(order, store?.name || "Loja", getClientName(order.client_id));
  }, [store?.name]);

  const toggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrint(next);
    localStorage.setItem("autoPrint", String(next));
    toast.success(next ? "Impressão automática ativada" : "Impressão automática desativada");
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error, data } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)
        .select();
      if (error) {
        toast.error(`Erro ao atualizar pedido: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        toast.error("Pedido não atualizado — verifique permissões");
        return;
      }
      toast.success("Pedido atualizado!");
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      const order = orders?.find((o: any) => o.id === orderId);
      if (newStatus === "preparando" && autoPrint && order) handlePrint(order);

      // Send dual notifications (Push + WhatsApp) for all status changes
      if (order) {
        const clientPhone = getClientWhatsApp(order.client_id);
        const clientName = getClientName(order.client_id);
        const items = order.order_items?.map((i: any) => `${i.quantity}x ${getOrderItemDisplayName(i)}`).join("\n") || "";
        
        const storeSettings = (store?.settings || {}) as Record<string, any>;
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
          paymentMethod: order.payment_method,
        }, { zapiEnabled: !!storeSettings.zapi_enabled });
      }

      // Notify drivers when order is ready for platform delivery
      if (newStatus === "pronto_para_entrega" && !isOwnDelivery && onlineDrivers && onlineDrivers.length > 0) {
        const driverUserIds = onlineDrivers.map((d: any) => d.user_id);
        pushNotifyDeliveryAvailable(driverUserIds, orderId).catch(console.error);
      }
    } catch (e: any) {
      toast.error(`Erro inesperado: ${e?.message}`);
    }
  };

  const { data: storeHours } = useQuery({
    queryKey: ["store-hours-check", store?.id],
    queryFn: async () => {
      const { data } = await supabase.from("opening_hours").select("*").eq("store_id", store!.id);
      return data || [];
    },
    enabled: !!store,
  });

  const allHoursClosed = useMemo(() => {
    if (!storeHours || storeHours.length === 0) return true;
    return storeHours.every((h: any) => h.is_closed_all_day);
  }, [storeHours]);

  const handleCancelOrder = async (order: any) => {
    try {
      const isPix = order.payment_method === "pix";
      const { error } = await supabase.from("orders").update({ status: "cancelado" as any }).eq("id", order.id);
      if (error) { toast.error("Erro ao cancelar pedido."); return; }
      
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      setCancelConfirm(null);

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
      }, { zapiEnabled: !!cancelSettings.zapi_enabled });

      if (isPix) {
        toast.success("Pedido cancelado! Reembolso PIX pendente.", { duration: 8000, description: `R$ ${Number(order.total_price).toFixed(2)} — envie o PIX de volta ao cliente.` });
      } else {
        toast.success("Pedido cancelado e cliente notificado.");
      }
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e?.message}`);
    }
  };

  const toggleStoreOpen = async () => {
    if (!store) return;
    const { error } = await supabase.from("stores").update({ is_open: !store.is_open }).eq("id", store.id);
    if (error) toast.error("Erro ao atualizar status.");
    else { toast.success(store.is_open ? "Loja pausada" : "Loja reaberta!"); queryClient.invalidateQueries({ queryKey: ["my-store", user?.id] }); }
  };

  // ── COMPUTED VALUES ──
  const pendingCount = orders?.filter(o => o.status === "pendente").length || 0;
  const preparingCount = orders?.filter(o => o.status === "preparando").length || 0;
  const readyCount = orders?.filter(o => o.status === "pronto_para_entrega").length || 0;
  const delayedOrders = useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    return orders.filter(o => {
      const elapsedMin = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      return elapsedMin > 20 && ["pendente", "preparando"].includes(o.status);
    });
  }, [orders]);
  const todayOrders = orders?.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString() && !["cancelado", "aguardando_pagamento"].includes(o.status)) || [];
  const todayTotal = sumMoney(todayOrders.map((order) => order.total_price));
  const todayCount = todayOrders.length;

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

  const filteredOrders = (orders?.filter(o => o.status === activeTab) || []).filter(o => {
    if (activeTab !== "entregue" || !settlementSearch.trim()) return true;
    const search = settlementSearch.toLowerCase().trim();
    return o.id.slice(0, 8).toLowerCase().includes(search) || (o.driver_id ? getDriverName(o.driver_id).toLowerCase().includes(search) : false) || getClientName(o.client_id).toLowerCase().includes(search);
  });

  const isOwnDelivery = (store as any)?.delivery_mode === "own";

  const getMainAction = (status: OrderStatus): { label: string; next: OrderStatus; emoji: string } | null => {
    switch (status) {
      case "pendente": return { label: "ACEITAR PEDIDO", next: "preparando", emoji: "✓" };
      case "preparando": return { label: "MARCAR COMO PRONTO", next: "pronto_para_entrega" as OrderStatus, emoji: "🔔" };
      case "pronto_para_entrega":
        if (isOwnDelivery) return { label: "SAIU PARA ENTREGA", next: "saiu_entrega" as OrderStatus, emoji: "🛵" };
        return null;
      case "saiu_entrega":
        if (isOwnDelivery) return { label: "MARCAR COMO ENTREGUE", next: "finalizado" as OrderStatus, emoji: "✅" };
        return null;
      default: return null;
    }
  };

  const handleTabChange = (tab: DashboardTab) => { setDashboardTab(tab); setSidebarOpen(false); setShowMoreSheet(false); };

  const isBottomNavMore = !bottomNavTabs.some(t => t.key === dashboardTab) && dashboardTab !== "dashboard";

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-background flex native-app">
      <SimulationBanner />

      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* More sheet overlay */}
      {showMoreSheet && <div className="fixed inset-0 bg-black/60 z-[60] lg:hidden" onClick={() => setShowMoreSheet(false)} />}

      {/* ── MORE BOTTOM SHEET (mobile) ── */}
      {showMoreSheet && (
        <div className="fixed inset-x-0 bottom-0 z-[70] lg:hidden animate-fade-in">
          <div className="bg-card border-t border-border rounded-t-2xl pb-safe">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              {moreSheetItems.filter(item => (!item.pizzaOnly || store?.category === "pizzas") && (item.key !== "reports" || storePlan.allowFullReports) && (item.key !== "clients" || storePlan.allowFullReports)).map(item => {
                const Icon = item.icon;
                const isActive = dashboardTab === item.key;
                return (
                  <button key={item.key} onClick={() => handleTabChange(item.key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-bold">{item.label}</span>
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
              <p className="text-sm font-bold text-foreground">R$ {todayTotal.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{todayCount} pedidos</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {baseSidebarItems.filter(i => (!i.pizzaOnly || store?.category === "pizzas") && (i.key !== "reports" || storePlan.allowFullReports) && (i.key !== "clients" || storePlan.allowFullReports)).map(item => {
            const isActive = dashboardTab === item.key;
            const Icon = item.icon;
            return (
              <button key={item.key} onClick={() => handleTabChange(item.key)}
                data-tour={item.key === "orders" ? "loja-orders" : item.key === "menu" ? "loja-menu" : item.key === "clients" ? "loja-clients" : undefined}
                className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
                {item.key === "orders" && pendingCount > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">{pendingCount}</span>
                )}
                {item.key === "clients" && (
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
            <button onClick={toggleAutoPrint}
              className={`p-2 rounded-xl border border-border ${autoPrint ? "text-primary bg-primary/5" : "text-muted-foreground"}`}>
              <Printer className="h-4 w-4 mx-auto" />
            </button>
            <button onClick={toggleStoreOpen}
              className={`col-span-2 py-2 rounded-xl text-xs font-bold border transition-colors ${store?.is_open ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}
              data-tour="loja-status">
              {store?.is_open ? "✓ Aberto" : "✕ Pausado"}
            </button>
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
              <button onClick={toggleStoreOpen}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 transition-colors lg:hidden ${
                  store?.is_open
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-red-500/10 text-red-500"
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${store?.is_open ? "bg-emerald-500" : "bg-red-500"}`} />
                {store?.is_open ? "Aberta" : "Pausada"}
              </button>
              {/* Desktop subtitle */}
              <p className="text-xs text-muted-foreground hidden lg:block">
                {dashboardTab === "dashboard" && "Resumo do dia em tempo real"}
                {dashboardTab === "orders" && `${orders?.length || 0} pedidos ativos`}
                {dashboardTab === "clients" && `${clientAnalytics.length} clientes registrados`}
                {dashboardTab === "menu" && "Gerencie seu cardápio"}
                {dashboardTab === "addons" && "Grupos de adicionais"}
                {dashboardTab === "bordas" && "Opções de borda para pizzas"}
                {dashboardTab === "hours" && "Horários de funcionamento"}
                {dashboardTab === "finance" && "Resumo financeiro"}
                {dashboardTab === "settings" && "Configurações da loja"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {showSoundPrompt && !soundEnabled && (
              <button onClick={activateSound}
                className="flex items-center gap-1 bg-amber-400/10 border border-amber-400/30 text-amber-500 px-2.5 py-1.5 rounded-xl text-[11px] font-bold animate-pulse">
                <Bell className="h-3.5 w-3.5" /> Alertas
              </button>
            )}
            {pendingCount > 0 && dashboardTab !== "orders" && (
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
            <button
              onClick={async () => { await signOut(); toast.success("Você saiu da conta."); navigate("/portal-parceiro"); }}
              className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
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
          {dashboardTab === "dashboard" && !isApproved && (
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
            <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4 lg:space-y-6">
              {/* Hours Configuration Alert */}
              {allHoursClosed && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-amber-600 text-sm">Configure seus horários</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sua loja está com todos os horários fechados. Configure para receber pedidos.
                    </p>
                    <button
                      onClick={() => setDashboardTab("hours")}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Clock className="inline h-3 w-3 mr-1" />
                      Configurar Horários
                    </button>
                  </div>
                </div>
              )}
              {/* Commission Alert - only for plans with commission */}
              {storePlan.hasCommission && (
                <CommissionAlert
                  storeId={store.id}
                  storeName={store.name}
                  onGoToFinance={() => setDashboardTab("finance")}
                />
              )}
              {/* Platform Split Alert - for fixed plans (R$2 per cash/card order) */}
              {!storePlan.hasCommission && storePlan.isItatingaFixed && (
                <PlatformSplitAlert
                  storeId={store.id}
                  storeName={store.name}
                  splitPerOrder={storePlan.platformDeliverySplit}
                  onGoToFinance={() => setDashboardTab("finance")}
                />
              )}
              {/* Plan Badge */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                storePlan.planType === "fixed" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                storePlan.planType === "hybrid" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              }`}>
                <CreditCard className="h-3.5 w-3.5" />
                {storePlan.planType === "fixed" && `Plano Fixo • R$ ${storePlan.monthlyFee.toFixed(0)}/mês`}
                {storePlan.planType === "hybrid" && `Assinatura + ${storePlan.commissionRate}% • R$ ${storePlan.monthlyFee.toFixed(0)}/mês`}
                {storePlan.planType === "commission_only" && `Comissão ${storePlan.commissionRate}%`}
              </div>
              {/* At-a-Glance Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                <GlanceCard
                  icon={ShoppingBag}
                  label="Pendentes"
                  value={pendingCount}
                  subValue={preparingCount > 0 ? `+ ${preparingCount} preparando` : undefined}
                  color={pendingCount > 0 ? "text-amber-500" : "text-muted-foreground"}
                  onClick={() => { setDashboardTab("orders"); setActiveTab("pendente"); }}
                />
                <GlanceCard
                  icon={DollarSign}
                  label="Faturamento Hoje"
                  value={`R$ ${todayTotal.toFixed(2)}`}
                  subValue={`${todayCount} pedidos`}
                  color="text-emerald-500"
                  trend={todayTotal > 0 ? "up" : null}
                  onClick={() => setDashboardTab("finance")}
                />
                {/* Motoboy plataforma oculto */}
                <GlanceCard
                  icon={Timer}
                  label="Tempo Médio"
                  value={avgDeliveryTime ? `${avgDeliveryTime} min` : "—"}
                  subValue="Pedido → Entrega"
                  color="text-purple-500"
                />
                <GlanceCard
                  icon={Users}
                  label="Clientes"
                  value={clientAnalytics.length}
                  subValue="Total cadastrados"
                  color="text-blue-500"
                  onClick={() => setDashboardTab("clients")}
                />
              </div>
              {delayedOrders.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-3">
                  <GlanceCard
                    icon={AlertTriangle}
                    label="Em Atraso"
                    value={delayedOrders.length}
                    subValue="> 20 min sem ação"
                    color="text-destructive"
                    onClick={() => setShowDelayedPanel(!showDelayedPanel)}
                  />
                </div>
              )}

              {/* Delayed Orders Panel */}
              {delayedOrders.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/30 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setShowDelayedPanel(!showDelayedPanel)}
                    className="w-full flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-bold text-destructive">Em Atraso ({delayedOrders.length})</span>
                    </div>
                    {showDelayedPanel ? <ChevronUp className="h-4 w-4 text-destructive" /> : <ChevronDown className="h-4 w-4 text-destructive" />}
                  </button>
                  {showDelayedPanel && (
                    <div className="px-3 pb-3 space-y-2">
                      {delayedOrders.map((order: any) => {
                        const elapsedMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                        const sc = statusColors[order.status] || statusColors.pendente;
                        return (
                          <div key={order.id} className="bg-card border border-destructive/20 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                              </div>
                              <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                {elapsedMin} min
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{getClientName(order.client_id)}</span>
                              <span>•</span>
                              <span>{paymentIcons[order.payment_method]} {paymentLabels[order.payment_method] || order.payment_method}</span>
                              <span>•</span>
                              <span className="font-bold text-foreground">R$ {Number(order.total_price).toFixed(2)}</span>
                            </div>
                            <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 space-y-0.5">
                              {order.order_items?.slice(0, 4).map((item: any) => (
                                <div key={item.id} className="flex justify-between text-xs">
                                  <span className="text-foreground"><span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}</span>
                                  <span className="text-muted-foreground">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                              {(order.order_items?.length || 0) > 4 && (
                                <p className="text-[10px] text-muted-foreground">+{order.order_items.length - 4} itens...</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{order.neighborhood}</span>
                            </div>
                            <div className="flex gap-2">
                              {order.status === "pendente" && (
                                <button onClick={() => updateOrderStatus(order.id, "preparando")}
                                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs active:scale-[0.98] transition-transform">
                                  {order.payment_method === "pix" ? "🍳 PRODUZIR" : "✓ ACEITAR"}
                                </button>
                              )}
                              {order.status === "preparando" && (
                                <button onClick={() => updateOrderStatus(order.id, "pronto_para_entrega" as OrderStatus)}
                                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-xl text-xs active:scale-[0.98] transition-transform">
                                  🔔 MARCAR PRONTO
                                </button>
                              )}
                              {getClientWhatsApp(order.client_id) && (
                                <WhatsAppButton number={getClientWhatsApp(order.client_id)} message={`Olá! Sobre seu pedido #${order.id.slice(0, 8).toUpperCase()}, estamos cuidando dele!`} />
                              )}
                              <OrderChat
                                orderId={order.id}
                                storeName={store?.name || "Loja"}
                                storeOwnerId={store?.owner_id}
                                clientId={order.client_id}
                                driverId={order.driver_id}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Mode Quick Config */}
              {(() => {
                const PLATFORM_CITIES = ["itatinga"];
                const storeCity = ((store as any).address_city || "").toLowerCase().trim();
                const hasPlatformSupport = PLATFORM_CITIES.includes(storeCity) && storePlan.allowPlatformDelivery;

                return (
                  <div className="bg-card border border-border rounded-2xl p-3 lg:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-foreground text-sm">Modo de Entrega</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(store as any).delivery_mode === "own" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>
                        {(store as any).delivery_mode === "own" ? "Próprio" : "Plataforma"}
                      </span>
                    </div>
                    {/* Motoboy plataforma oculto — só mostra "Próprio" como ativo */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-primary bg-primary/10">
                      <Truck className="h-5 w-5 text-primary" />
                      <span className="text-[11px] font-bold text-primary">Motoboy Próprio</span>
                    </div>
                {(store as any).delivery_mode === "own" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground/80">Taxa de entrega fixa (R$)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={((store as any).own_delivery_fee || 0).toString()}
                        onBlur={async (e) => {
                          const val = parseFloat(e.target.value.replace(",", ".")) || 0;
                          await supabase.from("stores").update({ own_delivery_fee: val } as any).eq("id", store.id);
                          queryClient.invalidateQueries({ queryKey: ["my-store", user?.id] });
                          toast.success(`Taxa fixa atualizada para R$ ${val.toFixed(2)}`);
                        }}
                        placeholder="Ex: 5.00"
                        className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                )}
                  </div>
                );
              })()}

              {/* Priority Queue - New orders with pulse */}
              {pendingCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <h3 className="font-bold text-foreground text-sm">Aguardando</h3>
                    <span className="bg-amber-400 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                  </div>
                  <div className="space-y-2">
                    {orders?.filter(o => o.status === "pendente").slice(0, 5).map((order: any) => (
                      <div key={order.id} className="bg-card border-2 border-amber-500/40 rounded-2xl p-3 animate-pulse-border hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                          <p className="text-xl font-black text-emerald-500">R$ {Number(order.total_price).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 flex-wrap">
                          <span>{getClientName(order.client_id)}</span>
                          <span>•</span>
                          <span>{order.neighborhood}</span>
                          <span>•</span>
                          <span>{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>•</span>
                          <span>{paymentIcons[order.payment_method]}</span>
                        </div>
                        <div className="bg-muted/50 rounded-xl px-3 py-2 mb-3 space-y-0.5">
                          {order.order_items?.map((item: any) => (
                            <div key={item.id} className="text-sm text-foreground">
                              <span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}
                            </div>
                          ))}
                        </div>
                        {order.payment_method === "pix" && (
                          <div className="text-center mb-2">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">💰 PIX — Pagamento Confirmado</span>
                          </div>
                        )}
                        <button onClick={() => updateOrderStatus(order.id, "preparando")}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm active:scale-[0.98] transition-transform h-12">
                          {order.payment_method === "pix" ? "🍳 COMEÇAR PRODUÇÃO" : "✓ ACEITAR PEDIDO"}
                        </button>
                        <button onClick={() => handleCancelOrder(order)}
                          className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1 mt-1">
                          Recusar pedido
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders in progress summary */}
              {(preparingCount > 0 || readyCount > 0) && (
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground text-sm">Em Andamento</h3>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {orders?.filter(o => ["preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"].includes(o.status)).slice(0, 6).map((order: any) => {
                      const sc = statusColors[order.status] || statusColors.pendente;
                      return (
                        <button key={order.id}
                          onClick={() => { setDashboardTab("orders"); setActiveTab(order.status as OrderStatus); }}
                          className={`flex-shrink-0 bg-card border ${sc.border} rounded-xl p-2.5 flex items-center gap-2 min-w-[180px] hover:shadow-md transition-shadow`}>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                          <span className="text-xs font-bold text-foreground">#{order.id.slice(0, 6).toUpperCase()}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{getClientName(order.client_id)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => { setDashboardTab("orders"); }}
                    className="text-xs text-primary font-bold hover:underline">
                    Ver todos →
                  </button>
                </div>
              )}

              {/* Top clients preview */}
              {clientAnalytics.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground text-sm">Top Clientes</h3>
                    <button onClick={() => setDashboardTab("clients")} className="text-xs text-primary font-bold hover:underline">Ver todos →</button>
                  </div>
                  <div className="grid gap-1.5">
                    {clientAnalytics.slice(0, 5).map(client => (
                      <div key={client.clientId} className="bg-card border border-border rounded-xl p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{client.name}</p>
                            <p className="text-[10px] text-muted-foreground">{client.totalOrders} pedidos</p>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-emerald-500">R$ {client.totalSpent.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════ CLIENTS TAB ══════ */}
          {dashboardTab === "clients" && store && (
            <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-3">
              {/* Filters - horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {([
                  { key: "all" as ClientFilter, label: "Todos", icon: Users },
                  { key: "loyal" as ClientFilter, label: "Fiéis (3+)", icon: Heart },
                  { key: "inactive" as ClientFilter, label: "Inativos 15d", icon: UserX },
                  { key: "location" as ClientFilter, label: "Localização", icon: MapPinned },
                ]).map(f => (
                  <button key={f.key} onClick={() => setClientFilter(f.key)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      clientFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}>
                    <f.icon className="h-3.5 w-3.5" /> {f.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  placeholder="Buscar por nome, bairro ou telefone..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              {/* Inactive alert */}
              {clientFilter === "inactive" && filteredClients.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    <span className="font-bold">{filteredClients.length} clientes</span> sem pedidos há 15+ dias
                  </p>
                </div>
              )}

              {/* Client list */}
              <div className="space-y-2">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-bold">Nenhum cliente encontrado</p>
                  </div>
                ) : filteredClients.map(client => (
                  <div key={client.clientId} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <button onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground truncate">{client.name}</p>
                            <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{client.totalOrders}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{client.daysSinceLastOrder === 0 ? "Hoje" : `${client.daysSinceLastOrder}d atrás`}</span>
                            <span>•</span>
                            <span>{client.neighborhood || "—"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedClient === client.clientId ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expandedClient === client.clientId && (
                      <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                            <p className="text-sm font-black text-foreground">{formatCurrency(client.totalSpent)}</p>
                            <p className="text-[10px] text-muted-foreground">Total Gasto</p>
                          </div>
                          <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                            <p className="text-sm font-black text-foreground">{formatCurrency(client.ticketMedio)}</p>
                            <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
                          </div>
                          <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                              <p className="text-xs font-black text-foreground truncate">{client.favProduct}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Favorito</p>
                          </div>
                        </div>

                        {/* Recent orders */}
                        <div>
                          <p className="text-xs font-bold text-muted-foreground mb-2">Últimos Pedidos</p>
                          <div className="space-y-1.5">
                            {client.orders.slice(0, 5).map((order: any) => {
                              const sc = statusColors[order.status] || statusColors.pendente;
                              return (
                                <div key={order.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                                      {sc.label}
                                    </span>
                                    <span className="text-foreground font-medium">#{order.id.slice(0, 6).toUpperCase()}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                                    <span className="font-bold text-foreground">R$ {Number(order.total_price).toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Quick actions */}
                        {client.phone && (
                          <div className="flex gap-2">
                            <WhatsAppButton number={client.phone}
                              message={`Olá ${client.name}! Temos novidades no ${store?.name}! 🍔`}
                              label="Promoção" size="sm" />
                            <WhatsAppButton number={client.phone}
                              message={`Olá ${client.name}! Sentimos sua falta no ${store?.name}! 😊 Que tal pedir algo hoje?`}
                              label="Reativar" size="sm" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ ORDERS TAB ══════ */}
          {dashboardTab === "orders" && store && (
            <>
              {/* Order status tabs */}
              <div className="sticky top-0 z-20 bg-background border-b border-border">
                <div className="flex overflow-x-auto gap-1 px-3 py-2 no-scrollbar">
                  {orderTabs.map((tab) => {
                    const count = orders?.filter(o => o.status === tab.status).length || 0;
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.status;
                    return (
                      <button key={tab.status} onClick={() => setActiveTab(tab.status)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          isActive
                            ? tab.status === "pendente" ? "bg-amber-500/20 text-amber-600 border border-amber-400/40" : "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}>
                        <Icon className="h-3 w-3" />
                        {tab.label}
                        {count > 0 && (
                          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            tab.status === "pendente" ? "bg-amber-400 text-amber-900 animate-pulse" : isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                          }`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settlement search */}
              {activeTab === "entregue" && (orders?.filter(o => o.status === "entregue").length || 0) > 1 && (
                <div className="px-4 pt-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" value={settlementSearch} onChange={e => setSettlementSearch(e.target.value)}
                      placeholder="Buscar por ID, entregador ou cliente..."
                      className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    {settlementSearch && (
                      <button onClick={() => setSettlementSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Order cards */}
              <div className="p-4 space-y-3 max-w-3xl mx-auto">
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border animate-pulse">
                        <div className="h-8 bg-muted/60" />
                        <div className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="h-5 bg-muted rounded-lg w-32" />
                              <div className="h-3 bg-muted rounded w-24" />
                            </div>
                            <div className="space-y-2 items-end flex flex-col">
                              <div className="h-6 bg-muted rounded-lg w-20" />
                              <div className="h-3 bg-muted rounded w-12" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-8 bg-muted rounded-lg w-20" />
                            <div className="h-8 bg-muted rounded-lg w-16" />
                            <div className="h-8 bg-muted rounded-lg w-24" />
                          </div>
                          <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                            <div className="h-3 bg-muted rounded w-3/4" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                          </div>
                          <div className="flex gap-2">
                            <div className="h-10 bg-muted rounded-xl w-10" />
                            <div className="h-10 bg-muted rounded-xl flex-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order: any, index: number) => {
                    const action = getMainAction(order.status);
                    const isAddressExpanded = expandedAddresses.has(order.id);
                    const sc = statusColors[order.status] || statusColors.pendente;
                    
                    const elapsedMs = Date.now() - new Date(order.created_at).getTime();
                    const elapsedMin = Math.floor(elapsedMs / 60000);
                    const isDelayed = elapsedMin > 20 && ["pendente", "preparando"].includes(order.status);

                    return (
                      <div key={order.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className={`bg-card rounded-2xl overflow-hidden border transition-all duration-300 animate-fade-in ${
                          isDelayed ? "border-destructive/50 shadow-[0_0_12px_-4px] shadow-destructive/20" :
                          order.status === "pendente" ? "border-amber-400/40 shadow-amber-400/5 animate-pulse-border" : "border-border"
                        } hover:shadow-md`}>
                        {/* Status bar with wait timer */}
                        <div className={`px-3 py-1.5 ${sc.bg} flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${sc.text}`}>{sc.label}</span>
                            {isDelayed && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {["pendente", "preparando", "pronto_para_entrega"].includes(order.status) && (
                              <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isDelayed ? "bg-destructive/10 text-destructive" : 
                                elapsedMin > 10 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : 
                                "bg-muted text-muted-foreground"
                              }`}>
                                <Timer className="h-2.5 w-2.5" />
                                {elapsedMin}min
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        {/* Critical info: ID + Value */}
                        <div className="px-3 pt-2.5 pb-1.5 flex items-start justify-between">
                          <div>
                            <p className="text-base font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                              <span>{getClientName(order.client_id)}</span>
                              <span className="text-muted-foreground/40">•</span>
                              <span>{order.neighborhood}</span>
                              <span className="text-muted-foreground/40">•</span>
                              <span>{paymentIcons[order.payment_method]}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-emerald-500">R$ {Number(order.total_price).toFixed(2)}</p>
                            {order.payment_method === "pix" && (
                              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">PIX PAGO</span>
                            )}
                          </div>
                        </div>

                        {/* Items - compact */}
                        <div className="mx-3 mb-2 bg-muted/50 rounded-xl px-3 py-2 space-y-0.5">
                          {order.order_items?.map((item: any) => (
                            <div key={item.id} className="text-sm text-foreground">
                              <span className="text-primary font-bold">{item.quantity}x</span> {getOrderItemDisplayName(item)}
                            </div>
                          ))}
                          {order.order_items?.map((item: any) => {
                            const rawAddons = item.addons;
                            const addons: any[] = Array.isArray(rawAddons) ? rawAddons : (typeof rawAddons === 'string' ? (() => { try { return JSON.parse(rawAddons); } catch { return []; } })() : []);
                            if (!addons || addons.length === 0) return null;
                            return (
                              <div key={`addons-${item.id}`} className="pl-5 text-[11px] text-muted-foreground">
                                {addons.map((a: any, idx: number) => (
                                  <span key={idx}>+ {a.name}{a.price > 0 ? ` (R$${Number(a.price).toFixed(2)})` : ""}{idx < addons.length - 1 ? ", " : ""}</span>
                                ))}
                              </div>
                            );
                          })}
                          {order.order_items?.map((item: any) => {
                            if (!item.observations) return null;
                            return <div key={`obs-${item.id}`} className="pl-5 text-[11px] text-muted-foreground italic">📝 {item.observations}</div>;
                          })}
                          {order.payment_method === "dinheiro" && (order as any).needs_change && Number((order as any).change_for) > 0 && (
                            <div className="flex items-center gap-1 pt-1 border-t border-border">
                              <Banknote className="h-3 w-3 text-amber-500" />
                              <span className="text-[10px] text-amber-500 font-bold">Troco: R$ {(Number((order as any).change_for) - Number(order.total_price)).toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {/* Address */}
                        <div className="mx-3 mb-2">
                          <button onClick={() => toggleAddress(order.id)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate flex-1 text-left">{order.neighborhood}</span>
                            {isAddressExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                          {isAddressExpanded && (
                            <div className="mt-1.5 bg-muted/30 rounded-lg p-2.5 text-xs text-muted-foreground space-y-0.5 animate-fade-in">
                              <p>{order.address_details}</p>
                              <p className="text-muted-foreground/70">Taxa entrega: R$ {Number(order.delivery_fee).toFixed(2)}</p>
                            </div>
                          )}
                        </div>

                        {/* Driver status - Platform mode */}
                        {order.status === "pronto_para_entrega" && !order.driver_id && !isOwnDelivery && (
                          <div className="mx-3 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Aguardando entregador</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${(onlineDrivers?.length || 0) > 0 ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
                              <span className="text-[10px] text-muted-foreground">
                                {(onlineDrivers?.length || 0) > 0 ? `${onlineDrivers?.length} entregador(es) online` : "Nenhum entregador online"}
                              </span>
                            </div>
                          </div>
                        )}
                        {order.status === "pronto_para_entrega" && isOwnDelivery && (
                          <div className="mx-3 mb-2 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">🛵 Pronto — aguardando seu motoboy</span>
                            </div>
                          </div>
                        )}
                        {order.driver_id && order.status === "pronto_para_entrega" && !isOwnDelivery && (
                          <div className="mx-3 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <Bike className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">🏍️ {getDriverName(order.driver_id)} a caminho da loja</span>
                          </div>
                        )}
                        {order.status === "saiu_entrega" && isOwnDelivery && (
                          <div className="mx-3 mb-2 flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                            <Truck className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">🛵 Seu motoboy está entregando</span>
                          </div>
                        )}
                        {order.driver_id && (order.status === "em_transito" || (order.status === "saiu_entrega" && !isOwnDelivery)) && (
                          <div className="mx-3 mb-2 flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                            <Truck className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">🛵 {getDriverName(order.driver_id)} entregando</span>
                          </div>
                        )}

                        {/* Collection Code */}
                        {(order.status === "pronto_para_entrega" || order.status === "saiu_entrega" || order.status === "em_transito") && (order as any).collection_code && !isOwnDelivery && (
                          <div className="mx-3 mb-2 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-purple-500 font-bold mb-1">🔐 Código de Coleta</p>
                            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-[0.3em]">{(order as any).collection_code}</p>
                          </div>
                        )}

                        {/* Settlement Code */}
                        {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).settlement_code && ["entregue", "finalizado"].includes(order.status) && !(order as any).return_to_store_confirmed && !isOwnDelivery && (
                          <div className="mx-3 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                            {order.driver_id && (
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10">
                                <Bike className="h-4 w-4 text-amber-500" />
                                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">🏍️ {getDriverName(order.driver_id)}</span>
                                <span className="ml-auto text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">🔑 Código de Acerto</p>
                              <button onClick={() => { navigator.clipboard.writeText((order as any).settlement_code); toast.success("Copiado!"); }}
                                className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                <Copy className="h-2.5 w-2.5" /> Copiar
                              </button>
                            </div>
                            <p className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-[0.3em] text-center">{(order as any).settlement_code}</p>
                            <p className="text-[10px] text-muted-foreground text-center mt-1">Informe somente após receber R$ {Number(order.total_price).toFixed(2)}</p>
                          </div>
                        )}
                        {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).return_to_store_confirmed && ["entregue", "finalizado"].includes(order.status) && !isOwnDelivery && (
                          <div className="mx-3 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-500 font-bold">Acerto realizado ✅</span>
                          </div>
                        )}

                        {/* WhatsApp actions + Chat */}
                        <div className="mx-3 mb-2 flex flex-wrap gap-1.5">
                          {getClientWhatsApp(order.client_id) && (
                            <>
                              {order.status === "pendente" && (
                                <button onClick={() => {
                                  const msg = `Olá ${getClientName(order.client_id)}! *ItaSuper*: Pedido aceito e em produção! 🍔\nPedido: #${order.id.slice(0, 8).toUpperCase()}\nTotal: R$ ${Number(order.total_price).toFixed(2)}`;
                                  openWhatsApp(getClientWhatsApp(order.client_id), msg);
                                }} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg" title="Avisar cliente">
                                  <MessageCircle className="h-3 w-3" /> <span className="hidden sm:inline">Avisar</span>
                                </button>
                              )}
                              {(order.status === "em_transito" || order.status === "saiu_entrega") && (
                                <button onClick={() => {
                                  const msg = `Olá ${getClientName(order.client_id)}! Motoboy *ItaSuper* saiu para entrega! 🚀\nEndereço: ${order.address_details}`;
                                  openWhatsApp(getClientWhatsApp(order.client_id), msg);
                                }} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg" title="Informar saída">
                                  <MessageCircle className="h-3 w-3" /> <span className="hidden sm:inline">Saiu</span>
                                </button>
                              )}
                              <WhatsAppButton number={getClientWhatsApp(order.client_id)}
                                message={`Olá ${getClientName(order.client_id)}! Aqui é do ${store?.name}. Pedido #${order.id.slice(0, 8).toUpperCase()}...`}
                                label="Chat" size="sm" />
                            </>
                          )}
                          <OrderChat
                            orderId={order.id}
                            storeName={store?.name || "Loja"}
                            storeOwnerId={store?.owner_id}
                            clientId={order.client_id}
                            driverId={order.driver_id}
                          />
                        </div>

                        {/* Main action */}
                        <div className="px-3 pb-3 pt-1 flex items-center gap-2">
                          <button onClick={() => handlePrint(order)}
                            title="Imprimir"
                            className="p-2.5 bg-muted rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Printer className="h-4 w-4" />
                          </button>
                          <div className="flex-1">
                            {action && order.status === "pendente" ? (
                              <div className="space-y-1">
                                {order.payment_method === "pix" && (
                                  <div className="text-center">
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">💰 PIX — Pagamento Confirmado</span>
                                  </div>
                                )}
                                <button onClick={() => updateOrderStatus(order.id, "preparando")}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm active:scale-[0.98] transition-transform h-12">
                                  {order.payment_method === "pix" ? "🍳 COMEÇAR PRODUÇÃO" : "✓ ACEITAR PEDIDO"}
                                </button>
                                <button onClick={() => handleCancelOrder(order)}
                                  className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                                  Recusar pedido
                                </button>
                              </div>
                            ) : action ? (
                              <div className="space-y-1">
                                <button onClick={() => updateOrderStatus(order.id, action.next)}
                                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform h-12">
                                  {action.emoji} {action.label}
                                </button>
                                {cancelConfirm === order.id ? (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => handleCancelOrder(order)}
                                      className="flex-1 bg-destructive text-destructive-foreground text-xs font-bold py-2 rounded-xl">
                                      {order.payment_method === "pix" ? "💰 Cancelar + Reembolso PIX" : "Confirmar Cancelamento"}
                                    </button>
                                    <button onClick={() => setCancelConfirm(null)}
                                      className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground">
                                      Não
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setCancelConfirm(order.id)}
                                    className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                                    ✕ Cancelar pedido
                                  </button>
                                )}
                              </div>
                            ) : !["entregue", "finalizado", "cancelado"].includes(order.status) ? (
                              cancelConfirm === order.id ? (
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleCancelOrder(order)}
                                    className="flex-1 bg-destructive text-destructive-foreground text-xs font-bold py-2 rounded-xl">
                                    {order.payment_method === "pix" ? "💰 Cancelar + Reembolso PIX" : "Confirmar Cancelamento"}
                                  </button>
                                  <button onClick={() => setCancelConfirm(null)}
                                    className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground">
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setCancelConfirm(order.id)}
                                  className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                                  ✕ Cancelar pedido
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-muted/80 flex items-center justify-center mb-4">
                      {activeTab === "pendente" && <Clock className="h-8 w-8 text-muted-foreground/60" />}
                      {activeTab === "preparando" && <ChefHat className="h-8 w-8 text-muted-foreground/60" />}
                      {activeTab === "pronto_para_entrega" && <Package className="h-8 w-8 text-muted-foreground/60" />}
                      {(activeTab === "saiu_entrega" || activeTab === "em_transito") && <Truck className="h-8 w-8 text-muted-foreground/60" />}
                      {(activeTab === "entregue" || activeTab === "finalizado") && <CheckCircle2 className="h-8 w-8 text-muted-foreground/60" />}
                    </div>
                    <p className="text-sm font-bold text-foreground mb-1">
                      {activeTab === "pendente" && "Tudo em ordem! 🎉"}
                      {activeTab === "preparando" && "Nenhum pedido em preparo"}
                      {activeTab === "pronto_para_entrega" && "Nenhum pedido pronto"}
                      {(activeTab === "saiu_entrega" || activeTab === "em_transito") && "Nenhuma entrega em andamento"}
                      {(activeTab === "entregue" || activeTab === "finalizado") && "Nenhum pedido finalizado"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      {activeTab === "pendente" && "Novos pedidos aparecerão automaticamente."}
                      {activeTab === "preparando" && "Aceite pedidos pendentes para vê-los aqui."}
                      {activeTab === "pronto_para_entrega" && "Marque pedidos como prontos."}
                      {(activeTab === "saiu_entrega" || activeTab === "em_transito") && "Entregas aparecerão aqui."}
                      {(activeTab === "entregue" || activeTab === "finalizado") && "Pedidos concluídos aparecerão aqui."}
                    </p>
                  </div>
                )}
              </div>

              {/* Floating pending badge */}
              {pendingCount > 0 && activeTab !== "pendente" && (
                <button onClick={() => setActiveTab("pendente")}
                  className="fixed bottom-24 lg:bottom-6 right-6 bg-amber-400 text-amber-900 font-bold px-4 py-2.5 rounded-xl shadow-lg animate-bounce flex items-center gap-2 text-sm z-30">
                  <Clock className="h-4 w-4" /> {pendingCount} novo{pendingCount > 1 ? "s" : ""}
                </button>
              )}
            </>
          )}

          {/* ══════ OTHER TABS ══════ */}
          {!["dashboard", "orders", "clients"].includes(dashboardTab) && store && (
            <div className="p-4 lg:p-6 max-w-5xl">
              {dashboardTab === "menu" && <MenuBuilder storeId={store.id} storeCategory={store.category} />}
              
              {dashboardTab === "addons" && <AddonManager storeId={store.id} />}
              {dashboardTab === "bordas" && store.category === "pizzas" && <PizzaBorderManager storeId={store.id} />}
              {dashboardTab === "hours" && <StoreHoursManager storeId={store.id} forceClosed={(store as any).force_closed || false} />}
              {dashboardTab === "settings" && (
                <div className="space-y-6">
                  <StoreSettings storeId={store.id} storeName={store.name} storeCategory={store.category}
                    storeImageUrl={store.image_url} storeIsOpen={store.is_open}
                    forceClosed={(store as any).force_closed || false} storeSlug={(store as any).slug || null}
                    storeAddressStreet={(store as any).address_street || null}
                    storeAddressNumber={(store as any).address_number || null}
                    storeAddressComplement={(store as any).address_complement || null}
                    storeAddressNeighborhood={(store as any).address_neighborhood || null}
                    storeAddressReference={(store as any).address_reference || null}
                    storeAddressCity={(store as any).address_city || null}
                    storeAddressState={(store as any).address_state || null}
                    storeAddressCep={(store as any).address_cep || null}
                    storeDeliveryMode={(store as any).delivery_mode || "platform"}
                    storeOwnDeliveryFee={(store as any).own_delivery_fee || 0}
                    storeSettings={(store as any).settings || null} />

                </div>
              )}
              {dashboardTab === "finance" && storePlan.hasCommission && <StoreFinancePanel storeId={store.id} storeName={store.name} />}
               {dashboardTab === "finance" && !storePlan.hasCommission && <StoreFinanceBasic storeId={store.id} storeName={store.name} />}
              {dashboardTab === "subscription" && <StoreSubscription storeId={store.id} storeName={store.name} />}
              {dashboardTab === "loyalty" && storePlan.allowLoyalty && <LoyaltyConfigPanel storeId={store.id} />}
              {dashboardTab === "loyalty" && !storePlan.allowLoyalty && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Star className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-base font-bold text-foreground mb-1">Programa de Fidelidade</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Disponível nos planos Crescimento e Comissão. Faça upgrade para fidelizar seus clientes!
                  </p>
                </div>
              )}
              {dashboardTab === "reports" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-foreground">Relatórios Avançados</h3>
                  {(() => {
                    const periods = [7, 14, 30, 90];
                    const selectedPeriod = selectedReportPeriod;
                    const setSelectedPeriod = setSelectedReportPeriod;

                    const periodDays = Array.from({ length: selectedPeriod }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (selectedPeriod - 1 - i));
                      return d.toISOString().split("T")[0];
                    });
                    const periodOrders = (allOrders || []).filter((o: any) => {
                      const d = new Date(o.created_at).toISOString().split("T")[0];
                      return periodDays.includes(d) && !["cancelado", "aguardando_pagamento"].includes(o.status);
                    });

                    // Previous period for comparison
                    const prevPeriodDays = Array.from({ length: selectedPeriod }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (selectedPeriod * 2 - 1 - i));
                      return d.toISOString().split("T")[0];
                    });
                    const prevPeriodOrders = (allOrders || []).filter((o: any) => {
                      const d = new Date(o.created_at).toISOString().split("T")[0];
                      return prevPeriodDays.includes(d) && !["cancelado", "aguardando_pagamento"].includes(o.status);
                    });

                    const completedPeriod = periodOrders.filter((o: any) => ["entregue", "finalizado"].includes(o.status));
                    const completedPrev = prevPeriodOrders.filter((o: any) => ["entregue", "finalizado"].includes(o.status));

                    const totalRevenue = sumMoney(completedPeriod.map((o: any) => o.total_price));
                    const prevRevenue = sumMoney(completedPrev.map((o: any) => o.total_price));
                    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;

                    const totalOrders = completedPeriod.length;
                    const prevOrderCount = completedPrev.length;
                    const orderGrowth = prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount * 100) : 0;

                    const avgTicket = averageMoney(totalRevenue, totalOrders);
                    const prevAvgTicket = averageMoney(prevRevenue, prevOrderCount);
                    const ticketGrowth = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket * 100) : 0;

                    const cancelledOrders = periodOrders.filter((o: any) => o.status === "cancelado").length;
                    const cancelRate = periodOrders.length > 0 ? (cancelledOrders / periodOrders.length * 100) : 0;

                    // Daily chart data
                    const dailyChart = periodDays.map(date => {
                      const dayOrders = completedPeriod.filter((o: any) => new Date(o.created_at).toISOString().split("T")[0] === date);
                      return {
                        day: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
                        vendas: Math.round(sumMoney(dayOrders.map((o: any) => o.total_price)) * 100) / 100,
                        pedidos: dayOrders.length,
                      };
                    });

                    // Hourly distribution
                    const hourlyMap: Record<number, number> = {};
                    completedPeriod.forEach((o: any) => {
                      const h = new Date(o.created_at).getHours();
                      hourlyMap[h] = (hourlyMap[h] || 0) + 1;
                    });
                    const hourlyChart = Array.from({ length: 24 }, (_, h) => ({
                      hour: `${String(h).padStart(2, "0")}h`,
                      pedidos: hourlyMap[h] || 0,
                    })).filter(h => h.pedidos > 0 || (parseInt(h.hour) >= 8 && parseInt(h.hour) <= 23));
                    const peakHour = Object.entries(hourlyMap).sort(([,a], [,b]) => b - a)[0];

                    // Payment breakdown
                    const paymentPie = [
                      { name: "PIX", value: completedPeriod.filter((o: any) => o.payment_method === "pix").length, total: sumMoney(completedPeriod.filter((o: any) => o.payment_method === "pix").map((o: any) => o.total_price)) },
                      { name: "Cartão", value: completedPeriod.filter((o: any) => o.payment_method === "cartao").length, total: sumMoney(completedPeriod.filter((o: any) => o.payment_method === "cartao").map((o: any) => o.total_price)) },
                      { name: "Dinheiro", value: completedPeriod.filter((o: any) => o.payment_method !== "pix" && o.payment_method !== "cartao").length, total: sumMoney(completedPeriod.filter((o: any) => o.payment_method !== "pix" && o.payment_method !== "cartao").map((o: any) => o.total_price)) },
                    ].filter(d => d.value > 0);

                    // Top products
                    const topProducts = new Map<string, { qty: number; revenue: number }>();
                    completedPeriod.forEach((o: any) => {
                      o.order_items?.forEach((item: any) => {
                        const name = getOrderItemDisplayName(item);
                        const existing = topProducts.get(name) || { qty: 0, revenue: 0 };
                        topProducts.set(name, { qty: existing.qty + item.quantity, revenue: existing.revenue + (item.unit_price * item.quantity) });
                      });
                    });
                    const sortedProducts = Array.from(topProducts.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);

                    // Weekday distribution
                    const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                    const weekdayMap: Record<number, { pedidos: number; vendas: number }> = {};
                    completedPeriod.forEach((o: any) => {
                      const wd = new Date(o.created_at).getDay();
                      if (!weekdayMap[wd]) weekdayMap[wd] = { pedidos: 0, vendas: 0 };
                      weekdayMap[wd].pedidos += 1;
                      weekdayMap[wd].vendas += Number(o.total_price);
                    });
                    const weekdayChart = Array.from({ length: 7 }, (_, i) => ({
                      dia: weekdayNames[i],
                      pedidos: weekdayMap[i]?.pedidos || 0,
                      vendas: Math.round((weekdayMap[i]?.vendas || 0) * 100) / 100,
                    }));
                    const bestDay = weekdayChart.reduce((best, d) => d.vendas > best.vendas ? d : best, weekdayChart[0]);

                    const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];

                    const exportCSV = () => {
                      const header = "Data,Vendas,Pedidos";
                      const rows = dailyChart.map(d => `${d.day},${d.vendas.toFixed(2)},${d.pedidos}`);
                      const productHeader = "\n\nProduto,Quantidade,Receita";
                      const productRows = sortedProducts.map(([name, d]) => `${name},${d.qty},${d.revenue.toFixed(2)}`);
                      const blob = new Blob([[header, ...rows, productHeader, ...productRows].join("\n")], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `relatorio-${store?.name || "loja"}-${selectedPeriod}d.csv`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success("Relatório CSV exportado!");
                    };

                    return (
                      <>
                        {/* Period selector */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          {periods.map(p => (
                            <button key={p} onClick={() => setSelectedPeriod(p)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                selectedPeriod === p
                                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                  : "bg-card text-muted-foreground hover:bg-accent border border-border"
                              }`}>
                              {p}d
                            </button>
                          ))}
                        </div>

                        {/* KPI Cards with comparison */}
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Receita Total", value: formatCurrency(totalRevenue), growth: revenueGrowth, color: "emerald" },
                            { label: "Pedidos", value: totalOrders.toString(), growth: orderGrowth, color: "blue" },
                            { label: "Ticket Médio", value: formatCurrency(avgTicket), growth: ticketGrowth, color: "purple" },
                            { label: "Taxa Cancelamento", value: `${cancelRate.toFixed(1)}%`, growth: null, color: cancelRate > 5 ? "red" : "emerald" },
                          ].map((kpi) => (
                            <div key={kpi.label} className={`bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden`}>
                              <div className={`absolute inset-0 bg-gradient-to-br from-${kpi.color}-500/5 to-transparent`} />
                              <div className="relative">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{kpi.label}</p>
                                <p className={`text-2xl font-black tracking-tight mt-1 text-${kpi.color}-500`}>{kpi.value}</p>
                                {kpi.growth !== null && (
                                  <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${kpi.growth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                                    {kpi.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {kpi.growth >= 0 ? "+" : ""}{kpi.growth.toFixed(1)}% vs anterior
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Insights Cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">🔥 Horário de Pico</p>
                            <p className="text-lg font-black text-foreground mt-1">{peakHour ? `${peakHour[0].padStart(2, "0")}:00` : "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{peakHour ? `${peakHour[1]} pedidos` : "Sem dados"}</p>
                          </div>
                          <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">📅 Melhor Dia</p>
                            <p className="text-lg font-black text-foreground mt-1">{bestDay?.dia || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{bestDay ? `${formatCurrency(bestDay.vendas)}` : "Sem dados"}</p>
                          </div>
                        </div>

                        {/* Revenue Chart */}
                        {dailyChart.length > 1 && (
                          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
                            <p className="text-xs font-bold text-foreground mb-4">📈 Evolução de Vendas ({selectedPeriod} dias)</p>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyChart}>
                                  <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(dailyChart.length / 8))} />
                                  <YAxis hide />
                                  <RechartsTooltip
                                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                                    formatter={(value: number, name: string) => [name === "vendas" ? `R$ ${value.toFixed(2)}` : `${value}`, name === "vendas" ? "Vendas" : "Pedidos"]}
                                  />
                                  <Area type="monotone" dataKey="vendas" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Hourly Distribution */}
                        {hourlyChart.length > 0 && (
                          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
                            <p className="text-xs font-bold text-foreground mb-4">🕐 Distribuição por Horário</p>
                            <div className="h-36">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyChart}>
                                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={1} />
                                  <YAxis hide />
                                  <RechartsTooltip
                                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                                    formatter={(value: number) => [`${value} pedidos`, ""]}
                                  />
                                  <Bar dataKey="pedidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Weekday Performance */}
                        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
                          <p className="text-xs font-bold text-foreground mb-4">📊 Desempenho por Dia da Semana</p>
                          <div className="h-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={weekdayChart}>
                                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <RechartsTooltip
                                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }}
                                  formatter={(value: number, name: string) => [name === "vendas" ? `R$ ${value.toFixed(2)}` : `${value}`, name === "vendas" ? "Vendas" : "Pedidos"]}
                                />
                                <Bar dataKey="vendas" fill="#a855f7" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Payment Distribution */}
                        {paymentPie.length > 0 && (
                          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
                            <p className="text-xs font-bold text-foreground mb-4">💳 Métodos de Pagamento</p>
                            <div className="flex items-center gap-4">
                              <div className="w-28 h-28 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={paymentPie} innerRadius={30} outerRadius={50} paddingAngle={4} dataKey="value" strokeWidth={0}>
                                      {paymentPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="flex-1 space-y-3">
                                {paymentPie.map((p, i) => (
                                  <div key={p.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                      <span className="text-xs text-muted-foreground">{p.name}</span>
                                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{p.value}x</span>
                                    </div>
                                    <span className="text-xs font-bold text-foreground">{formatCurrency(p.total)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Top Products */}
                        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
                          <p className="text-xs font-bold text-foreground mb-4">🏆 Produtos Mais Vendidos</p>
                          <div className="space-y-2.5">
                            {sortedProducts.map(([name, data], i) => {
                              const maxRev = sortedProducts[0]?.[1]?.revenue || 1;
                              return (
                                <div key={name} className="flex items-center gap-3">
                                  <span className={`text-xs font-black w-6 text-center ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`}
                                  </span>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="font-bold text-foreground">{name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{data.qty}x</span>
                                        <span className="font-bold text-emerald-500">{formatCurrency(data.revenue)}</span>
                                      </div>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all" style={{ width: `${(data.revenue / maxRev) * 100}%` }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {sortedProducts.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sem dados de produtos neste período</p>}
                          </div>
                        </div>

                        {/* Export */}
                        <button onClick={exportCSV}
                          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                          <Download className="h-4 w-4" /> Exportar Relatório CSV
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── BOTTOM NAVIGATION (mobile only) ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden pb-safe">
          <div className="flex items-center justify-around h-14">
            {bottomNavTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = dashboardTab === tab.key;
              return (
                <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors relative ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}>
                  {isActive && <div className="absolute inset-0 bg-primary/10 rounded-xl" />}
                  <div className="relative">
                    <Icon className="h-5 w-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
                    {tab.key === "orders" && pendingCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-amber-400 text-amber-900 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{pendingCount}</span>
                    )}
                  </div>
                  <span className={`text-[10px] relative z-10 ${isActive ? "font-bold" : "font-medium"}`}>{tab.label}</span>
                </button>
              );
            })}
            {/* More button */}
            <button onClick={() => setShowMoreSheet(!showMoreSheet)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors relative ${
                isBottomNavMore || showMoreSheet ? "text-primary" : "text-muted-foreground"
              }`}>
              {(isBottomNavMore || showMoreSheet) && <div className="absolute inset-0 bg-primary/10 rounded-xl" />}
              <Menu className="h-5 w-5 relative z-10" strokeWidth={isBottomNavMore || showMoreSheet ? 2.5 : 2} />
              <span className={`text-[10px] relative z-10 ${isBottomNavMore || showMoreSheet ? "font-bold" : "font-medium"}`}>Mais</span>
            </button>
          </div>
        </nav>
      </main>
      <ProductTour steps={lojistaTourSteps} tourKey="lojista" />
    </div>
  );
};

export default AdminDashboard;
