import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { startDriverTracking, stopDriverTracking, updateTrackingOrderId, clearDriverLocation } from "@/lib/driverGeolocation";
import { buildWazeUrl, buildGoogleMapsUrl, type NavTarget } from "@/lib/navUrls";
import {
  Bike, MapPin, Store, DollarSign, Package, CheckCircle2,
  ArrowLeft, Navigation, KeyRound, Smartphone, ShieldCheck,
  Wallet, TrendingUp, Calendar, Download, Clock, ChevronDown,
  CreditCard, Banknote, Settings, Save, AlertTriangle, User,
  Zap, ArrowRight, BarChart3, Eye, LogOut, Bell, ChevronRight,
  CircleDollarSign, Flame, Shield, Star
} from "lucide-react";
import confetti from "canvas-confetti";
import { isGoNative, runNativeDiagnostics, getNativeDebugLog } from "@/lib/gonative";
import WhatsAppButton from "@/components/WhatsAppButton";

import { openWhatsApp } from "@/lib/whatsapp";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, startOfDay, startOfWeek, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requestNotificationPermission, notifyDeliveryAvailable } from "@/lib/notifications";
import { sumMoney, formatBRL } from "@/lib/utils";
import ProductTour, { motoboyTourSteps } from "@/components/ProductTour";
import StoreDriverView from "@/components/StoreDriverView";
import DriverPersistentAlert from "@/components/DriverPersistentAlert";
import SignOutConfirm from "@/components/SignOutConfirm";
type TabType = "entregas" | "historico" | "config";
type DateFilter = "hoje" | "semana" | "mes" | "custom";

const RURAL_NEIGHBORHOODS = [
  "Distrito do Lobo", "Recanto dos Cambarás", "Engenheiro Serra",
  "Vila dos Lavradores", "Entorno do CDP", "Fazendas/Sítios (Geral)"
];

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave Aleatória",
};

/* ─── Premium UI Primitives ─── */
const StatCard = ({ icon: Icon, label, value, sub, accent = "primary" }: { icon: any; label: string; value: string; sub?: string; accent?: string }) => {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-500",
    blue: "bg-blue-500/10 text-blue-500",
    amber: "bg-amber-500/10 text-amber-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
  };
  const colors = colorMap[accent] || colorMap.primary;
  const [bgClass, textClass] = colors.split(" ");
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-1.5 relative overflow-hidden group">
      <div className={`w-8 h-8 rounded-xl ${bgClass} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${textClass}`} />
      </div>
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-base font-black ${textClass} leading-tight`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, children, action }: { icon: any; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between px-1 mb-3">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-bold text-foreground">{children}</h3>
    </div>
    {action}
  </div>
);

const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
    <div className="w-20 h-20 rounded-3xl bg-muted/80 flex items-center justify-center mb-5">
      <Icon className="h-9 w-9 text-muted-foreground/60" />
    </div>
    <h2 className="text-base font-bold text-foreground mb-1.5">{title}</h2>
    <p className="text-sm text-muted-foreground max-w-[260px]">{subtitle}</p>
  </div>
);

const DriverDashboard = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => {
    return localStorage.getItem("driver_online") === "true";
  });
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [collectionCodeInput, setCollectionCodeInput] = useState("");
  const [verifyingCollection, setVerifyingCollection] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);
  const notifiedReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>("entregas");
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoje");

  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState<string>("cpf");
  const [savingPix, setSavingPix] = useState(false);

  const { data: driverProfile } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role, pix_key, pix_type, full_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

   // Detect if user is a store driver (not platform driver) - Filter by accepted status
   const { data: storeDriverLinks, isFetched: hasResolvedStoreDriverLinks } = useQuery({
     queryKey: ["store-driver-links", user?.id],
     queryFn: async () => {
       const { data } = await supabase
         .from("store_drivers")
         .select("id, store_id, status, stores(name)")
         .eq("driver_user_id", user!.id);
       return data || [];
     },
     enabled: !!user,
   });

   const acceptedStoreLinks = useMemo(() => (storeDriverLinks || []).filter((l: any) => l.status === 'accepted'), [storeDriverLinks]);
   const pendingStoreLinks = useMemo(() => (storeDriverLinks || []).filter((l: any) => l.status === 'pending'), [storeDriverLinks]);

  // Motoboy plataforma descontinuado — todos são motoboy próprio/loja
  // Mantendo query para compatibilidade mas ignorando o resultado
  const { data: platformDriverEntry, isFetched: hasResolvedPlatformDriverEntry } = useQuery({
    queryKey: ["platform-driver-entry", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const hasResolvedDriverMode = hasResolvedStoreDriverLinks && hasResolvedPlatformDriverEntry;
   const isStoreDriver = (acceptedStoreLinks?.length || 0) > 0;
  const hasPlatformDriverEntry = !!platformDriverEntry;
  // Store motoboy = has role motoboy, no platform drivers entry, and no store link yet
   // Qualquer motoboy sem vínculo com loja está aguardando convite (plataforma descontinuada)
  const isStoreMotoboyWaiting = (driverProfile as any)?.role === "motoboy" && !isStoreDriver && pendingStoreLinks.length === 0;
  const isPlatformDriver = false; // Motoboy plataforma descontinuado
   const linkedStoreIds = useMemo(() => acceptedStoreLinks.map((l: any) => l.store_id), [acceptedStoreLinks]);

  useEffect(() => {
    if (driverProfile) {
      setPixKey((driverProfile as any).pix_key || "");
      setPixType((driverProfile as any).pix_type || "cpf");
    }
  }, [driverProfile]);

  const playAlert = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkYyEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTQ==");
    }
    audioRef.current.play().catch(() => {});
  }, []);

   const { data: availableOrders, isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery({
    queryKey: ["driver-available-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name), order_items(*, products(name))")
        .eq("status", "pronto_para_entrega")
        .is("driver_id", null)
        .neq("neighborhood", "RETIRADA")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
     enabled: !!user && isOnline,
     staleTime: 10_000, // Realtime keeps this fresh — avoid refetch on every focus
  });

   const { data: myDelivery, refetch: refetchMyDelivery } = useQuery({
    queryKey: ["driver-my-delivery", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, owner_id, address_street, address_number, address_neighborhood, address_city, address_state, address_cep), order_items(*, products(name))")
        .eq("driver_id", user!.id)
        .in("status", ["pronto_para_entrega", "saiu_entrega", "em_transito"] as any)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
     enabled: !!user,
     staleTime: 10_000,
  });

  const { data: deliveryHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["driver-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, delivery_fee, neighborhood, confirmed_at, created_at, payment_method, stores(name)")
        .eq("driver_id", user!.id)
        .eq("status", "finalizado" as any)
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const deliveryClientId = myDelivery?.client_id;
  const deliveryStoreOwnerId = (myDelivery as any)?.stores?.owner_id;
  const profileIds = [deliveryClientId, deliveryStoreOwnerId].filter(Boolean) as string[];

  const { data: contactProfiles } = useQuery({
    queryKey: ["driver-contacts", profileIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_contacts")
        .select("user_id, whatsapp_number, phone, full_name")
        .in("user_id", profileIds);
      return data || [];
    },
    enabled: profileIds.length > 0,
  });

  const getContactWhatsApp = (userId: string) => {
    const p = contactProfiles?.find((c: any) => c.user_id === userId);
    return (p as any)?.whatsapp_number || (p as any)?.phone || "";
  };

   const { data: pendingReturn, refetch: refetchPendingReturn } = useQuery({
    queryKey: ["driver-pending-return", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, address_street, address_number, address_neighborhood, address_city, address_state, address_cep)")
        .eq("driver_id", user!.id)
        .in("status", ["entregue", "finalizado"] as any)
        .in("payment_method", ["dinheiro", "cartao"])
        .eq("return_to_store_confirmed", false)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
      enabled: !!user,
  });

  // ── REALTIME FOR DRIVER ──
  // Canal driver-realtime removido — substituído pelo canal driver-orders-rt
  // mais abaixo que já faz tudo com optimistic updates, evitando queries dobradas

  // openPlatformStores removida — motoboy plataforma descontinuado
  // Todos os motoboys são próprios/loja, não precisam de lojas abertas da plataforma
  const openPlatformStores: any[] = [];

  const { data: driverBalance } = useQuery({
    queryKey: ["driver-balance", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_balances" as any)
        .select("total_earned, pending_amount, paid_amount")
        .eq("driver_user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: driverEarnings } = useQuery({
    queryKey: ["driver-earnings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_earnings" as any)
        .select("id, order_id, amount, status, created_at")
        .eq("driver_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const { data: pendingWithdrawal } = useQuery({
    queryKey: ["pending-withdrawal", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests" as any)
        .select("id, amount, status, created_at, transaction_code")
        .eq("driver_user_id", user!.id)
        .eq("status", "solicitado")
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: withdrawalHistory } = useQuery({
    queryKey: ["withdrawal-history", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests" as any)
        .select("id, amount, status, created_at, transaction_code, processed_at")
        .eq("driver_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const [requestingSaque, setRequestingSaque] = useState(false);

  const filteredHistory = useMemo(() => {
    if (!deliveryHistory) return [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = subDays(now, 30);
    return deliveryHistory.filter((order: any) => {
      const orderDate = parseISO(order.confirmed_at || order.created_at);
      switch (dateFilter) {
        case "hoje": return isWithinInterval(orderDate, { start: todayStart, end: now });
        case "semana": return isWithinInterval(orderDate, { start: weekStart, end: now });
        case "mes": return isWithinInterval(orderDate, { start: monthStart, end: now });
        default: return true;
      }
    });
  }, [deliveryHistory, dateFilter]);

  const todayEarnings = useMemo(() => {
    if (!deliveryHistory) return 0;
    const todayStart = startOfDay(new Date());
    return sumMoney(
      deliveryHistory
        .filter((o: any) => parseISO(o.confirmed_at || o.created_at) >= todayStart)
        .map((o: any) => o.delivery_fee)
    );
  }, [deliveryHistory]);

  const weekEarnings = useMemo(() => {
    if (!deliveryHistory) return 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return sumMoney(
      deliveryHistory
        .filter((o: any) => parseISO(o.confirmed_at || o.created_at) >= weekStart)
        .map((o: any) => o.delivery_fee)
    );
  }, [deliveryHistory]);

  const totalDeliveries = deliveryHistory?.length || 0;

  const filteredEarnings = useMemo(() => {
    return sumMoney(filteredHistory.map((o: any) => o.delivery_fee));
  }, [filteredHistory]);

  const earningsBreakdown = useMemo(() => {
    const pixEarnings = sumMoney(
      filteredHistory
        .filter((o: any) => !["dinheiro", "cartao"].includes(o.payment_method))
        .map((o: any) => o.delivery_fee)
    );
    const cashEarnings = sumMoney(
      filteredHistory
        .filter((o: any) => ["dinheiro", "cartao"].includes(o.payment_method))
        .map((o: any) => o.delivery_fee)
    );
    const pixCount = filteredHistory.filter((o: any) => !["dinheiro", "cartao"].includes(o.payment_method)).length;
    const cashCount = filteredHistory.filter((o: any) => ["dinheiro", "cartao"].includes(o.payment_method)).length;
    return { pixEarnings, cashEarnings, pixCount, cashCount };
  }, [filteredHistory]);

  // ─── Side effects (unchanged) ───
  useEffect(() => {
    if (!user) return;
    if (!hasResolvedDriverMode) return;
    // Store drivers manage their own online state via StoreDriverView.
    // Do NOT overwrite their is_online flag here, otherwise reopening the
    // app would always reset them to offline.
    if (isStoreDriver) return;
    supabase.from("drivers").update({ is_online: isOnline } as any).eq("user_id", user.id).then(() => {});
    const handleUnload = () => {
      const url = `${SUPABASE_URL}/rest/v1/drivers?user_id=eq.${user.id}`;
      fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ is_online: false }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => { window.removeEventListener("beforeunload", handleUnload); };
  }, [user, hasResolvedDriverMode, isStoreDriver, isOnline]);

  useEffect(() => {
    if (!user || !isOnline) return;
    const channel = supabase
      .channel(`driver-orders-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const nextOrder = payload.new as any;
        const prevOrder = payload.old as any;
        const becameReady = payload.eventType === "UPDATE"
          && nextOrder?.status === "pronto_para_entrega"
          && prevOrder?.status !== "pronto_para_entrega"
          && !nextOrder?.driver_id;

        if (becameReady && nextOrder?.id && !notifiedReadyOrderIdsRef.current.has(nextOrder.id)) {
          notifiedReadyOrderIdsRef.current.add(nextOrder.id);
          playAlert();
          toast.info("🏍️ Nova entrega disponível!");
        }
        // Instant cache update for driver's current delivery
        if (payload.eventType === "UPDATE" && nextOrder) {
          queryClient.setQueryData(["driver-my-delivery", user.id], (old: any[] | undefined) => {
            if (!old) return old;
            const idx = old.findIndex((o: any) => o.id === nextOrder.id);
            if (idx >= 0) { const c = [...old]; c[idx] = { ...c[idx], ...nextOrder }; return c; }
            return old;
          });
        }
        queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
        queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user.id] });
        queryClient.invalidateQueries({ queryKey: ["driver-history", user.id] });
      })
      .subscribe((status) => { setRealtimeConnected(status === "SUBSCRIBED"); });
    return () => { supabase.removeChannel(channel); };
  }, [user, isOnline, queryClient, playAlert]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`driver-balance-rt-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_balances" }, () => {
        queryClient.invalidateQueries({ queryKey: ["driver-balance", user.id] });
        queryClient.invalidateQueries({ queryKey: ["driver-earnings", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pending-withdrawal", user.id] });
        queryClient.invalidateQueries({ queryKey: ["withdrawal-history", user.id] });
        queryClient.invalidateQueries({ queryKey: ["driver-balance", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_earnings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["driver-earnings", user.id] });
        queryClient.invalidateQueries({ queryKey: ["driver-balance", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  useEffect(() => {
    if (!user) return;

    const refreshDriverDashboard = () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile-approval", user.id] });
      queryClient.invalidateQueries({ queryKey: ["store-driver-links", user.id] });
      queryClient.invalidateQueries({ queryKey: ["platform-driver-entry", user.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-history", user.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-pending-return", user.id] });
      queryClient.invalidateQueries({ queryKey: ["open-platform-stores"] });
      queryClient.invalidateQueries({ queryKey: ["driver-balance", user.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-earnings", user.id] });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawal", user.id] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-history", user.id] });
    };

    window.addEventListener("capacitor-app-resume", refreshDriverDashboard);
    return () => window.removeEventListener("capacitor-app-resume", refreshDriverDashboard);
  }, [user, queryClient]);

  useEffect(() => {
    const count = availableOrders?.length || 0;
    if (count > prevCountRef.current && prevCountRef.current >= 0) playAlert();
    prevCountRef.current = count;
  }, [availableOrders, playAlert]);

  useEffect(() => {
    const availableIds = new Set((availableOrders || []).map((order: any) => order.id));
    notifiedReadyOrderIdsRef.current.forEach((id) => {
      if (!availableIds.has(id)) {
        notifiedReadyOrderIdsRef.current.delete(id);
      }
    });
  }, [availableOrders]);

  // ─── GPS Tracking ───
  useEffect(() => {
    if (!user) return;
    const hasActiveDelivery = !!myDelivery;
    
    if (hasActiveDelivery && isOnline) {
      const orderId = (myDelivery as any)?.id || null;
      startDriverTracking(orderId);
    } else {
      stopDriverTracking();
      if (!isOnline) clearDriverLocation();
    }

    return () => {
      // Don't stop on unmount if delivery is active
    };
  }, [user, !!myDelivery, isOnline, (myDelivery as any)?.id]);

  // Keep tracking order ID in sync
  useEffect(() => {
    if (myDelivery) {
      updateTrackingOrderId((myDelivery as any)?.id || null);
    }
  }, [(myDelivery as any)?.id]);

  // ─── Handlers (unchanged) ───
  const toggleOnline = async () => {
    const next = !isOnline;
    if (!next && myDelivery) {
      toast.error("Você tem uma entrega ativa! Finalize antes de ficar offline.");
      return;
    }
    setIsOnline(next);
    localStorage.setItem("driver_online", String(next));
    if (next) requestNotificationPermission();
    if (user) await supabase.from("drivers").update({ is_online: next } as any).eq("user_id", user.id);
    toast.success(next ? "Você está online! Aguardando entregas..." : "Você está offline.");
  };

  const acceptOrder = async (orderId: string) => {
    if (myDelivery) {
      toast.error("Você já tem uma entrega ativa. Finalize-a antes de aceitar outra.");
      return;
    }
    if (acceptingOrderId) return; // prevent double-tap
    setAcceptingOrderId(orderId);
    // Optimistic UI: remove order from available list immediately so it disappears instantly
    const previousAvailable = queryClient.getQueryData<any[]>(["driver-available-orders"]);
    const acceptedOrder = (availableOrders || []).find((o: any) => o.id === orderId);
    if (previousAvailable) {
      queryClient.setQueryData(
        ["driver-available-orders"],
        previousAvailable.filter((o: any) => o.id !== orderId),
      );
    }
    // Pre-populate myDelivery cache so the driver sees the active card immediately
    if (acceptedOrder && user) {
      queryClient.setQueryData(["driver-my-delivery", user.id], { ...acceptedOrder, driver_id: user.id });
    }
    setPinInput("");
    setCollectionCodeInput("");

    const { error } = await supabase.rpc("driver_accept_order", { _order_id: orderId } as any);
    if (error) {
      // Revert
      if (previousAvailable) queryClient.setQueryData(["driver-available-orders"], previousAvailable);
      if (user) queryClient.setQueryData(["driver-my-delivery", user.id], null);
      toast.error("Ops! Outro entregador já aceitou esta corrida.");
    } else {
      toast.success("Corrida aceita! Vá buscar o pedido na loja.");
      // Refresh in background to sync with server truth
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
    }
    setAcceptingOrderId(null);
  };

  const validateCollection = async (orderId: string) => {
    if (collectionCodeInput.length !== 4) { toast.error("Digite o código de 4 dígitos do lojista."); return; }
    setVerifyingCollection(true);
    const { error } = await supabase.rpc("driver_validate_collection" as any, { _order_id: orderId, _code: collectionCodeInput });
    if (error) {
      toast.error(error.message || "Código inválido. Verifique com o lojista.");
      setVerifyingCollection(false);
    } else {
      toast.success("✅ Coleta validada! Agora entregue ao cliente.");
      setVerifyingCollection(false);
      setCollectionCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
      if (myDelivery) {
        const clientPhone = getContactWhatsApp(myDelivery.client_id);
        if (clientPhone) {
          const clientName = contactProfiles?.find((c: any) => c.user_id === myDelivery.client_id);
          const name = (clientName as any)?.full_name || "Cliente";
          const msg = `🏍️ *ItaSuper* informa: Seu lanche saiu para entrega! O motoboy já coletou o pedido e está a caminho de: ${myDelivery.address_details} 💨\n\n--------------------------\n💰 Total: ${formatBRL(Number(myDelivery.total_price))}\n💳 Pagamento: ${myDelivery.payment_method === "pix" ? "PIX" : myDelivery.payment_method === "cartao" ? "Cartão" : myDelivery.payment_method === "dinheiro" ? "Dinheiro" : myDelivery.payment_method}\nPedido: #${myDelivery.id.slice(0, 8).toUpperCase()}\n--------------------------`;
          setTimeout(() => openWhatsApp(clientPhone, msg), 600);
        }
      }
    }
  };

  const finishDelivery = async (orderId: string, value?: string) => {
    const finalPin = value || pinInput;
    if (finalPin.length !== 4) {
      if (!value) toast.error("Digite o código de 4 dígitos do cliente.");
      return;
    }
    
    setVerifying(true);
    const orderData = myDelivery || availableOrders?.find((o: any) => o.id === orderId);
    const deliveryFee = Number(orderData?.delivery_fee || 0);
    
    try {
      const { error } = await supabase.rpc("driver_finish_delivery", { _order_id: orderId, _pin: finalPin } as any);
      
      if (error) {
        toast.error(error.message || "Código inválido. Verifique com o cliente.");
        setVerifying(false);
      } else {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
        const isPhysical = ["dinheiro", "cartao"].includes(orderData?.payment_method || "");
        if (isPhysical) {
          toast.success(`✅ Entrega confirmada! Retorne à loja para acertar ${formatBRL(deliveryFee)} em mãos.`, { duration: 8000, icon: "🏪" });
        } else {
          toast.success(`🎉 Parabéns! ${formatBRL(deliveryFee)} foi adicionado ao seu saldo Pix!`, { duration: 8000, icon: "💰" });
        }
        setPinInput("");
        setVerifying(false);
        
        // Invalidate queries in background — don't block the success UX
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] }),
          queryClient.invalidateQueries({ queryKey: ["driver-pending-return", user!.id] }),
          queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] }),
          queryClient.invalidateQueries({ queryKey: ["driver-history", user!.id] }),
          queryClient.invalidateQueries({ queryKey: ["driver-balance", user!.id] }),
          queryClient.invalidateQueries({ queryKey: ["driver-earnings", user!.id] })
        ]).catch(() => {});
      }
    } catch (err) {
      console.error("Error finishing delivery:", err);
      toast.error("Erro ao finalizar entrega. Verifique sua conexão.");
      setVerifying(false);
    }
  };

  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [settlementCodeInput, setSettlementCodeInput] = useState("");
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);

  const acceptInvitation = async (linkId: string) => {
    setAcceptingInvite(linkId);
    const { error } = await supabase
      .from("store_drivers")
      .update({ status: 'accepted' } as any)
      .eq("id", linkId);
    
    if (error) {
      toast.error("Erro ao aceitar convite.");
    } else {
      toast.success("Convite aceito! Agora você faz parte desta loja.");
      queryClient.invalidateQueries({ queryKey: ["store-driver-links", user?.id] });
    }
    setAcceptingInvite(null);
  };

  const rejectInvitation = async (linkId: string) => {
    const { error } = await supabase
      .from("store_drivers")
      .delete()
      .eq("id", linkId);
    
    if (error) {
      toast.error("Erro ao recusar convite.");
    } else {
      toast.success("Convite recusado.");
      queryClient.invalidateQueries({ queryKey: ["store-driver-links", user?.id] });
    }
  };

  const confirmStoreReturn = async (orderId: string) => {
    if (!settlementCodeInput || settlementCodeInput.length !== 4) { toast.error("Digite o código de 4 dígitos fornecido pelo lojista."); return; }
    setConfirmingReturn(true);
    const { error } = await supabase.rpc("driver_confirm_store_return", { _order_id: orderId, _settlement_code: settlementCodeInput } as any);
    if (error) {
      toast.error(error.message || "Código inválido. Verifique com o lojista.");
    } else {
      toast.success("Acerto com a loja confirmado! Taxa paga em mãos ✅");
      setSettlementCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["driver-pending-return", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-balance", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-earnings", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-history", user!.id] });
    }
    setConfirmingReturn(false);
  };

  const savePixKey = async () => {
    if (!pixKey.trim()) { toast.error("Informe sua chave Pix."); return; }
    setSavingPix(true);
    const { error } = await supabase.from("profiles").update({ pix_key: pixKey.trim(), pix_type: pixType as any }).eq("user_id", user!.id);
    if (error) { toast.error("Erro ao salvar chave Pix."); } else {
      toast.success("✅ Chave Pix salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["my-profile-approval", user!.id] });
    }
    setSavingPix(false);
  };

  const exportSummary = () => {
    const filterLabel = dateFilter === "hoje" ? "Hoje" : dateFilter === "semana" ? "Semana" : dateFilter === "mes" ? "Últimos 30 dias" : "Todos";
    const lines = [
      `📊 RELATÓRIO DO ENTREGADOR`,
      `Período: ${filterLabel}`,
      `Data: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      ``,
      `💰 Total de Ganhos: ${formatBRL(filteredEarnings)}`,
      `📱 Via Pix App: ${formatBRL(earningsBreakdown.pixEarnings)} (${earningsBreakdown.pixCount} entregas)`,
      `💵 Em Dinheiro: ${formatBRL(earningsBreakdown.cashEarnings)} (${earningsBreakdown.cashCount} entregas)`,
      `📦 Entregas Realizadas: ${filteredHistory.length}`,
      ``,
      `--- DETALHAMENTO ---`,
      ...filteredHistory.map((o: any) => {
        const date = format(parseISO(o.confirmed_at || o.created_at), "dd/MM HH:mm", { locale: ptBR });
        const payIcon = o.payment_method === "dinheiro" ? "💵" : "📱";
        return `${date} | ${(o as any).stores?.name || "Loja"} | ${o.neighborhood} | ${payIcon} ${formatBRL(Number(o.delivery_fee))}`;
      }),
    ];
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success("📋 Relatório copiado! Cole no WhatsApp.");
    }).catch(() => {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-entregador-${format(new Date(), "yyyy-MM-dd")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("📄 Relatório baixado!");
    });
  };

  // ─── Guards ───
  if (authLoading) return null;
  if (!user) { navigate("/auth", { replace: true }); return null; }

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Acesso Mobile</h1>
          <p className="text-muted-foreground">
            O painel do entregador está disponível apenas para <span className="text-primary font-bold">dispositivos móveis</span>.
          </p>
          <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <p className="text-sm text-muted-foreground">Escaneie o QR Code ou acesse pelo celular:</p>
            <div className="bg-white rounded-xl p-4 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`}
                alt="QR Code"
                className="w-44 h-44"
              />
            </div>
          </div>
          <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm font-bold">
            ← Voltar para a Home
          </button>
        </div>
      </div>
    );
  }

   const handleStoreInvitation = async (linkId: string, status: 'accepted' | 'rejected') => {
     const { error } = await supabase
       .from("store_drivers")
       .update({ status } as any)
       .eq("id", linkId);
     
     if (error) {
       toast.error("Erro ao processar convite.");
     } else {
       toast.success(status === 'accepted' ? "Convite aceito!" : "Convite recusado.");
       queryClient.invalidateQueries({ queryKey: ["store-driver-links", user?.id] });
     }
   };

   // Store motoboy waiting or invitations
   if (isStoreMotoboyWaiting || pendingStoreLinks.length > 0) {
     return (
       <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
         {pendingStoreLinks.length > 0 ? (
           <div className="w-full max-w-sm space-y-6">
             <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-2">
               <Bike className="h-10 w-10 text-primary" />
             </div>
             <div className="text-center">
               <h1 className="text-xl font-black text-foreground mb-2">Convites de Lojas 🏢</h1>
               <p className="text-sm text-muted-foreground">
                 Você recebeu convites para trabalhar como motoboy próprio nas seguintes lojas:
               </p>
             </div>
             
             <div className="space-y-3">
               {pendingStoreLinks.map((link: any) => (
                 <div key={link.id} className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                       <Store className="h-5 w-5 text-primary" />
                     </div>
                     <div className="text-left">
                       <p className="font-bold text-foreground">{(link.stores as any)?.name || "Loja"}</p>
                       <p className="text-[10px] text-muted-foreground uppercase font-black">Convite Pendente</p>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2">
                     <button 
                       onClick={() => handleStoreInvitation(link.id, 'rejected')}
                       className="py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                     >
                       Recusar
                     </button>
                     <button 
                       onClick={() => handleStoreInvitation(link.id, 'accepted')}
                       className="py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                     >
                       Aceitar
                     </button>
                   </div>
                 </div>
               ))}
             </div>

             <p className="text-[11px] text-muted-foreground text-center">
               Ao aceitar, você poderá ver e realizar as entregas exclusivas desta loja.
             </p>
           </div>
         ) : (
           <div className="text-center space-y-6">
             <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-2">
               <Store className="h-10 w-10 text-amber-500" />
             </div>
             <div>
               <h1 className="text-xl font-black text-foreground mb-2">Aguardando Vinculação 🔗</h1>
               <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                 Sua conta foi criada! Agora peça ao <span className="font-bold text-foreground">dono da loja</span> para te adicionar como motoboy no painel dele usando seu telefone ou e-mail.
               </p>
             </div>
             <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 max-w-xs mx-auto">
               <p className="text-[11px] text-muted-foreground">
                 📲 Assim que o lojista te convidar, você verá o convite aqui para aceitar e começar a trabalhar.
               </p>
             </div>
             <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-2xl text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all">
               Verificar Convites
             </button>
           </div>
         )}
       </div>
     );
   }

  const driverFirstName = (driverProfile as any)?.full_name?.split(" ")[0] || "Entregador";
  const tabs = isStoreDriver
    ? [{ key: "entregas" as TabType, label: "Entregas", icon: Bike }]
    : [
        { key: "entregas" as TabType, label: "Entregas", icon: Bike },
        { key: "historico" as TabType, label: "Ganhos", icon: BarChart3 },
        { key: "config" as TabType, label: "Pix", icon: CreditCard },
      ];

  const NavigationLinks = ({ target }: { target: NavTarget }) => {
    return (
      <div className="flex gap-2 mt-2">
        <a href={buildGoogleMapsUrl(target)} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-[0.97] transition-all">
          <Navigation className="h-3.5 w-3.5" /> Google Maps
        </a>
        <a href={buildWazeUrl(target)} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-[0.97] transition-all">
          <Navigation className="h-3.5 w-3.5" /> Waze
        </a>
      </div>
    );
  };

  return (
    <>
    <DriverPersistentAlert
      availableCount={availableOrders?.length || 0}
      hasActiveDelivery={!!myDelivery || !!pendingReturn}
      isOnline={isOnline}
      onReview={() => setActiveTab("entregas")}
    />
    <div className="min-h-screen bg-background text-foreground pb-[5.5rem] native-app">
      {/* ═══════════ Premium Header ═══════════ */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border pt-safe">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center relative">
                <Bike className="h-5 w-5 text-primary" />
                {isOnline && realtimeConnected && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card animate-pulse" />
                )}
              </div>
              <div>
                <h1 className="font-black text-base text-foreground leading-tight">{driverFirstName}</h1>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {isStoreDriver
                    ? "Motoboy da Loja"
                    : isOnline ? (realtimeConnected ? "Online • Recebendo pedidos" : "Conectando...") : "Offline"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {!isStoreDriver && (
                <button
                  onClick={toggleOnline}
                  data-tour="motoboy-status"
                  className={`relative w-[54px] h-[32px] rounded-full transition-all duration-300 ${isOnline ? "bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]" : "bg-muted"}`}
                >
                  <span className={`absolute top-[3px] w-[26px] h-[26px] rounded-full bg-white shadow-lg transition-transform duration-300 ${isOnline ? "left-[25px]" : "left-[3px]"}`} />
                </button>
              )}
              <SignOutConfirm
                redirectTo="/portal-parceiro"
                triggerClassName="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95"
                triggerTitle="Sair"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ Content ═══════════ */}
      <div className="flex-1">

      {/* ═══════════ TAB: ENTREGAS ═══════════ */}
      {activeTab === "entregas" && (
        <>
          {isStoreDriver ? (
            <StoreDriverView linkedStoreIds={linkedStoreIds} />
          ) : !isOnline ? (
            <EmptyState
              icon={Bike}
              title="Você está offline"
              subtitle="Ative o modo online no topo da tela para começar a receber entregas."
            />
          ) : (
            <div className="px-4 py-4 space-y-5">
              {/* ─── Store Invitations ─── */}
              {pendingStoreLinks.length > 0 && (
                <div className="space-y-3">
                  <SectionHeader icon={Bell}>Convites de Loja</SectionHeader>
                  {pendingStoreLinks.map((link: any) => (
                    <div key={link.id} className="bg-card border-2 border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Store className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Novo convite de:</p>
                          <p className="text-lg font-black text-foreground truncate">{link.stores?.name}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Esta loja quer que você faça parte da equipe de entregadores deles. Você poderá ver e aceitar pedidos exclusivos desta loja.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptInvitation(link.id)}
                          disabled={!!acceptingInvite}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          {acceptingInvite === link.id ? "Aceitando..." : "ACEITAR"}
                        </button>
                        <button
                          onClick={() => rejectInvitation(link.id)}
                          className="px-4 bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                        >
                          RECUSAR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Stats Row */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={DollarSign} label="Hoje" value={`R$${todayEarnings.toFixed(0)}`} accent="green" />
                <StatCard icon={TrendingUp} label="Semana" value={`R$${weekEarnings.toFixed(0)}`} accent="blue" />
                <StatCard icon={Package} label="Entregas" value={String(totalDeliveries)} accent="primary" />
                <StatCard icon={Store} label="Abertas" value={String(openPlatformStores?.length || 0)} accent="emerald" />
              </div>

              {/* Pix key warning */}
              {!(driverProfile as any)?.pix_key && (
                <button
                  onClick={() => setActiveTab("config")}
                  className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-foreground">Cadastre sua chave Pix</p>
                    <p className="text-xs text-muted-foreground">Para receber pagamentos automáticos</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-500" />
                </button>
              )}

              {/* ─── Active Delivery Card ─── */}
              {myDelivery && (
                <div className="bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-lg shadow-primary/5">
                  {/* Status Banner */}
                  <div className={`px-4 py-3 flex items-center gap-2.5 ${
                    (myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega'
                      ? "bg-green-500/10"
                      : "bg-primary/10"
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      (myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega'
                        ? "bg-green-500/20"
                        : "bg-primary/20"
                    }`}>
                      <Navigation className={`h-4 w-4 ${
                        (myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega'
                          ? "text-green-500"
                          : "text-primary"
                      }`} />
                    </div>
                    <span className={`text-sm font-black tracking-wide ${
                      (myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega'
                        ? "text-green-600 dark:text-green-400"
                        : "text-primary"
                    }`}>
                      {(myDelivery as any).status === 'pronto_para_entrega' && !(myDelivery as any).collection_validated
                        ? "A CAMINHO DA LOJA"
                        : "ENTREGA EM ANDAMENTO"}
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Store info - before collection */}
                    {!(myDelivery as any).collection_validated && (myDelivery as any).status === 'pronto_para_entrega' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-foreground">{(myDelivery as any).stores?.name || "Loja"}</span>
                            {(() => {
                              const s = (myDelivery as any).stores;
                              const storeAddr = s?.address_street
                                ? `${s.address_street}${s.address_number ? `, ${s.address_number}` : ""} - ${s.address_neighborhood || ""}, ${s.address_city || "Itatinga"}`
                                : null;
                              if (!storeAddr) return null;
                              return (
                                <>
                                  <p className="text-xs text-muted-foreground mt-0.5">{storeAddr}</p>
                                  <NavigationLinks target={{
                                    street: s.address_street,
                                    number: s.address_number,
                                    neighborhood: s.address_neighborhood,
                                    city: s.address_city || "Itatinga",
                                    state: s.address_state || "SP",
                                    cep: s.address_cep,
                                    fallbackAddress: storeAddr,
                                  }} />
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* WhatsApp lojista */}
                        {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryStoreOwnerId)}
                            message={`Olá! Sou o motoboy do ItaSuper. Estou a caminho para coletar o pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`}
                            label="Falar com Lojista"
                            size="sm"
                          />
                        )}

                        {/* Collection code */}
                        <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">Validar Coleta</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Peça o código de 4 dígitos ao lojista.</p>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="• • • •"
                            value={collectionCodeInput}
                            onChange={(e) => setCollectionCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="w-full text-center text-3xl font-black tracking-[0.5em] bg-card border-2 border-primary/20 rounded-2xl py-4 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary transition-colors"
                          />
                          <button
                            onClick={() => validateCollection(myDelivery.id)}
                            disabled={collectionCodeInput.length !== 4 || verifyingCollection}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {verifyingCollection ? "Validando..." : "Confirmar Coleta"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* After collection - delivery phase */}
                    {((myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega' || (myDelivery as any).status === 'em_transito') && (
                      <div className="space-y-4">
                        {/* Customer address */}
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="h-5 w-5 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-medium">Endereço de entrega</p>
                            <p className="text-sm text-foreground font-semibold mt-0.5">{myDelivery.neighborhood}</p>
                            <p className="text-xs text-muted-foreground">{myDelivery.address_details}</p>
                            <NavigationLinks target={{
                              lat: (myDelivery as any).client_lat,
                              lng: (myDelivery as any).client_lng,
                              fallbackAddress: myDelivery.address_details,
                              neighborhood: myDelivery.neighborhood,
                              city: (myDelivery as any).stores?.address_city,
                              state: (myDelivery as any).stores?.address_state,
                            }} />
                          </div>
                        </div>

                        {/* WhatsApp cliente */}
                        {deliveryClientId && getContactWhatsApp(deliveryClientId) && (
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryClientId)}
                            message={`Olá! Sou o motoboy do ItaSuper. Estou a caminho com seu pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`}
                            label="Falar com Cliente"
                            size="sm"
                          />
                        )}

                        {/* Order items */}
                        <div className="bg-muted/50 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2">Itens do pedido</p>
                          <div className="space-y-1">
                            {(myDelivery as any).order_items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span className="text-foreground">{item.quantity}x {getOrderItemDisplayName(item)}</span>
                                <span className="text-muted-foreground">{formatBRL((item.quantity * item.unit_price))}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payment & fee info */}
                        <div className="flex items-center justify-between bg-green-500/10 rounded-2xl px-4 py-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Sua taxa</p>
                            <p className="text-xl font-black text-green-500">{formatBRL(Number(myDelivery.delivery_fee))}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Pagamento</p>
                            <p className="text-sm font-bold text-foreground">
                              {myDelivery.payment_method === "pix" ? "📱 PIX" : myDelivery.payment_method === "dinheiro" ? "💵 Dinheiro" : myDelivery.payment_method === "cartao" ? "💳 Cartão" : myDelivery.payment_method}
                            </p>
                          </div>
                        </div>

                        {/* Delivery PIN */}
                        <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-bold text-foreground">Confirmar Entrega</span>
                          </div>
                           <p className="text-xs font-bold text-green-600 dark:text-green-400">Peça o código de 4 dígitos ao cliente.</p>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="• • • •"
                            value={pinInput}
                           onChange={(e) => {
                             const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                             setPinInput(val);
                             if (val.length === 4) {
                               finishDelivery(myDelivery.id, val);
                             }
                           }}
                             className="w-full text-center text-3xl font-black tracking-[0.5em] bg-card border-4 border-green-500/50 rounded-2xl py-6 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-green-600 transition-all shadow-inner"
                          />
                          <button
                            onClick={() => finishDelivery(myDelivery.id)}
                            disabled={pinInput.length !== 4 || verifying}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {verifying ? "Verificando..." : "Finalizar Entrega"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Pending Return ─── */}
              {pendingReturn && (
                <div className="bg-card border-2 border-amber-500/30 rounded-2xl overflow-hidden shadow-lg shadow-amber-500/5">
                  <div className="bg-amber-500/10 px-4 py-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Store className="h-4 w-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-400 tracking-wide">RETORNO À LOJA</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Entregue <span className="font-bold text-amber-500">{formatBRL(Number(pendingReturn.total_price))}</span> na loja <span className="font-bold text-foreground">{(pendingReturn as any).stores?.name}</span> e receba sua taxa.
                    </p>
                    {(() => {
                      const s = (pendingReturn as any).stores;
                      const storeAddr = s?.address_street
                        ? `${s.address_street}${s.address_number ? `, ${s.address_number}` : ""} - ${s.address_neighborhood || ""}, ${s.address_city || "Itatinga"}`
                        : null;
                      if (!storeAddr) return null;
                      return (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{storeAddr}</p>
                          <NavigationLinks target={{
                            street: s.address_street,
                            number: s.address_number,
                            neighborhood: s.address_neighborhood,
                            city: s.address_city || "Itatinga",
                            state: s.address_state || "SP",
                            cep: s.address_cep,
                            fallbackAddress: storeAddr,
                          }} />
                        </div>
                      );
                    })()}
                     <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20 space-y-3">
                       <label className="text-xs font-bold text-amber-600 dark:text-amber-400 block text-center uppercase tracking-wider">🔐 Código de Acerto</label>
                       <input
                         type="text"
                         inputMode="numeric"
                         maxLength={4}
                         value={settlementCodeInput}
                         onChange={(e) => setSettlementCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                         placeholder="• • • •"
                         className="w-full text-center text-3xl font-black tracking-[0.5em] bg-card border-4 border-amber-500/50 rounded-2xl py-6 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-amber-600 transition-all shadow-inner"
                       />
                     </div>
                    <button
                      onClick={() => confirmStoreReturn(pendingReturn.id)}
                      disabled={settlementCodeInput.length !== 4 || confirmingReturn}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {confirmingReturn ? "Validando..." : "Confirmar Acerto"}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Available Orders ─── */}
              {!myDelivery && !pendingReturn && (
                <>
                  <SectionHeader icon={Package}>Entregas Disponíveis</SectionHeader>
                  {loadingAvailable ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse space-y-3">
                          <div className="h-5 bg-muted rounded-lg w-1/2" />
                          <div className="h-4 bg-muted rounded-lg w-3/4" />
                          <div className="h-12 bg-muted rounded-xl" />
                        </div>
                      ))}
                    </div>
                  ) : availableOrders && availableOrders.length > 0 ? (
                    <div className="space-y-3">
                      {availableOrders.map((order: any) => (
                        <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors">
                          <div className="p-4 space-y-3">
                            {/* Store */}
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Store className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-foreground">{order.stores?.name || "Loja"}</span>
                                <p className="text-[10px] text-muted-foreground">Pedido #{order.id.slice(0, 6).toUpperCase()}</p>
                              </div>
                            </div>

                            {/* Address */}
                            <div className="flex items-start gap-2.5 bg-muted/50 rounded-xl p-3">
                              <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="text-sm font-semibold text-foreground">{order.neighborhood}</span>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{order.address_details}</p>
                              </div>
                            </div>

                            {/* Items */}
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                              {order.order_items?.map((item: any) => (
                                <span key={item.id}>{item.quantity}x {getOrderItemDisplayName(item)}</span>
                              ))}
                            </div>

                            {/* Fee + Accept */}
                            <div className="flex items-center justify-between pt-3 border-t border-border">
                              <div>
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Ganho</p>
                                <p className="text-2xl font-black text-green-500">{formatBRL(Number(order.delivery_fee))}</p>
                              </div>
                              <button
                                onClick={() => acceptOrder(order.id)}
                                disabled={!!acceptingOrderId}
                                className="bg-primary text-primary-foreground font-bold px-7 py-3.5 rounded-2xl text-sm active:scale-[0.97] transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70"
                              >
                                {acceptingOrderId === order.id ? "Aceitando..." : <>ACEITAR <ArrowRight className="h-4 w-4" /></>}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Package}
                      title="Aguardando pedidos..."
                      subtitle="Quando uma loja tiver um pedido pronto, ele aparecerá aqui. 🏍️"
                    />
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════ TAB: PIX CONFIG ═══════════ */}
      {activeTab === "config" && (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="bg-primary/5 px-4 py-4 flex items-center gap-3 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Minha Chave Pix</h2>
                <p className="text-[11px] text-muted-foreground">Recebimentos instantâneos</p>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Tipo da Chave</label>
                <select
                  value={pixType}
                  onChange={e => setPixType(e.target.value)}
                  className="w-full bg-muted text-foreground border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(PIX_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Chave Pix</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  placeholder={pixType === "cpf" ? "000.000.000-00" : pixType === "email" ? "seuemail@email.com" : pixType === "phone" ? "+55 14 99999-9999" : "Cole sua chave aqui"}
                  className="w-full bg-muted text-foreground border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={savePixKey}
                disabled={savingPix || !pixKey.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingPix ? "Salvando..." : "Salvar Chave Pix"}
              </button>
            </div>
          </div>

          {(driverProfile as any)?.pix_key && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-bold text-green-500">Chave Pix Cadastrada</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tipo: <span className="text-foreground font-medium">{PIX_TYPE_LABELS[(driverProfile as any).pix_type] || "CPF"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Chave: <span className="text-foreground font-medium">{(driverProfile as any).pix_key}</span>
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Como funciona?
            </h3>
            <div className="space-y-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-bold text-foreground mb-0.5">Pedidos via Pix/App</p>
                  <p>A taxa é transferida automaticamente para sua chave Pix.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Banknote className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="font-bold text-foreground mb-0.5">Dinheiro/Cartão</p>
                  <p>Você recebe a taxa em mãos ao retornar à loja.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground mb-0.5">Acompanhamento</p>
                  <p>Na aba "Ganhos" veja seu histórico detalhado.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TAB: GANHOS ═══════════ */}
      {activeTab === "historico" && (
        <div className="px-4 py-4 space-y-4">
          {/* Wallet Card */}
          {driverBalance && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-primary/5 px-4 py-4 flex items-center gap-3 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Minha Carteira</h2>
                  <p className="text-[11px] text-muted-foreground">Saldo e pagamentos</p>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center bg-muted/50 rounded-xl py-3">
                    <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">Total</p>
                    <p className="text-base font-black text-foreground">{formatBRL(Number(driverBalance.total_earned || 0))}</p>
                  </div>
                  <div className="text-center bg-amber-500/5 rounded-xl py-3">
                    <p className="text-[10px] text-amber-500 font-semibold mb-0.5">Pendente</p>
                    <p className="text-base font-black text-amber-500">{formatBRL(Number(driverBalance.pending_amount || 0))}</p>
                  </div>
                  <div className="text-center bg-green-500/5 rounded-xl py-3">
                    <p className="text-[10px] text-green-500 font-semibold mb-0.5">Pago</p>
                    <p className="text-base font-black text-green-500">{formatBRL(Number(driverBalance.paid_amount || 0))}</p>
                  </div>
                </div>

                {/* Withdrawal */}
                {pendingWithdrawal ? (
                  <div className="space-y-3">
                    <button disabled className="w-full bg-muted text-muted-foreground font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-70">
                      <Clock className="h-4 w-4" /> SAQUE EM ANÁLISE
                    </button>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-500">
                        Solicitação <span className="font-bold">#{pendingWithdrawal.transaction_code}</span> recebida. Pagamento em breve.
                      </p>
                    </div>
                  </div>
                ) : Number(driverBalance.pending_amount || 0) > 0 && (driverProfile as any)?.pix_key ? (
                  <button
                    disabled={requestingSaque}
                    onClick={async () => {
                      setRequestingSaque(true);
                      try {
                        const amount = Number(driverBalance.pending_amount);
                        const { data, error } = await supabase.functions.invoke("create-withdrawal-request", {
                          body: { amount, pix_key: (driverProfile as any).pix_key, pix_type: (driverProfile as any).pix_type || "cpf" },
                        });
                        if (error) throw error;
                        if (data?.error) {
                          if (data?.active_request) toast.warning(`Solicitação de ${formatBRL(Number(data.active_request.amount))} em andamento.`);
                          else if (data?.limit_reached) toast.warning(data.error, { duration: 8000 });
                          else throw new Error(data.error);
                          return;
                        }
                        toast.success(`✅ Solicitação enviada! ID #${data?.request?.transaction_code} | ${formatBRL(amount)}.`);
                        queryClient.invalidateQueries({ queryKey: ["driver-balance"] });
                        queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
                        queryClient.invalidateQueries({ queryKey: ["withdrawal-history"] });
                      } catch (err: any) {
                        toast.error(err?.message || "Erro ao solicitar saque.");
                        queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
                      } finally { setRequestingSaque(false); }
                    }}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                  >
                    <DollarSign className="h-4 w-4" />
                    {requestingSaque ? "PROCESSANDO..." : "SOLICITAR PAGAMENTO (PIX)"}
                  </button>
                ) : Number(driverBalance.pending_amount || 0) > 0 && !(driverProfile as any)?.pix_key ? (
                  <button
                    onClick={() => setActiveTab("config")}
                    className="w-full bg-amber-500/10 text-amber-500 font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" /> Cadastre sua chave PIX para solicitar saque
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2">
            <StatCard icon={DollarSign} label="Hoje" value={`R$${todayEarnings.toFixed(0)}`} accent="green" />
            <StatCard icon={TrendingUp} label="Semana" value={`R$${weekEarnings.toFixed(0)}`} accent="blue" />
            <StatCard icon={Package} label="Total" value={String(totalDeliveries)} accent="primary" />
            <StatCard icon={Store} label="Abertas" value={String(openPlatformStores?.length || 0)} accent="emerald" />
          </div>

          {/* Date filter */}
          <div className="flex gap-2 bg-muted/50 p-1.5 rounded-2xl">
            {([
              { key: "hoje" as DateFilter, label: "Hoje" },
              { key: "semana" as DateFilter, label: "7 dias" },
              { key: "mes" as DateFilter, label: "30 dias" },
              { key: "custom" as DateFilter, label: "Todos" },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${dateFilter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Earnings Breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground font-semibold">Pix App</p>
              </div>
              <p className="text-lg font-black text-green-500">{formatBRL(Number(driverBalance?.pending_amount || 0))}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{earningsBreakdown.pixCount} entregas</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Banknote className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground font-semibold">Dinheiro</p>
              </div>
              <p className="text-lg font-black text-amber-500">{formatBRL(earningsBreakdown.cashEarnings)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{earningsBreakdown.cashCount} entregas</p>
            </div>
          </div>

          {/* Total banner */}
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total no período</p>
              <p className="text-2xl font-black text-green-500">{formatBRL(filteredEarnings)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredHistory.length} entregas realizadas</p>
            </div>
            <button
              onClick={exportSummary}
              className="w-12 h-12 bg-muted hover:bg-muted/80 text-foreground rounded-2xl flex items-center justify-center active:scale-95 transition-all"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Withdrawal History */}
          {withdrawalHistory && withdrawalHistory.length > 0 && (
            <>
              <SectionHeader icon={Wallet}>Histórico de Saques</SectionHeader>
              <div className="space-y-2">
                {withdrawalHistory.map((w: any) => (
                  <div key={w.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{w.transaction_code || "#---"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-foreground">{formatBRL(Number(w.amount))}</p>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg inline-block mt-0.5 ${w.status === "solicitado" ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"}`}>
                        {w.status === "solicitado" ? "⏳ Pendente" : "✅ Pago"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Delivery History */}
          <SectionHeader icon={Clock}>Histórico de Corridas</SectionHeader>

          {loadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded-lg w-1/3" />
                  <div className="h-3 bg-muted rounded-lg w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-2">
              {filteredHistory.map((order: any) => {
                const isRural = RURAL_NEIGHBORHOODS.some(n => order.neighborhood?.toLowerCase().includes(n.toLowerCase()));
                const orderDate = parseISO(order.confirmed_at || order.created_at);
                const isCash = order.payment_method === "dinheiro";
                return (
                  <div key={order.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm text-foreground font-bold truncate">{(order as any).stores?.name || "Loja"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(orderDate, "dd/MM HH:mm", { locale: ptBR })}</span>
                        <span className="text-border">•</span>
                        <span className="truncate">{order.neighborhood}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isRural ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                          {isRural ? "Rural" : "Urbano"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isCash ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"}`}>
                          {isCash ? "💵 Dinheiro" : "📱 Pix"}
                        </span>
                      </div>
                    </div>
                    <p className="text-lg font-black text-green-500 ml-2">{formatBRL(Number(order.delivery_fee))}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="Nenhuma entrega neste período"
              subtitle="Suas entregas finalizadas aparecerão aqui."
            />
          )}
        </div>
      )}

      </div>{/* End content wrapper */}

      {/* ═══════════ Bottom Tab Bar ═══════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border pb-safe" data-tour="motoboy-entregas">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-tour={tab.key === "historico" ? "motoboy-ganhos" : tab.key === "entregas" ? "motoboy-nav" : undefined}
                className={`flex flex-col items-center gap-1 px-5 py-2 transition-all rounded-xl relative`}
              >
                <div className={`p-2 rounded-2xl transition-all ${isActive ? "bg-primary/10" : ""}`}>
                  <tab.icon className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className={`text-[10px] font-bold transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
      <ProductTour steps={motoboyTourSteps} tourKey="motoboy" />
    </>
  );
};

export default DriverDashboard;
