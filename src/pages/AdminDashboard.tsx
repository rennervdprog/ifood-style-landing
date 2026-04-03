import { useEffect, useState, useRef, useCallback } from "react";
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
  ChevronDown, ChevronUp, DollarSign, XCircle, Loader2
} from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import WhatsAppButton from "@/components/WhatsAppButton";
import MenuBuilder from "@/components/MenuBuilder";
import StoreHoursManager from "@/components/StoreHoursManager";
import AddonManager from "@/components/AddonManager";
import StoreSettings from "@/components/StoreSettings";
import StoreFinancePanel from "@/components/StoreFinancePanel";
import { printThermalReceipt } from "@/lib/thermalPrint";
import { requestNotificationPermission, notifyNewOrder } from "@/lib/notifications";

type OrderStatus = "pendente" | "preparando" | "pronto_para_entrega" | "saiu_entrega" | "em_transito" | "entregue" | "finalizado";
type DashboardTab = "orders" | "menu" | "addons" | "hours" | "settings" | "finance";

const ALERT_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
const CASH_REGISTER_SOUND_URL = "https://actions.google.com/sounds/v1/office/cash_register.ogg";

const orderTabs: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pendente", label: "Novos", icon: Clock },
  { status: "preparando", label: "Preparando", icon: ChefHat },
  { status: "pronto_para_entrega", label: "Pronto", icon: Package },
  { status: "saiu_entrega", label: "Saiu", icon: Truck },
  { status: "em_transito", label: "Trânsito", icon: Truck },
  { status: "entregue", label: "Entregue", icon: CheckCircle2 },
  { status: "finalizado", label: "Finalizados", icon: CheckCircle2 },
];

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const paymentIcons: Record<string, string> = {
  pix: "⚡",
  cartao: "💳",
  dinheiro: "💵",
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [realtimeDriversConnected, setRealtimeDriversConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderStatus>("pendente");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("orders");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrint") === "true");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [settlementSearch, setSettlementSearch] = useState("");

  const prevPendingCountRef = useRef(0);

  const toggleAddress = (orderId: string) => {
    setExpandedAddresses(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // Fetch store for this owner
  const { data: store } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch orders for this store
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

  // Fetch online drivers count
  const { data: onlineDrivers } = useQuery({
    queryKey: ["online-drivers-count"],
    queryFn: async () => {
      const { data: allOnline, error } = await supabase
        .from("drivers")
        .select("id, name, user_id")
        .eq("is_online", true)
        .eq("is_active", true);
      if (error) throw error;

      // Filter out drivers currently on an active delivery
      const { data: busyDriverIds } = await supabase
        .from("orders")
        .select("driver_id")
        .in("status", ["pronto_para_entrega", "em_transito", "saiu_entrega", "entregue"] as any[])
        .not("driver_id", "is", null);

      const busySet = new Set((busyDriverIds || []).map((o: any) => o.driver_id));
      return (allOnline || []).filter((d: any) => !busySet.has(d.user_id));
    },
  });

  // Realtime channel for drivers
  useEffect(() => {
    const driversChannel = supabase
      .channel("drivers-online-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["online-drivers-count"] });
      })
      .subscribe((status) => setRealtimeDriversConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(driversChannel); };
  }, [queryClient]);

  // Driver profiles
  const driverIds = [...new Set(orders?.map(o => o.driver_id).filter(Boolean) || [])] as string[];
  const { data: driverProfiles } = useQuery({
    queryKey: ["driver-profiles", driverIds],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("user_id, name").in("user_id", driverIds);
      return data || [];
    },
    enabled: driverIds.length > 0,
  });

  const getDriverName = (driverId: string) => {
    const d = driverProfiles?.find((dr: any) => dr.user_id === driverId);
    return d?.name || "Entregador";
  };

  // Client profiles for WhatsApp
  const clientIds = [...new Set(orders?.map(o => o.client_id) || [])];
  const { data: clientProfiles } = useQuery({
    queryKey: ["client-profiles", clientIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, whatsapp_number, phone, full_name")
        .in("user_id", clientIds);
      return data || [];
    },
    enabled: clientIds.length > 0,
  });

  const getClientWhatsApp = (clientId: string) => {
    const p = clientProfiles?.find((c: any) => c.user_id === clientId);
    return (p as any)?.whatsapp_number || (p as any)?.phone || "";
  };

  const getClientName = (clientId: string) => {
    const p = clientProfiles?.find((c: any) => c.user_id === clientId);
    return (p as any)?.full_name || "Cliente";
  };

  // Sound alert system
  const playAlert = useCallback(() => {
    if (!soundEnabled || soundMuted) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(ALERT_SOUND_URL);
      audioRef.current.volume = 1.0;
    }
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
    }).catch(() => {
      toast.error("Não foi possível ativar o som.");
    });
  }, []);

  // Looping sound for pending orders
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

  // Realtime subscription
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["store-orders", store.id] });
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
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) {
      toast.error("Erro ao atualizar pedido.");
    } else {
      toast.success(`Pedido atualizado!`);
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
    }
  };

  const toggleStoreOpen = async () => {
    if (!store) return;
    const { error } = await supabase.from("stores").update({ is_open: !store.is_open }).eq("id", store.id);
    if (error) toast.error("Erro ao atualizar status.");
    else {
      toast.success(store.is_open ? "Loja pausada" : "Loja reaberta!");
      queryClient.invalidateQueries({ queryKey: ["my-store", user?.id] });
    }
  };

  const filteredOrders = (orders?.filter(o => o.status === activeTab) || []).filter(o => {
    if (activeTab !== "entregue" || !settlementSearch.trim()) return true;
    const search = settlementSearch.toLowerCase().trim();
    const orderId = o.id.slice(0, 8).toLowerCase();
    const driverName = o.driver_id ? getDriverName(o.driver_id).toLowerCase() : "";
    const clientName = getClientName(o.client_id).toLowerCase();
    return orderId.includes(search) || driverName.includes(search) || clientName.includes(search);
  });
  const pendingCount = orders?.filter(o => o.status === "pendente").length || 0;

  const getMainAction = (status: OrderStatus): { label: string; next: OrderStatus; emoji: string } | null => {
    switch (status) {
      case "pendente": return { label: "ACEITAR PEDIDO", next: "preparando", emoji: "✓" };
      case "preparando": return { label: "MARCAR COMO PRONTO", next: "pronto_para_entrega" as OrderStatus, emoji: "🔔" };
      default: return null;
    }
  };

  // Render non-order tabs
  if (dashboardTab !== "orders" && store) {
    return (
      <div className="min-h-screen bg-[#111827] text-white">
        <SimulationBanner />
        {/* Compact header */}
        <header className="sticky top-0 z-50 bg-[#1F2937] border-b border-gray-700/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="font-bold text-base">{store.name}</span>
                <span className={`absolute -top-1 -right-3 w-2 h-2 rounded-full ${
                  (onlineDrivers?.length || 0) > 0 ? "bg-green-400" : "bg-gray-500"
                }`} />
              </div>
            </div>
            <button
              onClick={() => setDashboardTab("orders")}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <ListOrdered className="h-4 w-4" />
              Pedidos
              {pendingCount > 0 && (
                <span className="bg-yellow-400 text-gray-900 text-xs px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </header>
        {/* Dashboard sub-tabs */}
        <div className="flex overflow-x-auto gap-1 px-4 py-2 border-b border-gray-800 no-scrollbar">
          {([
            { key: "menu" as DashboardTab, label: "Cardápio", icon: UtensilsCrossed },
            { key: "addons" as DashboardTab, label: "Adicionais", icon: Plus },
            { key: "hours" as DashboardTab, label: "Horários", icon: Clock },
            { key: "settings" as DashboardTab, label: "Loja", icon: Store },
            { key: "finance" as DashboardTab, label: "Finanças", icon: Coins },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setDashboardTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${
                dashboardTab === tab.key ? "bg-primary text-primary-foreground" : "text-gray-400"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-4">
          {dashboardTab === "menu" && <MenuBuilder storeId={store.id} />}
          {dashboardTab === "addons" && <AddonManager storeId={store.id} />}
          {dashboardTab === "hours" && <StoreHoursManager storeId={store.id} forceClosed={(store as any).force_closed || false} />}
          {dashboardTab === "settings" && (
            <StoreSettings
              storeId={store.id} storeName={store.name} storeCategory={store.category}
              storeImageUrl={store.image_url} storeIsOpen={store.is_open}
              forceClosed={(store as any).force_closed || false} storeSlug={(store as any).slug || null}
              storeAddressStreet={(store as any).address_street || null}
              storeAddressNumber={(store as any).address_number || null}
              storeAddressComplement={(store as any).address_complement || null}
              storeAddressNeighborhood={(store as any).address_neighborhood || null}
              storeAddressReference={(store as any).address_reference || null}
              storeAddressCity={(store as any).address_city || null}
              storeAddressState={(store as any).address_state || null}
            />
          )}
          {dashboardTab === "finance" && <StoreFinancePanel storeId={store.id} storeName={store.name} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] text-white flex flex-col">
      <SimulationBanner />

      {/* ── COMPACT HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#1F2937]/95 backdrop-blur border-b border-gray-700/50 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Store name + driver dot */}
            <h1 className="font-bold text-base">{store?.name || "Painel"}</h1>
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                (onlineDrivers?.length || 0) > 0 ? "bg-green-400 animate-pulse" : "bg-gray-500"
              }`}
              title={`${onlineDrivers?.length || 0} entregador(es) online`}
            />
            {/* Online/Offline indicator */}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              isOnline ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Sound toggle (compact) */}
            {soundEnabled && (
              <button
                onClick={() => setSoundMuted(prev => {
                  if (!prev) toast("🔇 Som silenciado", { duration: 3000 });
                  else toast.success("🔊 Som ativo!");
                  return !prev;
                })}
                className={`p-2 rounded-lg ${soundMuted ? "text-red-400" : "text-green-400"}`}
              >
                {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
            {/* Auto-print toggle */}
            <button
              onClick={toggleAutoPrint}
              className={`p-2 rounded-lg ${autoPrint ? "text-primary" : "text-gray-500"}`}
              title={autoPrint ? "Impressão automática ATIVA" : "Impressão automática INATIVA"}
            >
              <Printer className="h-4 w-4" />
            </button>
            {/* Store open/pause toggle */}
            <button
              onClick={toggleStoreOpen}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                store?.is_open
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              {store?.is_open ? "Aberto" : "Pausado"}
            </button>
            {/* Settings gear */}
            <button onClick={() => setDashboardTab("settings")} className="p-2 text-gray-400 hover:text-white">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Sound Activation Prompt (compact) */}
      {showSoundPrompt && !soundEnabled && (
        <div className="mx-3 mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-2">
          <Bell className="h-5 w-5 text-yellow-400 flex-shrink-0 animate-bounce" />
          <p className="text-xs text-yellow-300 flex-1">Ative alertas para não perder pedidos</p>
          <button onClick={activateSound} className="bg-yellow-400 text-gray-900 font-bold px-3 py-1.5 rounded-lg text-xs">
            🔔 Ativar
          </button>
          <button onClick={() => setShowSoundPrompt(false)} className="text-gray-500 text-xs">✕</button>
        </div>
      )}

      {/* ── ORDER STATUS TABS (fixed) ── */}
      <nav className="sticky top-[52px] z-40 bg-[#111827] border-b border-gray-800">
        {/* Dashboard quick nav */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800/50">
          {([
            { key: "menu" as DashboardTab, icon: UtensilsCrossed, label: "Cardápio" },
            { key: "finance" as DashboardTab, icon: Coins, label: "Finanças" },
            { key: "hours" as DashboardTab, icon: Clock, label: "Horários" },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setDashboardTab(t.key)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300"
            >
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
        {/* Order status tabs */}
        <div className="flex overflow-x-auto gap-0.5 px-2 py-1.5 no-scrollbar">
          {orderTabs.map((tab) => {
            const count = orders?.filter(o => o.status === tab.status).length || 0;
            const Icon = tab.icon;
            const isActive = activeTab === tab.status;
            return (
              <button
                key={tab.status}
                onClick={() => setActiveTab(tab.status)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    tab.status === "pendente" ? "bg-yellow-400 text-gray-900 animate-pulse" : isActive ? "bg-white/20" : "bg-gray-700 text-gray-300"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── ORDER CARDS ── */}
      <div className="flex-1 px-3 py-3 pb-24 space-y-3 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#1F2937] rounded-2xl p-4 animate-pulse space-y-3">
                <div className="h-5 bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-700 rounded w-2/3" />
                <div className="h-10 bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order: any) => {
            const action = getMainAction(order.status);
            const isAddressExpanded = expandedAddresses.has(order.id);

            return (
              <div
                key={order.id}
                className={`bg-[#1F2937] rounded-2xl overflow-hidden border ${
                  order.status === "pendente" ? "border-yellow-400/40" : "border-gray-700/50"
                }`}
              >
                {/* ── Card Header: Order # + Total + Payment icon ── */}
                <div className="px-4 pt-3 pb-2 flex items-start justify-between">
                  <div>
                    <p className="text-lg font-black text-white tracking-wide">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{getClientName(order.client_id)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-2xl" title={paymentLabels[order.payment_method]}>
                      {paymentIcons[order.payment_method] || "💳"}
                    </span>
                    <div>
                      <p className="text-xl font-black text-green-400">
                        R$ {Number(order.total_price).toFixed(2)}
                      </p>
                      {order.payment_method === "pix" && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">
                          PIX PAGO
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Items (gray background) ── */}
                <div className="mx-3 mb-2 bg-gray-800/60 rounded-xl px-3 py-2 space-y-1">
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-200">
                        <span className="text-yellow-400 font-bold">{item.quantity}x</span>{" "}
                        {item.products?.name || "Item"}
                      </span>
                      <span className="text-gray-500 text-xs">
                        R$ {(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {order.payment_method === "dinheiro" && (order as any).needs_change && Number((order as any).change_for) > 0 && (
                    <div className="flex items-center gap-1 pt-1 border-t border-gray-700/50">
                      <Banknote className="h-3 w-3 text-yellow-400" />
                      <span className="text-[10px] text-yellow-400 font-bold">
                        Troco: R$ {(Number((order as any).change_for) - Number(order.total_price)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Address (collapsible) ── */}
                <div className="mx-3 mb-2">
                  <button
                    onClick={() => toggleAddress(order.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 w-full"
                  >
                    <MapPin className="h-3 w-3" />
                    <span className="truncate flex-1 text-left">{order.neighborhood}</span>
                    {isAddressExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {isAddressExpanded && (
                    <div className="mt-1.5 bg-gray-800/40 rounded-lg p-2 text-xs text-gray-400 space-y-0.5">
                      <p>{order.address_details}</p>
                      <p className="text-gray-500">Taxa entrega: R$ {Number(order.delivery_fee).toFixed(2)}</p>
                    </div>
                  )}
                </div>

                {/* ── Driver status badges ── */}
                {order.status === "pronto_para_entrega" && !order.driver_id && (
                  <div className="mx-3 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                      <span className="text-xs text-amber-300 font-semibold">Aguardando entregador aceitar a corrida</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${(onlineDrivers?.length || 0) > 0 ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                      <span className="text-[10px] text-muted-foreground">
                        {(onlineDrivers?.length || 0) > 0
                          ? `${onlineDrivers?.length} entregador(es) online`
                          : "Nenhum entregador online no momento"}
                      </span>
                    </div>
                  </div>
                )}
                {order.driver_id && (order.status === "pronto_para_entrega") && (
                  <div className="mx-3 mb-2 flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-2.5 py-1.5">
                    <Bike className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-xs text-green-300 font-semibold">🏍️ {getDriverName(order.driver_id)} aceitou! Está a caminho da loja</span>
                  </div>
                )}
                {order.driver_id && (order.status === "em_transito" || order.status === "saiu_entrega") && (
                  <div className="mx-3 mb-2 flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5">
                    <Truck className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-xs text-cyan-300 font-semibold">🛵 {getDriverName(order.driver_id)} levando o pedido ao cliente</span>
                  </div>
                )}

                {/* ── Collection Code ── */}
                {(order.status === "pronto_para_entrega" || order.status === "saiu_entrega" || order.status === "em_transito") && (order as any).collection_code && (
                  <div className="mx-3 mb-2 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-purple-400 font-bold">🔐 Código de Coleta</p>
                    <p className="text-2xl font-black text-purple-300 tracking-[0.3em]">{(order as any).collection_code}</p>
                  </div>
                )}

                {/* ── Settlement Code ── */}
                {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).settlement_code && ["entregue", "finalizado"].includes(order.status) && !(order as any).return_to_store_confirmed && (
                  <div className="mx-3 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-amber-400">🔑 Código de Acerto</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText((order as any).settlement_code); toast.success("Copiado!"); }}
                        className="flex items-center gap-1 text-[10px] text-amber-400"
                      >
                        <Copy className="h-2.5 w-2.5" /> Copiar
                      </button>
                    </div>
                    <p className="text-3xl font-black text-amber-300 tracking-[0.3em] text-center">{(order as any).settlement_code}</p>
                    <p className="text-[10px] text-gray-500 text-center mt-1">
                      Informe somente após receber R$ {Number(order.total_price).toFixed(2)}
                    </p>
                  </div>
                )}
                {["dinheiro", "cartao"].includes(order.payment_method) && (order as any).return_to_store_confirmed && ["entregue", "finalizado"].includes(order.status) && (
                  <div className="mx-3 mb-2 flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-2.5 py-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-xs text-green-400 font-bold">Acerto realizado ✅</span>
                  </div>
                )}

                {/* ── WhatsApp quick actions (small) ── */}
                {getClientWhatsApp(order.client_id) && (
                  <div className="mx-3 mb-2 flex flex-wrap gap-1.5">
                    {order.status === "pendente" && (
                      <button
                        onClick={() => {
                          const msg = `Olá ${getClientName(order.client_id)}! *FoodIta*: Pedido aceito e em produção! 🍔\nPedido: #${order.id.slice(0,8).toUpperCase()}\nTotal: R$ ${Number(order.total_price).toFixed(2)}`;
                          openWhatsApp(getClientWhatsApp(order.client_id), msg);
                        }}
                        className="flex items-center gap-1 bg-green-600/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded-lg"
                      >
                        <MessageCircle className="h-3 w-3" /> Avisar
                      </button>
                    )}
                    {(order.status === "em_transito" || order.status === "saiu_entrega") && (
                      <button
                        onClick={() => {
                          const msg = `Olá ${getClientName(order.client_id)}! Motoboy *FoodIta* saiu para entrega! 🚀\nEndereço: ${order.address_details}`;
                          openWhatsApp(getClientWhatsApp(order.client_id), msg);
                        }}
                        className="flex items-center gap-1 bg-green-600/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded-lg"
                      >
                        <MessageCircle className="h-3 w-3" /> Saiu
                      </button>
                    )}
                    <WhatsAppButton
                      number={getClientWhatsApp(order.client_id)}
                      message={`Olá ${getClientName(order.client_id)}! Aqui é do ${store?.name}. Pedido #${order.id.slice(0, 8).toUpperCase()}...`}
                      label="Chat"
                      size="sm"
                    />
                  </div>
                )}

                {/* ── SINGLE MAIN ACTION BUTTON ── */}
                <div className="px-3 pb-3 pt-1 flex items-center gap-2">
                  {/* Print button (small) */}
                  <button
                    onClick={() => handlePrint(order)}
                    className="p-2 bg-gray-700/50 rounded-lg text-gray-400 hover:text-white"
                    title="Imprimir"
                  >
                    <Printer className="h-4 w-4" />
                  </button>

                  <div className="flex-1">
                    {action && order.status === "pendente" ? (
                      <div className="space-y-1.5">
                        {/* PIX badge */}
                        {order.payment_method === "pix" && (
                          <div className="text-center">
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">
                              💰 Pagamento Garantido
                            </span>
                          </div>
                        )}
                        {/* Main accept button */}
                        <button
                          onClick={() => updateOrderStatus(order.id, "preparando")}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
                        >
                          ✓ ACEITAR PEDIDO
                        </button>
                        {/* Reject as small link */}
                        <button
                          onClick={async () => {
                            const { error } = await supabase.from("orders").update({ status: "cancelado" as any }).eq("id", order.id);
                            if (error) toast.error("Erro ao recusar.");
                            else { toast.success("Pedido recusado."); queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] }); }
                          }}
                          className="w-full text-center text-xs text-red-400 hover:text-red-300 py-1"
                        >
                          Recusar pedido
                        </button>
                      </div>
                    ) : action ? (
                      <button
                        onClick={() => updateOrderStatus(order.id, action.next)}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
                      >
                        {action.emoji} {action.label}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-14 w-14 text-gray-700 mb-3" />
            <p className="text-sm font-bold text-gray-500">
              Nenhum pedido {orderTabs.find(t => t.status === activeTab)?.label.toLowerCase()}
            </p>
          </div>
        )}
      </div>

      {/* ── Floating pending badge ── */}
      {pendingCount > 0 && activeTab !== "pendente" && (
        <button
          onClick={() => setActiveTab("pendente")}
          className="fixed bottom-6 right-6 bg-yellow-400 text-gray-900 font-bold px-4 py-2.5 rounded-xl shadow-lg animate-bounce flex items-center gap-2 text-sm"
        >
          <Clock className="h-4 w-4" />
          {pendingCount} novo{pendingCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
};

export default AdminDashboard;
