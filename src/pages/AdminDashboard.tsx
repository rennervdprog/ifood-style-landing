import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import SimulationBanner from "@/components/SimulationBanner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Clock, ChefHat, Truck, CheckCircle2,
  MapPin, Package, Settings, Banknote, CreditCard,
  UtensilsCrossed, ListOrdered, Plus, Printer, Bike,
  Volume2, VolumeX, Bell, Store, MessageCircle, Copy, Coins,
  ChevronDown, ChevronUp, DollarSign, XCircle, Loader2, Search,
  Menu, X, LayoutDashboard, CircleDot, TrendingUp, BarChart3,
  Users, Timer, Star, ShoppingBag, ArrowUpRight, ArrowDownRight,
  Filter, UserCheck, UserX, MapPinned, Repeat, Heart, AlertTriangle, LogOut
} from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import WhatsAppButton from "@/components/WhatsAppButton";
import MenuBuilder from "@/components/MenuBuilder";
import StoreHoursManager from "@/components/StoreHoursManager";
import AddonManager from "@/components/AddonManager";
import StoreSettings from "@/components/StoreSettings";
import StoreFinancePanel from "@/components/StoreFinancePanel";
import { printThermalReceipt } from "@/lib/thermalPrint";
import { requestNotificationPermission, notifyNewOrder, pushNotifyDeliveryAvailable } from "@/lib/notifications";
import { sendPushNotification } from "@/lib/firebase";
import { addMoney, averageMoney, formatCurrency, sumMoney } from "@/lib/utils";
import ProductTour, { lojistaTourSteps } from "@/components/ProductTour";

type OrderStatus = "pendente" | "preparando" | "pronto_para_entrega" | "saiu_entrega" | "em_transito" | "entregue" | "finalizado";
type DashboardTab = "dashboard" | "orders" | "menu" | "addons" | "hours" | "settings" | "finance" | "clients" | "reports";

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

const sidebarItems: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { key: "orders", label: "Pedidos", icon: ListOrdered },
  { key: "clients", label: "Clientes", icon: Users },
  { key: "menu", label: "Cardápio", icon: UtensilsCrossed },
  { key: "addons", label: "Adicionais", icon: Plus },
  { key: "hours", label: "Horários", icon: Clock },
  { key: "finance", label: "Finanças", icon: Coins },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "settings", label: "Configurações", icon: Settings },
];

// ── At-a-Glance Card Component ──
const GlanceCard = ({ icon: Icon, label, value, subValue, color = "text-primary", trend }: {
  icon: React.ElementType; label: string; value: string | number; subValue?: string; color?: string; trend?: "up" | "down" | null;
}) => (
  <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-xl ${color.replace("text-", "bg-").replace("500", "500/10")} flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-xs font-bold ${trend === "up" ? "text-emerald-500" : "text-red-500"}`}>
          {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        </div>
      )}
    </div>
    <div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {subValue && <p className="text-[10px] text-muted-foreground/70">{subValue}</p>}
    </div>
  </div>
);

// ── Client Filter type ──
type ClientFilter = "all" | "loyal" | "inactive" | "location";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [realtimeDriversConnected, setRealtimeDriversConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderStatus>("pendente");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("dashboard");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrint") === "true");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pushLog, setPushLog] = useState<string[]>([]);
  const [soundMuted, setSoundMuted] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [settlementSearch, setSettlementSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<ClientFilter>("all");
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  const prevPendingCountRef = useRef(0);

  const toggleAddress = (orderId: string) => {
    setExpandedAddresses(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  // ── DATA QUERIES ──
  const { data: store } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("owner_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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

  // All orders including cancelled for client analytics
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

      // Find favorite product
      const productCount = new Map<string, number>();
      data.orders.forEach((o: any) => {
        o.order_items?.forEach((item: any) => {
          const name = item.products?.name || "Item";
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
    const debugLog: string[] = [];
    debugLog.push(`[${new Date().toLocaleTimeString()}] updateOrderStatus: ${orderId.slice(0,8)} → ${newStatus}`);
    try {
      const { error, data, count, status, statusText } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)
        .select();
      debugLog.push(`Response: status=${status} ${statusText}, rows=${data?.length ?? 0}`);
      if (error) {
        debugLog.push(`❌ Error: ${error.message} | code: ${error.code} | details: ${error.details}`);
        toast.error(`Erro ao atualizar pedido: ${error.message}`, { duration: 10000, description: debugLog.join("\n") });
        console.error("[updateOrderStatus] DEBUG:", debugLog.join(" | "));
        return;
      }
      if (!data || data.length === 0) {
        debugLog.push("⚠️ Nenhuma row atualizada (RLS bloqueou ou pedido não encontrado)");
        toast.error("Pedido não atualizado — verifique permissões", { duration: 10000, description: debugLog.join("\n") });
        console.error("[updateOrderStatus] DEBUG:", debugLog.join(" | "));
        return;
      }
      debugLog.push(`✅ Atualizado com sucesso. Novo status: ${(data[0] as any)?.status}`);
      console.log("[updateOrderStatus] DEBUG:", debugLog.join(" | "));
      toast.success("Pedido atualizado!");
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      const order = orders?.find((o: any) => o.id === orderId);
      if (newStatus === "preparando" && autoPrint && order) handlePrint(order);
      if (newStatus === "preparando" && order) {
        const clientPhone = getClientWhatsApp(order.client_id);
        if (clientPhone) {
          const clientName = getClientName(order.client_id);
          const items = order.order_items?.map((i: any) => `${i.quantity}x ${i.products?.name}`).join("\n") || "";
          const msg = `✅ *FoodIta* informa: Seu pedido no *${store?.name}* foi aceito! 🍔\n\n${items}\n\n💰 Total: R$ ${Number(order.total_price).toFixed(2)}\nPedido: #${order.id.slice(0, 8).toUpperCase()}`;
          setTimeout(() => openWhatsApp(clientPhone, msg), 600);
        }
      }
      if (newStatus === "pronto_para_entrega" && onlineDrivers && onlineDrivers.length > 0) {
        const driverUserIds = onlineDrivers.map((d: any) => d.user_id);
        pushNotifyDeliveryAvailable(driverUserIds, orderId).catch(console.error);
      }
    } catch (e: any) {
      debugLog.push(`💥 Exception: ${e?.message || e}`);
      toast.error(`Erro inesperado: ${e?.message}`, { duration: 10000, description: debugLog.join("\n") });
      console.error("[updateOrderStatus] EXCEPTION:", debugLog.join(" | "), e);
    }
  };


  const handleCancelOrder = async (order: any) => {
    try {
      const isPix = order.payment_method === "pix";
      const { error } = await supabase.from("orders").update({ status: "cancelado" as any }).eq("id", order.id);
      if (error) { toast.error("Erro ao cancelar pedido."); return; }
      
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      setCancelConfirm(null);

      const clientPhone = getClientWhatsApp(order.client_id);
      if (clientPhone) {
        const msg = isPix
          ? `❌ *FoodIta* informa: Seu pedido #${order.id.slice(0, 8).toUpperCase()} foi cancelado.\n\n💰 O reembolso de R$ ${Number(order.total_price).toFixed(2)} via PIX será processado em breve.\n\nDesculpe o transtorno! 🙏`
          : `❌ *FoodIta* informa: Seu pedido #${order.id.slice(0, 8).toUpperCase()} foi cancelado.\n\nDesculpe o transtorno! 🙏`;
        setTimeout(() => openWhatsApp(clientPhone, msg), 600);
      }

      if (isPix) {
        toast.success("Pedido cancelado! Reembolso PIX pendente.", { duration: 8000, description: `R$ ${Number(order.total_price).toFixed(2)} — envie o PIX de volta ao cliente.` });
      } else {
        toast.success("Pedido cancelado e cliente notificado.");
      }

      sendPushNotification([order.client_id], "❌ Pedido Cancelado", `Seu pedido #${order.id.slice(0, 8).toUpperCase()} foi cancelado.${isPix ? " O reembolso será processado." : ""}`, { link: "/pedidos" }).catch(console.error);
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
  const todayOrders = orders?.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString() && !["cancelado", "aguardando_pagamento"].includes(o.status)) || [];
  const todayTotal = sumMoney(todayOrders.map((order) => order.total_price));
  const todayCount = todayOrders.length;

  // Average delivery time (from pendente to finalizado/entregue, today)
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

  const getMainAction = (status: OrderStatus): { label: string; next: OrderStatus; emoji: string } | null => {
    switch (status) {
      case "pendente": return { label: "ACEITAR PEDIDO", next: "preparando", emoji: "✓" };
      case "preparando": return { label: "MARCAR COMO PRONTO", next: "pronto_para_entrega" as OrderStatus, emoji: "🔔" };
      default: return null;
    }
  };

  const handleTabChange = (tab: DashboardTab) => { setDashboardTab(tab); setSidebarOpen(false); };

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-background flex">
      <SimulationBanner />

      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── SIDEBAR ── */}
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
        <div className="p-3 space-y-2 border-b border-border" data-tour="loja-stats">
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl p-2.5 text-center border ${pendingCount > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/50 border-border"}`}>
              <p className={`text-lg font-black ${pendingCount > 0 ? "text-amber-500" : "text-foreground"}`}>{pendingCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Novos</p>
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-2.5 text-center">
              <p className="text-lg font-black text-foreground">{preparingCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Preparando</p>
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-2.5 flex items-center justify-between">
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
          {sidebarItems.map(item => {
            const isActive = dashboardTab === item.key;
            const Icon = item.icon;
            return (
              <button key={item.key} onClick={() => handleTabChange(item.key)}
                data-tour={item.key === "orders" ? "loja-orders" : item.key === "menu" ? "loja-menu" : item.key === "clients" ? "loja-clients" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
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
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1">Entregadores</span>
            <span className={`flex items-center gap-1 text-xs font-bold ${(onlineDrivers?.length || 0) > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
              <span className={`w-2 h-2 rounded-full ${(onlineDrivers?.length || 0) > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted"}`} />
              {onlineDrivers?.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {soundEnabled && (
              <button onClick={() => setSoundMuted(prev => { if (!prev) toast("🔇 Silenciado"); else toast.success("🔊 Ativo!"); return !prev; })}
                className={`p-2 rounded-xl border border-border ${soundMuted ? "text-destructive" : "text-emerald-500"}`}>
                {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
            <button onClick={toggleAutoPrint}
              className={`p-2 rounded-xl border border-border ${autoPrint ? "text-primary bg-primary/5" : "text-muted-foreground"}`}>
              <Printer className="h-4 w-4" />
            </button>
            <button onClick={toggleStoreOpen}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${store?.is_open ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}
              data-tour="loja-status">
              {store?.is_open ? "✓ Aberto" : "✕ Pausado"}
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-accent">
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h2 className="font-bold text-foreground text-lg">{sidebarItems.find(i => i.key === dashboardTab)?.label || "Pedidos"}</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {dashboardTab === "dashboard" && "Resumo do dia em tempo real"}
                {dashboardTab === "orders" && `${orders?.length || 0} pedidos ativos`}
                {dashboardTab === "clients" && `${clientAnalytics.length} clientes registrados`}
                {dashboardTab === "menu" && "Gerencie seu cardápio"}
                {dashboardTab === "addons" && "Grupos de adicionais"}
                {dashboardTab === "hours" && "Horários de funcionamento"}
                {dashboardTab === "finance" && "Resumo financeiro"}
                {dashboardTab === "settings" && "Configurações da loja"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showSoundPrompt && !soundEnabled && (
              <button onClick={activateSound}
                className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 text-amber-500 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                <Bell className="h-3.5 w-3.5" /> Ativar alertas
              </button>
            )}
            {pendingCount > 0 && dashboardTab !== "orders" && (
              <button onClick={() => { setDashboardTab("orders"); setActiveTab("pendente"); }}
                className="flex items-center gap-1.5 bg-amber-400 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold animate-bounce">
                <Clock className="h-3.5 w-3.5" /> {pendingCount} novo{pendingCount > 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={async () => { await signOut(); toast.success("Você saiu da conta."); navigate("/portal-parceiro"); }}
              className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Sair da conta"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ══════ DASHBOARD TAB ══════ */}
          {dashboardTab === "dashboard" && store && (
            <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
              {/* At-a-Glance Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <GlanceCard
                  icon={ShoppingBag}
                  label="Pedidos Pendentes"
                  value={pendingCount}
                  subValue={preparingCount > 0 ? `+ ${preparingCount} preparando` : undefined}
                  color={pendingCount > 0 ? "text-amber-500" : "text-muted-foreground"}
                />
                <GlanceCard
                  icon={DollarSign}
                  label="Faturamento Hoje"
                  value={`R$ ${todayTotal.toFixed(2)}`}
                  subValue={`${todayCount} pedidos`}
                  color="text-emerald-500"
                  trend={todayTotal > 0 ? "up" : null}
                />
                <GlanceCard
                  icon={Bike}
                  label="Motoboys Online"
                  value={onlineDrivers?.length || 0}
                  subValue={realtimeDriversConnected ? "Rastreamento ativo" : "Conectando..."}
                  color={(onlineDrivers?.length || 0) > 0 ? "text-blue-500" : "text-muted-foreground"}
                />
                <GlanceCard
                  icon={Timer}
                  label="Tempo Médio"
                  value={avgDeliveryTime ? `${avgDeliveryTime} min` : "—"}
                  subValue="Pedido → Entrega"
                  color="text-purple-500"
                />
              </div>

              {/* Priority Queue - New orders with pulse */}
              {pendingCount > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <h3 className="font-bold text-foreground text-sm">Pedidos Aguardando Atenção</h3>
                    <span className="text-xs text-muted-foreground">({pendingCount})</span>
                  </div>
                  <div className="space-y-2">
                    {orders?.filter(o => o.status === "pendente").slice(0, 5).map((order: any) => (
                      <div key={order.id} className="bg-card border-2 border-amber-500/40 rounded-2xl p-4 animate-pulse-border hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-black text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors.pendente.bg} ${statusColors.pendente.text}`}>
                              {statusColors.pendente.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-emerald-500">R$ {Number(order.total_price).toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">{paymentLabels[order.payment_method] || order.payment_method}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <span>{getClientName(order.client_id)}</span>
                          <span>•</span>
                          <span>{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.neighborhood}</span>
                        </div>
                        <div className="bg-muted/50 rounded-xl px-3 py-2 mb-3 space-y-1">
                          {order.order_items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-foreground"><span className="text-primary font-bold">{item.quantity}x</span> {item.products?.name || "Item"}</span>
                              <span className="text-muted-foreground text-xs">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateOrderStatus(order.id, "preparando")}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm active:scale-[0.98] transition-transform">
                            ✓ ACEITAR PEDIDO
                          </button>
                          <button onClick={() => handleCancelOrder(order)}
                            className="px-3 py-3 rounded-xl border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/5">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders in progress summary */}
              {(preparingCount > 0 || readyCount > 0) && (
                <div className="space-y-3">
                  <h3 className="font-bold text-foreground text-sm">Em Andamento</h3>
                  <div className="grid gap-2">
                    {orders?.filter(o => ["preparando", "pronto_para_entrega", "em_transito", "saiu_entrega"].includes(o.status)).slice(0, 6).map((order: any) => {
                      const sc = statusColors[order.status] || statusColors.pendente;
                      return (
                        <div key={order.id} className={`bg-card border ${sc.border} rounded-xl p-3 flex items-center justify-between`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
                            <span className="text-sm font-bold text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-xs text-muted-foreground">{getClientName(order.client_id)}</span>
                          </div>
                          <span className="text-sm font-bold text-foreground">R$ {Number(order.total_price).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => { setDashboardTab("orders"); }}
                    className="text-xs text-primary font-bold hover:underline">
                    Ver todos os pedidos →
                  </button>
                </div>
              )}

              {/* Top clients preview */}
              {clientAnalytics.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground text-sm">Top Clientes</h3>
                    <button onClick={() => setDashboardTab("clients")} className="text-xs text-primary font-bold hover:underline">Ver todos →</button>
                  </div>
                  <div className="grid gap-2">
                    {clientAnalytics.slice(0, 5).map(client => (
                      <div key={client.clientId} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{client.name}</p>
                            <p className="text-[10px] text-muted-foreground">{client.totalOrders} pedidos • Ticket: R$ {client.ticketMedio.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-500">R$ {client.totalSpent.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{client.favProduct}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════ CLIENTS TAB ══════ */}
          {dashboardTab === "clients" && store && (
            <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "all" as ClientFilter, label: "Todos", icon: Users },
                  { key: "loyal" as ClientFilter, label: "Mais Fiéis (3+)", icon: Heart },
                  { key: "inactive" as ClientFilter, label: "Inativos 15+ dias", icon: UserX },
                  { key: "location" as ClientFilter, label: "Por Localização", icon: MapPinned },
                ]).map(f => (
                  <button key={f.key} onClick={() => setClientFilter(f.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
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
                    <span className="font-bold">{filteredClients.length} clientes</span> não pedem há 15+ dias. Envie uma promoção!
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
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{client.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{client.totalOrders} pedidos</span>
                            <span>•</span>
                            <span>{client.neighborhood || "—"}</span>
                            {client.daysSinceLastOrder > 15 && (
                              <span className="text-amber-500 font-bold">• {client.daysSinceLastOrder}d inativo</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">R$ {client.ticketMedio.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">ticket médio</p>
                        </div>
                        {expandedClient === client.clientId ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expandedClient === client.clientId && (
                      <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-foreground">{formatCurrency(client.totalSpent)}</p>
                            <p className="text-[10px] text-muted-foreground">Total Gasto</p>
                          </div>
                          <div className="bg-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-foreground">{formatCurrency(client.ticketMedio)}</p>
                            <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
                          </div>
                          <div className="bg-muted/50 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                              <p className="text-sm font-black text-foreground">{client.favProduct}</p>
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
                              label="Enviar Promoção" size="sm" />
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
                <div className="flex overflow-x-auto gap-1 px-4 py-2 no-scrollbar">
                  {orderTabs.map((tab) => {
                    const count = orders?.filter(o => o.status === tab.status).length || 0;
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.status;
                    return (
                      <button key={tab.status} onClick={() => setActiveTab(tab.status)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                        <Icon className="h-3.5 w-3.5" />
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
              <div className="p-4 pb-24 space-y-3 max-w-3xl mx-auto">
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
                    
                    // Wait time calculation
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
                        <div className={`px-4 py-1.5 ${sc.bg} flex items-center justify-between`}>
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

                        {/* Critical info bar: Total + Neighborhood + Payment */}
                        <div className="px-4 pt-3 pb-2 flex items-start justify-between">
                          <div>
                            <p className="text-lg font-black text-foreground tracking-wide">#{order.id.slice(0, 8).toUpperCase()}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">{getClientName(order.client_id)}</span>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                <MapPin className="h-3 w-3" />{order.neighborhood}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="text-2xl" title={paymentLabels[order.payment_method]}>{paymentIcons[order.payment_method] || "💳"}</span>
                            <div>
                              <p className="text-xl font-black text-emerald-500">R$ {Number(order.total_price).toFixed(2)}</p>
                              {order.payment_method === "pix" && (
                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">PIX PAGO</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Items */}
                        <div className="mx-4 mb-2 bg-muted/50 rounded-xl px-3 py-2 space-y-1">
                          {order.order_items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-foreground"><span className="text-primary font-bold">{item.quantity}x</span> {item.products?.name || "Item"}</span>
                              <span className="text-muted-foreground text-xs">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          {order.order_items?.map((item: any) => {
                            const rawAddons = item.addons;
                            const addons: any[] = Array.isArray(rawAddons) ? rawAddons : (typeof rawAddons === 'string' ? (() => { try { return JSON.parse(rawAddons); } catch { return []; } })() : []);
                            if (!addons || addons.length === 0) return null;
                            return (
                              <div key={`addons-${item.id}`} className="pl-6 text-[11px] text-muted-foreground">
                                {addons.map((a: any, idx: number) => (
                                  <span key={idx}>+ {a.name}{a.price > 0 ? ` (R$${Number(a.price).toFixed(2)})` : ""}{idx < addons.length - 1 ? ", " : ""}</span>
                                ))}
                              </div>
                            );
                          })}
                          {order.order_items?.map((item: any) => {
                            if (!item.observations) return null;
                            return <div key={`obs-${item.id}`} className="pl-6 text-[11px] text-muted-foreground italic">📝 {item.observations}</div>;
                          })}
                          {order.payment_method === "dinheiro" && (order as any).needs_change && Number((order as any).change_for) > 0 && (
                            <div className="flex items-center gap-1 pt-1 border-t border-border">
                              <Banknote className="h-3 w-3 text-amber-500" />
                              <span className="text-[10px] text-amber-500 font-bold">Troco: R$ {(Number((order as any).change_for) - Number(order.total_price)).toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {/* Address */}
                        <div className="mx-4 mb-2">
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

                        {/* Driver status */}
                        {order.status === "pronto_para_entrega" && !order.driver_id && (
                          <div className="mx-4 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5">
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
                        {order.driver_id && order.status === "pronto_para_entrega" && (
                          <div className="mx-4 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <Bike className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">🏍️ {getDriverName(order.driver_id)} a caminho da loja</span>
                          </div>
                        )}
                        {order.driver_id && (order.status === "em_transito" || order.status === "saiu_entrega") && (
                          <div className="mx-4 mb-2 flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                            <Truck className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">🛵 {getDriverName(order.driver_id)} entregando</span>
                          </div>
                        )}

                        {/* Collection Code */}
                        {(order.status === "pronto_para_entrega" || order.status === "saiu_entrega" || order.status === "em_transito") && (order as any).collection_code && (
                          <div className="mx-4 mb-2 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-center">
                            <p className="text-[10px] text-purple-500 font-bold mb-1">🔐 Código de Coleta</p>
                            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-[0.3em]">{(order as any).collection_code}</p>
                          </div>
                        )}

                        {/* Settlement Code */}
                        {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).settlement_code && ["entregue", "finalizado"].includes(order.status) && !(order as any).return_to_store_confirmed && (
                          <div className="mx-4 mb-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
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
                        {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).return_to_store_confirmed && ["entregue", "finalizado"].includes(order.status) && (
                          <div className="mx-4 mb-2 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-500 font-bold">Acerto realizado ✅</span>
                          </div>
                        )}

                        {/* WhatsApp actions */}
                        {getClientWhatsApp(order.client_id) && (
                          <div className="mx-4 mb-2 flex flex-wrap gap-1.5">
                            {order.status === "pendente" && (
                              <button onClick={() => {
                                const msg = `Olá ${getClientName(order.client_id)}! *FoodIta*: Pedido aceito e em produção! 🍔\nPedido: #${order.id.slice(0, 8).toUpperCase()}\nTotal: R$ ${Number(order.total_price).toFixed(2)}`;
                                openWhatsApp(getClientWhatsApp(order.client_id), msg);
                              }} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg">
                                <MessageCircle className="h-3 w-3" /> Avisar
                              </button>
                            )}
                            {(order.status === "em_transito" || order.status === "saiu_entrega") && (
                              <button onClick={() => {
                                const msg = `Olá ${getClientName(order.client_id)}! Motoboy *FoodIta* saiu para entrega! 🚀\nEndereço: ${order.address_details}`;
                                openWhatsApp(getClientWhatsApp(order.client_id), msg);
                              }} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg">
                                <MessageCircle className="h-3 w-3" /> Saiu
                              </button>
                            )}
                            <WhatsAppButton number={getClientWhatsApp(order.client_id)}
                              message={`Olá ${getClientName(order.client_id)}! Aqui é do ${store?.name}. Pedido #${order.id.slice(0, 8).toUpperCase()}...`}
                              label="Chat" size="sm" />
                          </div>
                        )}

                        {/* Main action - One-click buttons directly visible */}
                        <div className="px-4 pb-4 pt-1 flex items-center gap-2">
                          <button onClick={() => handlePrint(order)}
                            title="Imprimir"
                            className="p-2.5 bg-muted rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Printer className="h-4 w-4" />
                          </button>
                          <div className="flex-1">
                            {action && order.status === "pendente" ? (
                              <div className="space-y-1.5">
                                {order.payment_method === "pix" && (
                                  <div className="text-center">
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">💰 Pagamento Garantido</span>
                                  </div>
                                )}
                                <button onClick={() => updateOrderStatus(order.id, "preparando")}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-sm active:scale-[0.98] transition-transform">
                                  ✓ ACEITAR PEDIDO
                                </button>
                                <button onClick={() => handleCancelOrder(order)}
                                  className="w-full text-center text-xs text-destructive hover:text-destructive/80 py-1">
                                  Recusar pedido
                                </button>
                              </div>
                            ) : action ? (
                              <div className="space-y-1.5">
                                <button onClick={() => updateOrderStatus(order.id, action.next)}
                                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform">
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
                  /* ── Empty State with friendly illustration ── */
                  <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="w-20 h-20 rounded-3xl bg-muted/80 flex items-center justify-center mb-5">
                      {activeTab === "pendente" && <Clock className="h-10 w-10 text-muted-foreground/60" />}
                      {activeTab === "preparando" && <ChefHat className="h-10 w-10 text-muted-foreground/60" />}
                      {activeTab === "pronto_para_entrega" && <Package className="h-10 w-10 text-muted-foreground/60" />}
                      {(activeTab === "saiu_entrega" || activeTab === "em_transito") && <Truck className="h-10 w-10 text-muted-foreground/60" />}
                      {(activeTab === "entregue" || activeTab === "finalizado") && <CheckCircle2 className="h-10 w-10 text-muted-foreground/60" />}
                    </div>
                    <p className="text-base font-bold text-foreground mb-1">
                      {activeTab === "pendente" && "Tudo em ordem por aqui! 🎉"}
                      {activeTab === "preparando" && "Nenhum pedido em preparo"}
                      {activeTab === "pronto_para_entrega" && "Nenhum pedido pronto"}
                      {(activeTab === "saiu_entrega" || activeTab === "em_transito") && "Nenhuma entrega em andamento"}
                      {(activeTab === "entregue" || activeTab === "finalizado") && "Nenhum pedido finalizado"}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {activeTab === "pendente" && "Nenhum pedido pendente. Novos pedidos aparecerão automaticamente."}
                      {activeTab === "preparando" && "Aceite pedidos pendentes para vê-los aqui."}
                      {activeTab === "pronto_para_entrega" && "Marque pedidos como prontos para aparecer aqui."}
                      {(activeTab === "saiu_entrega" || activeTab === "em_transito") && "Entregas em andamento aparecerão aqui."}
                      {(activeTab === "entregue" || activeTab === "finalizado") && "Pedidos concluídos do dia aparecerão aqui."}
                    </p>
                  </div>
                )}
              </div>

              {/* Floating pending badge */}
              {pendingCount > 0 && activeTab !== "pendente" && (
                <button onClick={() => setActiveTab("pendente")}
                  className="fixed bottom-6 right-6 bg-amber-400 text-amber-900 font-bold px-4 py-2.5 rounded-xl shadow-lg animate-bounce flex items-center gap-2 text-sm z-30">
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
                    storeDeliveryMode={(store as any).delivery_mode || "platform"} />

                  {/* Test Push Notification */}
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Bell className="w-4 h-4" /> Teste de Notificação Push
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Envie uma notificação de teste para todos os motoboys online ou para você mesmo.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
                        onClick={async () => {
                          setPushLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Enviando para motoboys...`]);
                          try {
                            if (!onlineDrivers || onlineDrivers.length === 0) {
                              setPushLog(prev => [...prev, `❌ Nenhum motoboy online.`]);
                              toast.error("Nenhum motoboy online no momento.");
                              return;
                            }
                            const driverIds = onlineDrivers.map((d: any) => d.user_id);
                            setPushLog(prev => [...prev, `📤 IDs: ${driverIds.join(", ")}`]);
                            const result = await sendPushNotification(
                              driverIds,
                              "🧪 Teste de Notificação",
                              "Esta é uma notificação de teste do ItaFood!",
                              { link: "/entregas" }
                            );
                            setPushLog(prev => [...prev, `✅ Resposta: ${JSON.stringify(result)}`]);
                            if (result?.total_sent > 0) {
                              toast.success(`Enviado! FCM: ${result.fcm?.sent || 0}, OneSignal: ${result.onesignal?.sent || 0}`);
                            } else {
                              toast.warning("Nenhum dispositivo recebeu.");
                            }
                          } catch (err: any) {
                            setPushLog(prev => [...prev, `❌ Erro: ${err?.message || JSON.stringify(err)}`]);
                            toast.error("Erro ao enviar notificação de teste.");
                          }
                        }}
                      >
                        <Bike className="w-4 h-4 inline mr-1" /> Enviar para Motoboys ({onlineDrivers?.length || 0})
                      </button>
                      <button
                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium"
                        onClick={async () => {
                          setPushLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Enviando para mim...`]);
                          try {
                            if (!user) return;
                            setPushLog(prev => [...prev, `📤 ID: ${user.id}`]);
                            const result = await sendPushNotification(
                              [user.id],
                              "🧪 Teste de Notificação",
                              "Se você recebeu isso, as notificações estão funcionando!",
                              { link: "/admin" }
                            );
                            setPushLog(prev => [...prev, `✅ Resposta: ${JSON.stringify(result)}`]);
                            if (result?.total_sent > 0) {
                              toast.success(`Enviado! FCM: ${result.fcm?.sent || 0}, OneSignal: ${result.onesignal?.sent || 0}`);
                            } else {
                              toast.warning("Nenhum dispositivo recebeu.");
                            }
                          } catch (err: any) {
                            setPushLog(prev => [...prev, `❌ Erro: ${err?.message || JSON.stringify(err)}`]);
                            toast.error("Erro ao enviar.");
                          }
                        }}
                      >
                        <Bell className="w-4 h-4 inline mr-1" /> Enviar para Mim
                      </button>
                      <button
                        className="px-3 py-2 bg-muted text-muted-foreground rounded-xl text-xs"
                        onClick={() => setPushLog([])}
                      >
                        Limpar Log
                      </button>
                    </div>
                    {pushLog.length > 0 && (
                      <div className="bg-muted/50 border border-border rounded-xl p-3 max-h-48 overflow-y-auto">
                        <p className="text-xs font-mono text-muted-foreground mb-1">📋 Log:</p>
                        {pushLog.map((line, i) => (
                          <p key={i} className="text-xs font-mono text-foreground break-all">{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {dashboardTab === "finance" && <StoreFinancePanel storeId={store.id} storeName={store.name} />}
              {dashboardTab === "reports" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-foreground">Relatórios de Vendas</h3>
                  {(() => {
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (6 - i));
                      return d.toISOString().split("T")[0];
                    });
                    const dailyData = last7Days.map(date => {
                      const dayOrders = (allOrders || []).filter((o: any) => 
                        new Date(o.created_at).toISOString().split("T")[0] === date && !["cancelado", "aguardando_pagamento"].includes(o.status)
                      );
                      return {
                        day: new Date(date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
                        vendas: sumMoney(dayOrders.map((order: any) => order.total_price)),
                        pedidos: dayOrders.length,
                      };
                    });
                    const topProducts = new Map<string, number>();
                    (allOrders || []).forEach((o: any) => {
                      if (["cancelado", "aguardando_pagamento"].includes(o.status)) return;
                      o.order_items?.forEach((item: any) => {
                        const name = item.products?.name || "Item";
                        topProducts.set(name, (topProducts.get(name) || 0) + item.quantity);
                      });
                    });
                    const sortedProducts = Array.from(topProducts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    const totalRevenue = sumMoney(dailyData.map((day) => day.vendas));
                    const totalOrders = dailyData.reduce((s, d) => s + d.pedidos, 0);
                    const avgTicket = averageMoney(totalRevenue, totalOrders);

                    const exportCSV = () => {
                      const lines = ["Data,Vendas,Pedidos", ...dailyData.map(d => `${d.day},${d.vendas.toFixed(2)},${d.pedidos}`)];
                      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `relatorio-vendas-${store?.name || "loja"}.csv`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success("CSV exportado!");
                    };

                    return (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-card border border-border rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-emerald-500">R$ {totalRevenue.toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">Últimos 7 dias</p>
                          </div>
                          <div className="bg-card border border-border rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-foreground">{totalOrders}</p>
                            <p className="text-[10px] text-muted-foreground">Pedidos</p>
                          </div>
                          <div className="bg-card border border-border rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-primary">R$ {avgTicket.toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
                          </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-4">
                          <h4 className="text-sm font-bold text-foreground mb-3">Vendas por Dia</h4>
                          <div className="flex items-end gap-2 h-32">
                            {dailyData.map((d, i) => {
                              const max = Math.max(...dailyData.map(x => x.vendas), 1);
                              const height = (d.vendas / max) * 100;
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-[9px] text-muted-foreground font-bold">R${d.vendas.toFixed(2)}</span>
                                  <div className="w-full rounded-t-lg bg-primary/80 transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                                  <span className="text-[9px] text-muted-foreground">{d.day}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-4">
                          <h4 className="text-sm font-bold text-foreground mb-3">Produtos Mais Vendidos</h4>
                          <div className="space-y-2">
                            {sortedProducts.map(([name, qty], i) => {
                              const max = sortedProducts[0]?.[1] || 1;
                              return (
                                <div key={name} className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="font-bold text-foreground">{name}</span>
                                      <span className="text-muted-foreground">{qty}x</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full" style={{ width: `${(qty / max) * 100}%` }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {sortedProducts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados ainda</p>}
                          </div>
                        </div>

                        <button onClick={exportCSV} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm">
                          📊 Exportar CSV
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <ProductTour steps={lojistaTourSteps} tourKey="lojista" />
    </div>
  );
};

export default AdminDashboard;
