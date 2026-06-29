import { formatBRL } from "@/lib/utils";
import { startDriverTracking, stopDriverTracking, updateTrackingOrderId } from "@/lib/driverGeolocation";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  addToQueue, syncQueue, removeFromQueue, getQueue,
  addGpsToQueue, flushGpsQueue
} from "@/lib/offlineDeliveryQueue";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { notifyOrderStatusChange } from "@/lib/orderNotifications";
import confetti from "canvas-confetti";
import {
  Bike, MapPin, Navigation, KeyRound, CheckCircle2, Package,
  Store, ChevronRight, Route, Clock, User, Phone, ArrowRight,
  Loader2, Zap, Wallet, Power, PowerOff, X, AlertTriangle
} from "lucide-react";

const DECLINED_TTL_MS = 1000 * 60 * 60 * 6; // 6h
const declinedKey = (uid: string) => `store_driver_declined_${uid}`;
const createFallbackDriverStatus = (isOnline = false) => ({ user_id: "", is_online: isOnline });
const loadDeclined = (uid: string): Record<string, number> => {
  try {
    const raw = localStorage.getItem(declinedKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    Object.entries(parsed).forEach(([k, v]) => { if (now - v < DECLINED_TTL_MS) cleaned[k] = v; });
    return cleaned;
  } catch { return {}; }
};
const saveDeclined = (uid: string, map: Record<string, number>) => {
  try { localStorage.setItem(declinedKey(uid), JSON.stringify(map)); } catch {}
};

import WhatsAppButton from "@/components/WhatsAppButton";
import { PinBoxes } from "@/components/driver/PinBoxes";
import { DriverOnlineToggle } from "@/components/driver/DriverOnlineToggle";
import StoreDriverEarnings from "@/components/StoreDriverEarnings";
import DriverRideHistory from "@/components/DriverRideHistory";
import { haptic } from "@/lib/haptics";
import {
  initDriverBackgroundFetch,
  setDriverBackgroundOnline,
  setDriverBackgroundStores,
} from "@/lib/driverBackgroundFetch";


/* ── Helpers ── */
import {
  buildWazeUrl,
  buildGoogleMapsUrl,
  buildGoogleMapsMultiStopUrl,
  buildPreferredNavUrl,
  getPreferredNavigator,
  setPreferredNavigator,
  type NavApp,
  type NavTarget,
} from "@/lib/navUrls";
import { optimizeRouteOsrm } from "@/lib/osrmRouting";
import { startArrivalWatch, stopArrivalWatch } from "@/lib/arrivalGeofence";

const NavigationLinks = ({ target }: { target: NavTarget }) => {
  return (
    <div className="flex gap-2 mt-2">
      <a href={buildGoogleMapsUrl(target)} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-2.5 rounded-xl active:scale-[0.97] transition-all">
        <Navigation className="h-3.5 w-3.5" /> Google Maps
      </a>
      <a href={buildWazeUrl(target)} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 bg-success/10 text-success text-xs font-bold px-3 py-2.5 rounded-xl active:scale-[0.97] transition-all">
        <Navigation className="h-3.5 w-3.5" /> Waze
      </a>
    </div>
  );
};

/**
 * Coordinate-based nearest-neighbor route optimization for Itatinga.
 * Uses client lat/lng when available, falls back to neighborhood centroids.
 * Haversine distance for accurate proximity sorting.
 */

// Approximate centroids for Itatinga neighborhoods (lat, lng)
const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  "centro": [-23.1019, -48.6158],
  "vila são joão": [-23.1045, -48.6205],
  "jardim pedra branca": [-23.0975, -48.6230],
  "vila claro": [-23.1060, -48.6130],
  "vila são domingos": [-23.1080, -48.6180],
  "jardim cidade serrana": [-23.0950, -48.6100],
  "jardim parenti": [-23.1035, -48.6095],
  "vila canaã": [-23.1100, -48.6220],
  "jardim do éden": [-23.0990, -48.6070],
  "villa di alberi": [-23.0960, -48.6145],
  "residencial nunes": [-23.1070, -48.6105],
  "jardim marajoara": [-23.1120, -48.6150],
  "vila previsul": [-23.1005, -48.6190],
  "distrito do lobo": [-23.0650, -48.5800],
  "recanto dos cambarás": [-23.0930, -48.6060],
  "engenheiro serra": [-23.0700, -48.5900],
  "vila dos lavradores": [-23.1040, -48.6250],
  "entorno do cdp": [-23.1090, -48.6080],
  "fazendas/sítios (geral)": [-23.0800, -48.5950],
};

// Store default location (ItaSuper Pizzaria approximate)
const STORE_DEFAULT: [number, number] = [-23.1019, -48.6158];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getOrderCoords(order: any): [number, number] | null {
  // Prefer actual client coordinates
  if (order.client_lat && order.client_lng) {
    return [order.client_lat, order.client_lng];
  }
  // Fall back to neighborhood centroid
  const hood = (order.neighborhood || "").toLowerCase().trim();
  return NEIGHBORHOOD_COORDS[hood] || null;
}

function optimizeRoute(orders: any[], storeCoords?: [number, number]): any[] {
  if (orders.length <= 1) return orders;

  const start = storeCoords || STORE_DEFAULT;

  // Separate orders with and without coordinates
  const withCoords: { order: any; coords: [number, number] }[] = [];
  const withoutCoords: any[] = [];

  orders.forEach((o) => {
    const coords = getOrderCoords(o);
    if (coords) {
      withCoords.push({ order: o, coords });
    } else {
      withoutCoords.push(o);
    }
  });

  if (withCoords.length === 0) {
    // Pure fallback: group by neighborhood alphabetically
    const groups: Record<string, any[]> = {};
    orders.forEach((o) => {
      const key = (o.neighborhood || "outros").toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return Object.values(groups).flat();
  }

  // Nearest-neighbor TSP starting from store location
  const sorted: { order: any; coords: [number, number] }[] = [];
  const remaining = [...withCoords];

  // Start from the store: find nearest order to store
  let currentPos = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((item, i) => {
      const dist = haversineKm(currentPos[0], currentPos[1], item.coords[0], item.coords[1]);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    });
    const nearest = remaining.splice(nearestIdx, 1)[0];
    sorted.push(nearest);
    currentPos = nearest.coords;
  }

  // 2-opt improvement pass for small sets
  if (sorted.length >= 4 && sorted.length <= 20) {
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 50) {
      improved = false;
      iterations++;
      for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 2; j < sorted.length; j++) {
          const a = i === 0 ? start : sorted[i - 1].coords;
          const b = sorted[i].coords;
          const c = sorted[j].coords;
          const d = j + 1 < sorted.length ? sorted[j + 1].coords : sorted[j].coords;

          const currentDist = haversineKm(a[0], a[1], b[0], b[1]) + haversineKm(c[0], c[1], d[0], d[1]);
          const newDist = haversineKm(a[0], a[1], c[0], c[1]) + haversineKm(b[0], b[1], d[0], d[1]);

          if (newDist < currentDist - 0.01) {
            // Reverse the segment between i and j
            const segment = sorted.slice(i, j + 1).reverse();
            sorted.splice(i, j - i + 1, ...segment);
            improved = true;
          }
        }
      }
    }
  }

  const result = sorted.map((s) => s.order);
  // Append orders without coordinates at the end
  result.push(...withoutCoords);
  return result;
}

/** Calculate total route distance in km */
function calculateRouteDistance(orders: any[], storeCoords?: [number, number]): number {
  const start = storeCoords || STORE_DEFAULT;
  let total = 0;
  let current = start;
  orders.forEach((o) => {
    const coords = getOrderCoords(o);
    if (coords) {
      total += haversineKm(current[0], current[1], coords[0], coords[1]);
      current = coords;
    }
  });
  return total;
}

interface StoreDriverViewProps {
  linkedStoreIds: string[];
}

const StoreDriverView = ({ linkedStoreIds }: StoreDriverViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const { connected } = useNetworkStatus();
  const [offlineQueue, setOfflineQueue] = useState(getQueue());
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [useOptimized, setUseOptimized] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"routes" | "earnings" | "history">("routes");
  const [declinedMap, setDeclinedMap] = useState<Record<string, number>>(() => user ? loadDeclined(user.id) : {});
  const [navApp, setNavApp] = useState<NavApp>(() => getPreferredNavigator());
  const [osrmOrder, setOsrmOrder] = useState<Record<string, number>>({}); // orderId -> posição otimizada
  const [osrmStats, setOsrmStats] = useState<{ km: number; min: number } | null>(null);
  const [arrivedOrderId, setArrivedOrderId] = useState<string | null>(null);

  const chooseNavApp = useCallback((app: NavApp) => {
    setNavApp(app);
    setPreferredNavigator(app);
  }, []);

  const multiStore = linkedStoreIds.length > 1;

  // Count drivers per linked store (to show decline button only when 2+)
  const { data: storeDriverCounts } = useQuery<Record<string, number>>({
    queryKey: ["store-driver-counts", linkedStoreIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_drivers")
        .select("store_id")
        .in("store_id", linkedStoreIds);
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.store_id] = (counts[r.store_id] || 0) + 1; });
      return counts;
    },
    enabled: linkedStoreIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch store names and coordinates
  const { data: storeNames } = useQuery<{id: string; name: string; latitude: number | null; longitude: number | null; driver_pin_autofill?: boolean}[]>({
    queryKey: ["store-driver-store-names", linkedStoreIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores_driver_view" as any)
        .select("id, name, latitude, longitude, driver_pin_autofill")
        .in("id", linkedStoreIds);
      return (data as any) || [];
    },
    enabled: linkedStoreIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch perfil do driver (para verificar pix_key etc)
  const { data: driverProfile } = useQuery({
    queryKey: ["store-driver-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, pix_key, avatar_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Fetch own driver status (online/offline)
  const { data: driverStatus } = useQuery({
    queryKey: ["store-driver-online-status", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("user_id, is_online")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as any) || createFallbackDriverStatus();
    },
    enabled: !!user,
    staleTime: 1000 * 15,
  });
  const isOnline = !!driverStatus?.is_online;
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Fetch all available orders for linked stores (only when online)
  // Includes: open orders (no assignment) + orders specifically assigned to me
  const { data: availableOrders, isLoading: loadingAvailable } = useQuery({
    queryKey: ["store-driver-available", linkedStoreIds, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, address_street, address_number, address_neighborhood, address_city, address_state), order_items(*, products(name))")
        .in("store_id", linkedStoreIds)
        .eq("status", "pronto_para_entrega" as any)
        .is("driver_id", null)
        .or(`assigned_driver_id.is.null,assigned_driver_id.eq.${user!.id}`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: linkedStoreIds.length > 0 && isOnline && !!user,
    staleTime: 15_000,
    // Realtime é a fonte primária. Polling só como fallback raro p/ NAT/WS quebrado.
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
  });

  // Fetch my active deliveries
  const { data: myDeliveries } = useQuery({
    queryKey: ["store-driver-my-deliveries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, owner_id, address_street, address_number, address_neighborhood, address_city, address_state), order_items(*, products(name))")
        .eq("driver_id", user!.id)
        .in("status", ["pronto_para_entrega", "saiu_entrega", "em_transito"] as any)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
  });

  // Fetch contact profiles
  const clientIds = useMemo(() => {
    const ids = [
      ...(myDeliveries || []).map((o: any) => o.client_id),
      ...(availableOrders || []).map((o: any) => o.client_id),
    ];
    return [...new Set(ids.filter(Boolean))];
  }, [myDeliveries, availableOrders]);

  const { data: contactProfiles } = useQuery({
    queryKey: ["store-driver-contacts", clientIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_contacts")
        .select("user_id, whatsapp_number, phone, full_name")
        .in("user_id", clientIds);
      return data || [];
    },
    enabled: clientIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const { data: whatsappConfigs } = useQuery({
    queryKey: ["store-driver-whatsapp-configs", linkedStoreIds],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_whatsapp_config")
        .select("store_id, status")
        .in("store_id", linkedStoreIds);
      return data || [];
    },
    enabled: linkedStoreIds.length > 0,
    staleTime: 30_000,
  });

  // Delivery count
  const { data: deliveryCount } = useQuery({
    queryKey: ["store-driver-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", user!.id)
        .eq("status", "finalizado" as any);
      return count || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const getContact = useCallback((userId: string) => {
    return contactProfiles?.find((c: any) => c.user_id === userId);
  }, [contactProfiles]);

  // Realtime: 1 único canal com N listeners (um por store) — reduz websocket
  // overhead vs criar N canais. Faz updates otimistas no cache do React Query
  // e cai pra invalidate só quando precisa de joins (ex.: novo pedido para mim).
  useEffect(() => {
    if (!linkedStoreIds.length || !user) return;

    const channel = supabase.channel(`store-driver-rt-${user.id}`);

    linkedStoreIds.forEach((storeId) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
            const updated = payload.new as any;

            if (payload.eventType === "INSERT") {
              queryClient.invalidateQueries({ queryKey: ["store-driver-available", linkedStoreIds, user?.id] });
              toast.info("🔔 Novo pedido disponível!");
              haptic.newOrder();
            } else if (payload.eventType === "UPDATE") {
              // Instant update for available orders
              queryClient.setQueryData(["store-driver-available", linkedStoreIds, user?.id], (old: any[] | undefined) => {
                if (!old) return old;
                // If order was assigned to this driver, move it out of available
                if (updated.driver_id) {
                  return old.filter((o: any) => o.id !== updated.id);
                }
                const idx = old.findIndex((o: any) => o.id === updated.id);
                if (idx >= 0) {
                  if (updated.status !== "pronto_para_entrega" || updated.driver_id) {
                    return old.filter((o: any) => o.id !== updated.id);
                  }
                  const copy = [...old];
                  copy[idx] = { ...copy[idx], ...updated };
                  return copy;
                }
                return old;
              });

              // Instant update for my deliveries
              queryClient.setQueryData(["store-driver-my-deliveries", user.id], (old: any[] | undefined) => {
                if (!old) return old;
                const idx = old.findIndex((o: any) => o.id === updated.id);
                if (idx >= 0) {
                  // If finalized/cancelled, remove from active list
                  if (["finalizado", "entregue", "cancelado"].includes(updated.status)) {
                    return old.filter((o: any) => o.id !== updated.id);
                  }
                  const copy = [...old];
                  copy[idx] = { ...copy[idx], ...updated };
                  return copy;
                }
                // If newly assigned to me, refetch to get full joins
                if (updated.driver_id === user.id && ["pronto_para_entrega", "saiu_entrega", "em_transito"].includes(updated.status)) {
                  queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries", user.id] });
                }
                return old;
              });

              // Update delivery count when finalized
              if (updated.status === "finalizado" && updated.driver_id === user.id) {
                queryClient.invalidateQueries({ queryKey: ["store-driver-count", user.id] });
              }
            }
        }
      );
    });

    subscribeWithRejoin(channel);

    return () => {
      cleanupChannel(channel);
    };
  }, [linkedStoreIds, user, queryClient]);

  useEffect(() => {
    if (!user) return;

    const refreshStoreDriverData = () => {
      queryClient.invalidateQueries({ queryKey: ["store-driver-online-status", user.id] });
      queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries", user.id] });
      queryClient.invalidateQueries({ queryKey: ["store-driver-count", user.id] });
      if (linkedStoreIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["store-driver-store-names", linkedStoreIds] });
        queryClient.invalidateQueries({ queryKey: ["store-driver-available", linkedStoreIds, user.id] });
      }
    };

    window.addEventListener("capacitor-app-resume", refreshStoreDriverData);
    return () => window.removeEventListener("capacitor-app-resume", refreshStoreDriverData);
  }, [user, linkedStoreIds, queryClient]);

  // 📱 Background fetch nativo: registra/atualiza estado do motoboy no
  // runner que roda mesmo com app fechado (Android JobScheduler 15min).
  useEffect(() => {
    if (!user || linkedStoreIds.length === 0) return;
    initDriverBackgroundFetch({
      userId: user.id,
      linkedStoreIds,
      isOnline,
    });
  }, [user?.id, isOnline]);

  useEffect(() => {
    if (!user) return;
    setDriverBackgroundStores(linkedStoreIds);
  }, [linkedStoreIds, user?.id]);

  // Auto-select first store if none selected
  const effectiveStoreId = activeStoreId || linkedStoreIds[0] || null;

  // Get active store coordinates for route optimization
  const activeStoreCoords = useMemo((): [number, number] | undefined => {
    const store = storeNames?.find((s: any) => s.id === effectiveStoreId);
    if (store?.latitude && store?.longitude) return [store.latitude, store.longitude];
    return undefined;
  }, [storeNames, effectiveStoreId]);

  // Filter by selected store when multi-store
  const filteredDeliveries = useMemo(() => {
    if (!myDeliveries) return [];
    const list = multiStore && effectiveStoreId
      ? myDeliveries.filter((o: any) => o.store_id === effectiveStoreId)
      : myDeliveries;
    const base = useOptimized ? optimizeRoute(list, activeStoreCoords) : list;
    // Sobreposição OSRM (rota por ruas): se temos uma ordem refinada para
    // este conjunto, aplicamos. Caso contrário ficamos com a base haversine.
    if (!useOptimized || !Object.keys(osrmOrder).length) return base;
    const hasAll = base.every((o: any) => osrmOrder[o.id] !== undefined);
    if (!hasAll) return base;
    return [...base].sort((a: any, b: any) => osrmOrder[a.id] - osrmOrder[b.id]);
  }, [myDeliveries, multiStore, effectiveStoreId, useOptimized, activeStoreCoords, osrmOrder]);

  const filteredAvailable = useMemo(() => {
    if (!availableOrders) return [];
    const notDeclined = availableOrders.filter((o: any) => !declinedMap[o.id]);
    const list = multiStore && effectiveStoreId
      ? notDeclined.filter((o: any) => o.store_id === effectiveStoreId)
      : notDeclined;
    return useOptimized ? optimizeRoute(list, activeStoreCoords) : list;
  }, [availableOrders, multiStore, effectiveStoreId, useOptimized, activeStoreCoords, declinedMap]);

  // Calculate total route distance
  const routeDistanceKm = useMemo(() => {
    const orders = filteredDeliveries.length > 0 ? filteredDeliveries : filteredAvailable;
    if (!useOptimized || orders.length < 2) return 0;
    if (osrmStats && filteredDeliveries.length > 0) return osrmStats.km;
    return calculateRouteDistance(orders, activeStoreCoords);
  }, [filteredDeliveries, filteredAvailable, useOptimized, activeStoreCoords, osrmStats]);

  // Per-store order counts for badges
  const storeOrderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (myDeliveries || []).forEach((o: any) => { counts[o.store_id] = (counts[o.store_id] || 0) + 1; });
    (availableOrders || []).forEach((o: any) => { counts[o.store_id] = (counts[o.store_id] || 0) + 1; });
    return counts;
  }, [myDeliveries, availableOrders]);

  const getStoreName = (storeId: string) => {
    return storeNames?.find((s: any) => s.id === storeId)?.name || "Loja";
  };

  /** Helper to send push notification from driver to client */
  const notifyClientFromDriver = (order: any, status: string) => {
    if (!order) return;
    const storeName = order.stores?.name || getStoreName(order.store_id) || "Loja";
    const contact = contactProfiles?.find((c: any) => c.user_id === order.client_id);
    const clientPhone = (contact as any)?.whatsapp_number || (contact as any)?.phone || "";
    const clientName = (contact as any)?.full_name || "Cliente";
    const items = order.order_items?.map((i: any) => `${i.quantity}x ${getOrderItemDisplayName(i)}`).join("\n") || "";
    const evolutionConnected = whatsappConfigs?.some((cfg: any) => cfg.store_id === order.store_id && cfg.status === "connected") || false;

    notifyOrderStatusChange(status, {
      orderId: order.id,
      storeName,
      storeId: order.store_id,
      clientId: order.client_id,
      clientPhone,
      clientName,
      totalPrice: Number(order.total_price),
      addressDetails: order.address_details,
      items,
      paymentMethod: order.payment_method,
      deliveryPin: order.delivery_pin,
    }, { evolutionEnabled: evolutionConnected });
  };

  /** Also notify the store owner */
  const notifyStoreOwner = (order: any, title: string, body: string) => {
    if (!order?.stores?.owner_id) return;
    import("@/lib/firebase").then(({ sendPushNotification }) => {
      sendPushNotification(
        [order.stores.owner_id],
        title,
        body,
        { link: "/admin", order_id: order.id }
      ).catch(console.error);
    });
  };

  const toggleOnline = async () => {
    if (!user || togglingOnline) return;
    const next = !isOnline;
    if (!next && (myDeliveries?.length || 0) > 0) {
      toast.error("Você tem entregas ativas! Finalize antes de ficar offline.");
      return;
    }
    haptic.light();
    setTogglingOnline(true);
    const previousStatus = (driverStatus as any) || createFallbackDriverStatus(isOnline);
    const { error } = await supabase
      .from("drivers")
      .update({ is_online: next } as any)
      .eq("user_id", user.id);
    setTogglingOnline(false);
    if (error) {
      queryClient.setQueryData(["store-driver-online-status", user.id], previousStatus);
      toast.error("Não foi possível atualizar status.");
      return;
    }
    queryClient.setQueryData(["store-driver-online-status", user.id], { ...previousStatus, user_id: user.id, is_online: next });
    if (!next) {
      // Clear available orders cache so list disappears immediately
      queryClient.setQueryData(["store-driver-available", linkedStoreIds, user.id], []);
    } else {
      queryClient.invalidateQueries({ queryKey: ["store-driver-available", linkedStoreIds, user.id] });
    }
    toast.success(next ? "Você está ONLINE — recebendo entregas." : "Você está OFFLINE.");
  };

  const declineOrder = (orderId: string) => {
    if (!user) return;
    haptic.light();
    const next = { ...declinedMap, [orderId]: Date.now() };
    setDeclinedMap(next);
    saveDeclined(user.id, next);
    toast.success("Pedido recusado. Outro motoboy poderá aceitar.");
  };

  const acceptOrder = async (orderId: string) => {
    haptic.medium();
    // Optimistic UI: remove from available list immediately
    const availableKey = ["store-driver-available", linkedStoreIds, user?.id];
    const myKey = ["store-driver-my-deliveries", user?.id];
    const previousAvailable = queryClient.getQueryData<any[]>(availableKey);
    const acceptedOrder = (availableOrders || []).find((o: any) => o.id === orderId);
    if (previousAvailable) {
      queryClient.setQueryData(
        availableKey,
        previousAvailable.filter((o: any) => o.id !== orderId),
      );
    }
    // Add to my deliveries cache com status saiu_entrega (RPC já muda no banco)
    if (acceptedOrder) {
      const previousMy = queryClient.getQueryData<any[]>(myKey) || [];
      queryClient.setQueryData(
        myKey,
        [{ ...acceptedOrder, driver_id: user?.id, status: "saiu_entrega" }, ...previousMy],
      );
    }

    const { error } = await supabase.rpc("driver_accept_order", { _order_id: orderId } as any);
    if (error) {
      // Revert
      if (previousAvailable) queryClient.setQueryData(availableKey, previousAvailable);
      queryClient.invalidateQueries({ queryKey: myKey });
      toast.error("Não foi possível aceitar o pedido.");
    } else {
      toast.success("🛵 Saindo para entrega!");
      // Sync with server in background
      queryClient.invalidateQueries({ queryKey: availableKey });
      queryClient.invalidateQueries({ queryKey: myKey });

      // Notify store owner in background
      if (acceptedOrder) {
        const driverName = user?.user_metadata?.full_name || "Entregador";
        notifyStoreOwner(acceptedOrder, "🛵 Saiu para entrega!", `${driverName} aceitou e saiu para entregar o pedido #${orderId.slice(0, 8).toUpperCase()}`);
        notifyClientFromDriver(acceptedOrder, "saiu_entrega");
      }
    }
  };

  const acceptAllFiltered = async () => {
    // Snapshot da lista para evitar mutações durante o loop (realtime/refetch)
    const snapshot = [...filteredAvailable];
    if (!snapshot.length) return;
    let accepted = 0;
    const failures: string[] = [];
    // Aceita em paralelo — cada chamada é independente no servidor
    const results = await Promise.allSettled(
      snapshot.map((order) =>
        supabase.rpc("driver_accept_order", { _order_id: order.id } as any)
      )
    );
    results.forEach((res, idx) => {
      const order = snapshot[idx];
      const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
      if (res.status === "fulfilled" && !(res.value as any)?.error) {
        accepted++;
        const driverName = user?.user_metadata?.full_name || "Entregador";
        notifyStoreOwner(order, "🛵 Entregador aceitou!", `${driverName} aceitou o pedido ${shortId}`);
      } else {
        const msg =
          res.status === "fulfilled"
            ? (res.value as any)?.error?.message
            : (res.reason as any)?.message;
        failures.push(`${shortId}: ${msg || "erro desconhecido"}`);
      }
    });
    if (accepted > 0) toast.success(`${accepted} pedido(s) aceito(s)!`);
    if (failures.length) {
      toast.error(
        `${failures.length} pedido(s) não aceito(s):\n${failures.slice(0, 3).join("\n")}`
      );
    }
    queryClient.invalidateQueries({ queryKey: ["store-driver-available", linkedStoreIds, user?.id] });
    queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries", user?.id] });
  };

  const [departingId, setDepartingId] = useState<string | null>(null);

  const departForDelivery = async (orderId: string) => {
    haptic.medium();
    setDepartingId(orderId);
    // Arma o geofence de chegada (50m) para abrir o card de PIN
    // automaticamente quando o motoboy chegar.
    const order = (filteredDeliveries || []).find((o: any) => o.id === orderId);
    if (order?.client_lat && order?.client_lng) {
      startArrivalWatch(
        { orderId, lat: Number(order.client_lat), lng: Number(order.client_lng), radiusM: 50 },
        (oid) => {
          haptic.heavy();
          setArrivedOrderId(oid);
          setExpandedOrder(oid);
          toast.success("📍 Chegou ao cliente! Peça o PIN de 4 dígitos.", { duration: 8000 });
          setTimeout(() => {
            document.getElementById(`stop-${oid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 250);
        },
      );
    }
    // Optimistic UI: update status in cache immediately
    const myKey = ["store-driver-my-deliveries", user?.id];
    const previousMy = queryClient.getQueryData<any[]>(myKey);
    if (previousMy) {
      queryClient.setQueryData(
        myKey,
        previousMy.map((o: any) => (o.id === orderId ? { ...o, status: "saiu_entrega" } : o)),
      );
    }
    toast.success("🚀 Saiu para entrega!");

    const { error } = await supabase
      .from("orders")
      .update({ status: "saiu_entrega" as any })
      .eq("id", orderId);
    if (error) {
      if (previousMy) queryClient.setQueryData(myKey, previousMy);
      toast.error("Erro ao atualizar status.");
    } else {
      // Notify client in background
      const order = (previousMy || []).find((o: any) => o.id === orderId);
      if (order) notifyClientFromDriver(order, "saiu_entrega");
    }
    setDepartingId(null);
  };

  const departAll = async () => {
    const readyOrders = filteredDeliveries.filter((o: any) => o.status === "pronto_para_entrega");
    if (!readyOrders.length) return;
    setDepartingId("all");
    for (const order of readyOrders) {
      await supabase.from("orders").update({ status: "saiu_entrega" as any }).eq("id", order.id);
      notifyClientFromDriver(order, "saiu_entrega");
    }
    toast.success(`🚀 ${readyOrders.length} pedido(s) saíram para entrega!`);
    queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries", user?.id] });
    setDepartingId(null);
  };

  const finishDelivery = async (orderId: string, overridePin?: string) => {
    const pin = overridePin || pinInputs[orderId];
    if (!pin || pin.length !== 4) { toast.error("Digite o PIN de 4 dígitos."); return; }

    // Sem sinal — validar PIN localmente antes de salvar na fila
    if (!connected) {
      // O pedido já está carregado localmente — validar o PIN aqui mesmo
      const localOrder = myDeliveries?.find((o: any) => o.id === orderId);
      const localPin = (localOrder as any)?.delivery_pin;

      if (localPin && pin !== localPin) {
        // PIN incorreto — avisar imediatamente sem nem salvar na fila
        toast.error("❌ PIN incorreto", {
          description: "Verifique o código com o cliente. Você está sem sinal, mas o PIN pode ser validado localmente.",
          duration: 6000,
        });
        return;
      }

      // PIN correto (ou pedido sem PIN) — salvar na fila
      addToQueue({
        order_id: orderId,
        pin,
        attempted_at: new Date().toISOString(),
        order_number: orderId.slice(0, 8).toUpperCase(),
      });
      setOfflineQueue(getQueue());
      setPinInputs(p => ({ ...p, [orderId]: "" }));
      toast.success("✅ PIN correto — entrega confirmada!", {
        description: "Sem sinal agora. A confirmação será enviada automaticamente quando o sinal voltar.",
        duration: 7000,
      });
      return;
    }

    setVerifyingId(orderId);
    const { error } = await supabase.rpc("driver_finish_delivery", { _order_id: orderId, _pin: pin } as any);
    if (error) {
      toast.error(error.message || "PIN inválido.");
    } else {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      haptic.heavy();
      toast.success("🎉 Entrega confirmada!");
      setPinInputs((prev) => ({ ...prev, [orderId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["store-driver-count", user?.id] });

      // Notify client that order was delivered
      const order = myDeliveries?.find((o: any) => o.id === orderId);
      notifyClientFromDriver(order, "entregue");
    }
    setVerifyingId(null);
  };

  const hasActiveDeliveries = filteredDeliveries.length > 0;
  const hasAvailable = filteredAvailable.length > 0;
  const totalActive = (myDeliveries?.length || 0);
  const totalAvailable = (availableOrders?.length || 0);

  // Block accepting new orders while driver has any active (non-finalized) deliveries
  const hasActiveRoutes = totalActive > 0;

  // (Listener Realtime duplicado removido — consolidado no listener por loja
  // declarado mais acima nesta página, que faz updates de cache mais precisos
  // por store_id, evitando dois canais competindo pela mesma tabela.)

  // GPS tracking for store drivers
  useEffect(() => {
    if (!user) return;
    if (totalActive > 0) {
      const firstOrderId = myDeliveries?.[0]?.id || null;
      startDriverTracking(firstOrderId);
    } else {
      stopDriverTracking();
    }
  }, [user, totalActive, myDeliveries?.[0]?.id]);

  useEffect(() => {
    if (myDeliveries?.length) {
      updateTrackingOrderId(myDeliveries[0]?.id || null);
    }
  }, [myDeliveries?.[0]?.id]);

  /* ─── Fase 1 — OSRM async: refina a rota com distâncias reais por ruas ─── */
  useEffect(() => {
    if (!useOptimized) { setOsrmOrder({}); setOsrmStats(null); return; }
    const list = (filteredDeliveries || []).filter((o: any) => o.client_lat && o.client_lng);
    if (list.length < 2) { setOsrmOrder({}); setOsrmStats(null); return; }
    if (!activeStoreCoords) return;
    let cancelled = false;
    (async () => {
      const result = await optimizeRouteOsrm(
        activeStoreCoords,
        list.map((o: any) => [Number(o.client_lat), Number(o.client_lng)] as [number, number]),
      );
      if (cancelled || !result) return;
      const map: Record<string, number> = {};
      result.order.forEach((origIdx, newPos) => {
        const o = list[origIdx];
        if (o) map[o.id] = newPos;
      });
      setOsrmOrder(map);
      setOsrmStats({ km: result.totalKm, min: result.totalMin });
    })();
    return () => { cancelled = true; };
    // Re-roda quando o conjunto de IDs muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useOptimized, activeStoreCoords?.[0], activeStoreCoords?.[1], (filteredDeliveries || []).map((o: any) => o.id).join("|")]);

  /* Para o geofence quando o motoboy não tem mais entregas em trânsito */
  useEffect(() => {
    const inTransit = (filteredDeliveries || []).some((o: any) => o.status === "saiu_entrega" || o.status === "em_transito");
    if (!inTransit) stopArrivalWatch();
  }, [filteredDeliveries]);


  const hasPix = !!(driverProfile as any)?.pix_key;

  return (
    <div className="px-4 py-4 pb-32 space-y-4">
      <NetworkStatusBanner />

      {/* Confirmações offline pendentes */}
      {offlineQueue.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📵</span>
            <p className="text-xs font-black text-amber-700 dark:text-amber-400">
              {offlineQueue.length} confirmação{offlineQueue.length > 1 ? "ões" : ""} salva{offlineQueue.length > 1 ? "s" : ""} — aguardando sinal
            </p>
          </div>
          {offlineQueue.map(item => (
            <div key={item.order_id} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Pedido #{item.order_number || item.order_id.slice(0, 8).toUpperCase()}</span>
              <span className={syncingQueue ? "text-emerald-600 animate-pulse font-semibold" : "text-muted-foreground"}>
                {syncingQueue ? "Enviando..." : "Aguardando sinal"}
              </span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-1">
            Pode fechar o app — será enviado quando a internet voltar. ✅
          </p>
        </div>
      )}

      {/* ── Online / Offline — HERO toggle (elemento mais proeminente) ── */}
      <DriverOnlineToggle isOnline={isOnline} toggling={togglingOnline} onToggle={toggleOnline} />

      {/* Status Bar — 3 colunas glance-able */}
      <div className="grid grid-cols-3 bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {([
          { label: "Na rota", value: totalActive, accent: "text-primary" },
          { label: "Disponíveis", value: totalAvailable, accent: "text-warning" },
          { label: "Concluídas", value: deliveryCount || 0, accent: "text-success" },
        ] as const).map((s, i) => (
          <div
            key={s.label}
            className={`text-center py-3.5 ${i > 0 ? "border-l border-border/60" : ""}`}
          >
            <p className={`text-2xl font-black leading-none ${s.accent}`}>{s.value}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs — segmented control estilo iOS */}
      <div className="flex bg-muted/50 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("routes")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "routes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Route className="h-4 w-4" strokeWidth={2.5} />
          Entregas
          {totalActive > 0 && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === "routes" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{totalActive}</span>}
        </button>
        <button
          onClick={() => setActiveTab("earnings")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "earnings" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Wallet className="h-4 w-4" strokeWidth={2.5} />
          Ganhos
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "history" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Clock className="h-4 w-4" strokeWidth={2.5} />
          Histórico
        </button>
      </div>

      {activeTab === "history" ? (
        <DriverRideHistory storeIds={linkedStoreIds} />
      ) : activeTab === "earnings" ? (
        <StoreDriverEarnings storeIds={linkedStoreIds} />
      ) : (
        <>

      {/* ═══ STORE TABS (multi-store only) ═══ */}
      {multiStore && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Suas Lojas</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
            {linkedStoreIds.map((sid) => {
              const isActive = effectiveStoreId === sid;
              const count = storeOrderCounts[sid] || 0;
              return (
                <button
                  key={sid}
                  onClick={() => setActiveStoreId(sid)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-card border border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[120px]">{getStoreName(sid)}</span>
                  {count > 0 && (
                    <span className={`min-w-[20px] h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Route optimization toggle — premium */}
      {(hasActiveDeliveries || hasAvailable) && (
        <button
          onClick={() => setUseOptimized(!useOptimized)}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
            useOptimized ? "bg-primary/5 border-primary/20" : "bg-card border-border/60"
          }`}
        >
          <div className="flex items-center gap-3">
            <Route className={`h-5 w-5 ${useOptimized ? "text-primary" : "text-muted-foreground"}`} strokeWidth={2} />
            <div className="text-left">
              <p className={`text-sm font-bold ${useOptimized ? "text-primary" : "text-foreground"}`}>Rota otimizada</p>
              <p className="text-xs text-muted-foreground">
                {useOptimized && routeDistanceKm > 0
                  ? `~${routeDistanceKm.toFixed(1)} km · ~${Math.ceil(routeDistanceKm * 3)} min`
                  : "Ordena pela melhor sequência"}
              </p>
            </div>
          </div>
          <div
            role="switch"
            aria-checked={useOptimized}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${useOptimized ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${useOptimized ? "translate-x-5" : "translate-x-0"}`}
            />
          </div>
        </button>
      )}

      {/* ═══ NEXT STOP CARD (Circuit/Spoke style) ═══ */}
      {useOptimized && hasActiveDeliveries && filteredDeliveries.length > 1 && (() => {
        // Pick the next stop: first in-transit, otherwise first ready-to-depart
        const inTransit = filteredDeliveries.find((o: any) => o.status === "saiu_entrega" || o.status === "em_transito");
        const nextStop = inTransit || filteredDeliveries[0];
        if (!nextStop) return null;
        const stopIndex = filteredDeliveries.findIndex((o: any) => o.id === nextStop.id) + 1;
        const totalStops = filteredDeliveries.length;
        const remainingStops = filteredDeliveries.filter((o: any, i: number) => i >= stopIndex - 1).length;
        const fullAddr = [
          nextStop.address_details,
          nextStop.neighborhood,
          (nextStop.stores as any)?.address_city,
        ].filter(Boolean).join(", ");
        const navUrl = buildPreferredNavUrl({
          lat: nextStop.client_lat,
          lng: nextStop.client_lng,
          fallbackAddress: nextStop.address_details,
          neighborhood: nextStop.neighborhood,
          city: (nextStop.stores as any)?.address_city,
          state: (nextStop.stores as any)?.address_state,
        }, navApp);
        const contactName = (getContact(nextStop.client_id) as any)?.full_name || "Cliente";

        return (
          <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">
                  {stopIndex}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Próxima Parada</p>
                  <p className="text-[10px] opacity-75">{stopIndex} de {totalStops} · faltam {remainingStops}</p>
                </div>
              </div>
              <Zap className="h-5 w-5 opacity-80" />
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-3">
              <div className="flex items-start gap-2 mb-1">
                <User className="h-3.5 w-3.5 mt-0.5 opacity-80 flex-shrink-0" />
                <p className="text-sm font-bold leading-tight">{contactName}</p>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 opacity-80 flex-shrink-0" />
                <p className="text-xs leading-snug opacity-95">{fullAddr}</p>
              </div>
            </div>

            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-white text-primary font-black text-sm px-4 py-3 rounded-xl active:scale-[0.97] transition-all shadow-md"
            >
              <Navigation className="h-4 w-4" />
              {navApp === "google" ? "Iniciar no Google Maps" : "Iniciar no Waze"}
              <ArrowRight className="h-4 w-4" />
            </a>

            {/* Seletor de navegador preferido */}
            <div className="flex gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => chooseNavApp("waze")}
                className={`flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
                  navApp === "waze" ? "bg-white/25 text-white" : "bg-white/5 text-white/60"
                }`}
              >
                Waze
              </button>
              <button
                type="button"
                onClick={() => chooseNavApp("google")}
                className={`flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
                  navApp === "google" ? "bg-white/25 text-white" : "bg-white/5 text-white/60"
                }`}
              >
                Maps
              </button>
            </div>

            <button
              onClick={() => {
                setExpandedOrder(nextStop.id);
                setTimeout(() => {
                  document.getElementById(`stop-${nextStop.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
              className="w-full mt-2 text-[11px] font-bold opacity-80 hover:opacity-100 underline"
            >
              Ver detalhes da entrega ↓
            </button>
          </div>
        );
      })()}

      {/* ═══ ACTIVE ROUTE ═══ */}
      {hasActiveDeliveries && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                <Route className="h-4 w-4 text-primary" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Sua Rota</p>
                <h3 className="text-sm font-black text-foreground leading-tight mt-0.5">
                  {filteredDeliveries.length} {filteredDeliveries.length === 1 ? "entrega ativa" : "entregas ativas"}
                </h3>
                {useOptimized && routeDistanceKm > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ~{routeDistanceKm.toFixed(1)} km · ~{Math.ceil(routeDistanceKm * 3)} min
                  </p>
                )}
              </div>
            </div>
            {filteredDeliveries.some((o: any) => o.status === "pronto_para_entrega") && (
              <button
                onClick={departAll}
                disabled={departingId === "all"}
                className="bg-warning text-warning-foreground px-3.5 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 shadow-md shadow-warning/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {departingId === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" strokeWidth={2.6} />}
                Sair Todos
              </button>
            )}
          </div>

          {/* Rota completa multi-parada (Google Maps, até 10 paradas) */}
          {filteredDeliveries.length >= 2 && (() => {
            const stops = filteredDeliveries
              .filter((o: any) => o.client_lat && o.client_lng)
              .slice(0, 10)
              .map((o: any) => ({
                lat: Number(o.client_lat),
                lng: Number(o.client_lng),
                fallbackAddress: o.address_details,
                neighborhood: o.neighborhood,
                city: (o.stores as any)?.address_city,
                state: (o.stores as any)?.address_state,
              } as NavTarget));
            if (stops.length < 2) return null;
            const origin: NavTarget | undefined = activeStoreCoords
              ? { lat: activeStoreCoords[0], lng: activeStoreCoords[1] }
              : undefined;
            const url = buildGoogleMapsMultiStopUrl(stops, origin);
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-black text-sm px-4 py-3 rounded-2xl shadow-md active:scale-[0.97] transition-all"
              >
                <Route className="h-4 w-4" strokeWidth={2.5} />
                Navegar rota completa ({stops.length}) no Google Maps
              </a>
            );
          })()}

          {filteredDeliveries.map((order: any, index: number) => {
            const isExpanded = expandedOrder === order.id;
            const contact = getContact(order.client_id);
            const contactPhone = (contact as any)?.whatsapp_number || (contact as any)?.phone || "";
            const contactName = (contact as any)?.full_name || "Cliente";
            const readyToDepart = order.status === "pronto_para_entrega";
            const inDelivery = order.status === "saiu_entrega" || order.status === "em_transito";

            return (
              <div
                key={order.id}
                id={`stop-${order.id}`}
                className="relative bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm"
              >
                {/* Faixa lateral de status (3px) */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  inDelivery ? "bg-success" : readyToDepart ? "bg-warning" : "bg-primary/60"
                }`} />
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/30 transition-colors"
                >
                  <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                    inDelivery
                      ? "bg-success/10 text-success"
                      : readyToDepart
                        ? "bg-warning/10 text-warning"
                        : "bg-primary/10 text-primary"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {inDelivery && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                      <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${
                        inDelivery ? "text-success" : readyToDepart ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {inDelivery ? "Em entrega" : readyToDepart ? "Pronto p/ sair" : "Aguardando"}
                      </p>
                    </div>
                    <p className="text-lg font-black text-foreground truncate leading-tight tracking-tight">
                      {order.neighborhood}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {!multiStore && <>{(order as any).stores?.name} · </>}
                      {contactName} · #{order.id.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground/60 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3 bg-muted/10">
                    {/* Store name badge for multi-store */}
                    {multiStore && (
                      <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2 border border-primary/15">
                        <Store className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                        <span className="text-xs font-black text-primary">{(order as any).stores?.name}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{order.neighborhood}</p>
                        <p className="text-xs text-muted-foreground">{order.address_details}</p>
                        <NavigationLinks target={{
                          lat: (order as any).client_lat,
                          lng: (order as any).client_lng,
                          fallbackAddress: order.address_details,
                          neighborhood: order.neighborhood,
                          city: (order as any).stores?.address_city,
                          state: (order as any).stores?.address_state,
                        }} />
                      </div>
                    </div>

                    {contactPhone && (
                      <WhatsAppButton
                        number={contactPhone}
                        message={`Olá ${contactName}! Sou o motoboy, estou a caminho com seu pedido #${order.id.slice(0, 8).toUpperCase()}.`}
                        label={`Falar com ${contactName}`}
                        size="sm"
                      />
                    )}

                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2">Itens</p>
                      <div className="space-y-1">
                        {order.order_items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-xs">
                            <span className="text-foreground">{item.quantity}x {getOrderItemDisplayName(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2">
                      <span className="text-xs text-muted-foreground">Pagamento:</span>
                      <span className="text-xs font-bold text-foreground">
                        {order.payment_method === "pix" ? "📱 PIX" : order.payment_method === "dinheiro" ? "💵 Dinheiro" : order.payment_method === "cartao" ? "💳 Cartão" : order.payment_method}
                      </span>
                      {order.needs_change && order.change_for && (
                        <span className="text-xs text-warning font-bold ml-auto">
                          Troco p/ {formatBRL(Number(order.change_for))}
                        </span>
                      )}
                    </div>

                    {readyToDepart && (
                      <div className="relative overflow-hidden bg-warning/8 border border-warning/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center">
                            <Bike className="h-4.5 w-4.5 text-warning" strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-warning uppercase tracking-widest leading-none">Pronto</p>
                            <p className="text-sm font-black text-foreground mt-0.5">Sair para Entrega</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">Toque quando estiver saindo da loja com este pedido.</p>
                        <button
                          onClick={() => departForDelivery(order.id)}
                          disabled={departingId === order.id || departingId === "all"}
                          className="w-full h-14 bg-warning text-warning-foreground font-black rounded-2xl text-base shadow-md shadow-warning/25 disabled:opacity-50 flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
                        >
                          {departingId === order.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" strokeWidth={2.5} />}
                          Sair para entrega
                        </button>
                      </div>
                    )}

                    {inDelivery && (
                      (() => {
                        const storeMeta = storeNames?.find((s) => s.id === order.store_id);
                        const autofill = !!storeMeta?.driver_pin_autofill;
                        const orderPin = (order as any).delivery_pin as string | undefined;
                        const effectivePin = autofill && orderPin ? orderPin : (pinInputs[order.id] || "");
                        return (
                      <div className="relative overflow-hidden bg-success/8 border border-success/30 rounded-2xl p-4 space-y-3.5">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-success/15 rounded-full blur-2xl" />
                        <div className="relative flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-success/20 flex items-center justify-center">
                            <KeyRound className="h-4.5 w-4.5 text-success" strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-success uppercase tracking-widest leading-none">Última Etapa</p>
                            <p className="text-sm font-black text-foreground mt-0.5">Confirmar Entrega</p>
                          </div>
                        </div>
                        {autofill && orderPin ? (
                          <p className="relative text-xs text-muted-foreground leading-snug">
                            Confirme apenas com o cliente o PIN abaixo e clique em <span className="font-black text-foreground">Confirmar entrega</span>.
                          </p>
                        ) : (
                          <p className="relative text-xs text-muted-foreground leading-snug">
                            Peça ao cliente o <span className="font-black text-foreground">PIN de 4 dígitos</span> e digite abaixo.
                          </p>
                        )}
                        <PinBoxes
                          value={effectivePin}
                          onChange={(v) => setPinInputs((prev) => ({ ...prev, [order.id]: v }))}
                          accent="success"
                          disabled={autofill && !!orderPin}
                        />
                        <button
                          onClick={() => {
                            finishDelivery(order.id, autofill && orderPin ? orderPin : undefined);
                          }}
                          disabled={!effectivePin || effectivePin.length !== 4 || verifyingId === order.id}
                          className="w-full h-14 bg-success text-success-foreground font-black rounded-2xl text-base shadow-md shadow-success/25 disabled:opacity-40 flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
                        >
                          {verifyingId === order.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />}
                          Confirmar entrega
                        </button>
                      </div>
                        );
                      })()
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ AVAILABLE ORDERS ═══ */}
      {!loadingAvailable && hasAvailable && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-warning opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">
                Disponíveis
              </h3>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-warning/15 text-warning text-[10px] font-black">
                {filteredAvailable.length}
              </span>
            </div>
            {filteredAvailable.length > 1 && !hasActiveRoutes && (
              <button
                onClick={acceptAllFiltered}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-sm shadow-primary/20 active:scale-95 transition-transform"
              >
                <Zap className="h-3 w-3" strokeWidth={3} /> Aceitar todos
              </button>
            )}
          </div>

          {hasActiveRoutes && (
            <div className="bg-warning/8 border border-warning/25 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                <Clock className="h-3.5 w-3.5 text-warning" strokeWidth={2.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-warning uppercase tracking-wider leading-none">Em rota</p>
                <p className="text-xs text-foreground/80 font-medium mt-1 leading-snug">
                  Finalize as entregas atuais antes de aceitar novos pedidos.
                </p>
              </div>
            </div>
          )}

          {filteredAvailable.map((order: any, index: number) => {
            const itemsCount = (order.order_items || []).reduce((s: number, it: any) => s + (it.quantity || 1), 0);
            const canDecline = (storeDriverCounts?.[order.store_id] || 0) >= 2 && !hasActiveRoutes;
            return (
              <div
                key={order.id}
                className={`relative bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm ${hasActiveRoutes ? "opacity-60" : ""}`}
              >
                {/* Faixa lateral 3px */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-warning" />
                <div className="p-4 pl-[18px] space-y-3">
                  {/* Linha 1: loja + ID */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={2.4} />
                      <p className="text-xs font-bold text-muted-foreground truncate">
                        {(order as any).stores?.name || "Loja"}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                      #{order.id.slice(0, 6).toUpperCase()}
                    </span>
                  </div>

                  {/* Linha 2: endereço (hierarquia máxima) */}
                  <div>
                    <p className="text-xl font-black text-foreground leading-tight tracking-tight">
                      {order.neighborhood}
                    </p>
                    {order.address_details && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                        {order.address_details}
                      </p>
                    )}
                  </div>

                  {/* Linha 3: chips compactos (itens · pagamento · troco) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground bg-muted px-2 py-1 rounded-lg">
                      <Package className="h-3 w-3" strokeWidth={2.6} />
                      {itemsCount} {itemsCount === 1 ? "item" : "itens"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground bg-muted px-2 py-1 rounded-lg">
                      {order.payment_method === "pix" ? "📱 PIX"
                        : order.payment_method === "dinheiro" ? "💵 Dinheiro"
                        : order.payment_method === "cartao" ? "💳 Cartão"
                        : order.payment_method}
                    </span>
                    {order.needs_change && order.change_for && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-lg">
                        Troco {formatBRL(Number(order.change_for))}
                      </span>
                    )}
                  </div>

                  {/* Footer: CTA único + recusar discreto */}
                  <div className="pt-1 space-y-2">
                    <button
                      onClick={() => acceptOrder(order.id)}
                      disabled={hasActiveRoutes}
                      className={`w-full h-14 font-black rounded-2xl text-base flex items-center justify-center gap-2 transition-transform ${
                        hasActiveRoutes
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground shadow-md shadow-primary/25 active:scale-[0.97]"
                      }`}
                    >
                      {hasActiveRoutes ? "Finalize a rota atual" : (
                        <>
                          Aceitar entrega
                          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                        </>
                      )}
                    </button>
                    {canDecline && (
                      <button
                        onClick={() => declineOrder(order.id)}
                        className="w-full h-9 text-xs font-bold text-muted-foreground hover:text-destructive active:text-destructive transition-colors flex items-center justify-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Recusar este pedido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loadingAvailable && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="relative bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-muted" />
              <div className="p-4 pl-[18px] space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-14 rounded bg-muted" />
                </div>
                <div className="h-6 w-3/5 rounded bg-muted" />
                <div className="flex gap-1.5">
                  <div className="h-6 w-16 rounded-lg bg-muted" />
                  <div className="h-6 w-20 rounded-lg bg-muted" />
                </div>
                <div className="h-14 w-full rounded-2xl bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingAvailable && !hasActiveDeliveries && !hasAvailable && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-8 gap-5">
          <div className={`relative w-24 h-24 rounded-[2rem] flex items-center justify-center ${
            isOnline ? "bg-gradient-to-br from-primary/15 to-primary/5" : "bg-muted/60"
          }`}>
            {isOnline && (
              <span className="absolute inset-0 rounded-[2rem] border-2 border-primary/20 animate-pulse" />
            )}
            <Bike className={`h-11 w-11 ${isOnline ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xl font-black text-foreground tracking-tight">
              {isOnline ? "Aguardando pedidos" : "Você está offline"}
            </p>
            <p className="text-sm text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
              {isOnline
                ? "Você receberá uma notificação assim que um pedido estiver pronto."
                : "Ative o status online para começar a receber entregas."}
            </p>
          </div>
          {!isOnline && (
            <button
              onClick={toggleOnline}
              disabled={togglingOnline}
              className="h-12 px-8 bg-primary text-primary-foreground font-black rounded-2xl text-sm shadow-md shadow-primary/25 active:scale-[0.97] transition-transform flex items-center gap-2"
            >
              <Power className="h-4 w-4" strokeWidth={2.6} />
              Ficar online
            </button>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default StoreDriverView;
