import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import confetti from "canvas-confetti";
import {
  Bike, MapPin, Navigation, KeyRound, CheckCircle2, Package,
  Store, ChevronRight, Route, Clock, User, Phone, ArrowRight,
  Loader2, ShieldCheck, Zap
} from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";
import OrderChat from "@/components/OrderChat";

/* ── Helpers ── */
const NavigationLinks = ({ addr }: { addr: string }) => {
  const encoded = encodeURIComponent(addr);
  return (
    <div className="flex gap-2 mt-2">
      <a href={`https://www.google.com/maps/search/?api=1&query=${encoded}`} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-[0.97] transition-all">
        <Navigation className="h-3.5 w-3.5" /> Google Maps
      </a>
      <a href={`https://waze.com/ul?q=${encoded}&navigate=yes`} target="_blank" rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-[0.97] transition-all">
        <Navigation className="h-3.5 w-3.5" /> Waze
      </a>
    </div>
  );
};

/**
 * Nearest-neighbor route optimization using CEP proximity.
 * Brazilian CEPs that are numerically close are geographically close.
 * Falls back to neighborhood grouping when CEP is unavailable.
 */
function extractCepDigits(addr: string): number | null {
  const m = (addr || "").match(/(\d{5})-?(\d{3})/);
  return m ? parseInt(m[1] + m[2], 10) : null;
}

function optimizeRoute(orders: any[]): any[] {
  if (orders.length <= 1) return orders;

  // Split into orders with and without CEP
  const withCep = orders.filter((o) => extractCepDigits(o.address_details) !== null);
  const withoutCep = orders.filter((o) => extractCepDigits(o.address_details) === null);

  // Nearest-neighbor on CEP-based orders
  if (withCep.length > 1) {
    const sorted: any[] = [];
    const remaining = [...withCep];
    // Start with the lowest CEP (closest to store area)
    remaining.sort((a, b) => (extractCepDigits(a.address_details) || 0) - (extractCepDigits(b.address_details) || 0));
    sorted.push(remaining.shift()!);

    while (remaining.length > 0) {
      const lastCep = extractCepDigits(sorted[sorted.length - 1].address_details) || 0;
      let nearestIdx = 0;
      let nearestDist = Infinity;
      remaining.forEach((o, i) => {
        const dist = Math.abs((extractCepDigits(o.address_details) || 0) - lastCep);
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      });
      sorted.push(remaining.splice(nearestIdx, 1)[0]);
    }
    // Group by neighborhood within CEP-close clusters, then sort by street
    const result = [...sorted];
    // Append non-CEP orders grouped by neighborhood
    const groups: Record<string, any[]> = {};
    withoutCep.forEach((o) => {
      const key = (o.neighborhood || "outros").toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    Object.values(groups).forEach((g) => {
      g.sort((a, b) => (a.address_details || "").localeCompare(b.address_details || ""));
      result.push(...g);
    });
    return result;
  }

  // Fallback: group by neighborhood
  const groups: Record<string, any[]> = {};
  orders.forEach((o) => {
    const key = (o.neighborhood || "outros").toLowerCase().trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });
  const result: any[] = [];
  Object.values(groups).forEach((g) => {
    g.sort((a, b) => (a.address_details || "").localeCompare(b.address_details || ""));
    result.push(...g);
  });
  return result;
}

interface StoreDriverViewProps {
  linkedStoreIds: string[];
}

const StoreDriverView = ({ linkedStoreIds }: StoreDriverViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [collectionInputs, setCollectionInputs] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [useOptimized, setUseOptimized] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  const multiStore = linkedStoreIds.length > 1;

  // Fetch store names
  const { data: storeNames } = useQuery({
    queryKey: ["store-driver-store-names", linkedStoreIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", linkedStoreIds);
      return data || [];
    },
    enabled: linkedStoreIds.length > 0,
  });

  // Fetch all available orders for linked stores
  const { data: availableOrders, isLoading: loadingAvailable } = useQuery({
    queryKey: ["store-driver-available", linkedStoreIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, address_street, address_number, address_neighborhood, address_city), order_items(*, products(name))")
        .in("store_id", linkedStoreIds)
        .eq("status", "pronto_para_entrega" as any)
        .is("driver_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: linkedStoreIds.length > 0,
    refetchInterval: 10000,
  });

  // Fetch my active deliveries
  const { data: myDeliveries } = useQuery({
    queryKey: ["store-driver-my-deliveries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, owner_id, address_street, address_number, address_neighborhood, address_city), order_items(*, products(name))")
        .eq("driver_id", user!.id)
        .in("status", ["pronto_para_entrega", "saiu_entrega", "em_transito"] as any)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Fetch contact profiles
  const clientIds = useMemo(() => {
    if (!myDeliveries) return [];
    return [...new Set(myDeliveries.map((o: any) => o.client_id).filter(Boolean))];
  }, [myDeliveries]);

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
  });

  const getContact = useCallback((userId: string) => {
    return contactProfiles?.find((c: any) => c.user_id === userId);
  }, [contactProfiles]);

  // Auto-select first store if none selected
  const effectiveStoreId = activeStoreId || linkedStoreIds[0] || null;

  // Filter by selected store when multi-store
  const filteredDeliveries = useMemo(() => {
    if (!myDeliveries) return [];
    const list = multiStore && effectiveStoreId
      ? myDeliveries.filter((o: any) => o.store_id === effectiveStoreId)
      : myDeliveries;
    return useOptimized ? optimizeRoute(list) : list;
  }, [myDeliveries, multiStore, effectiveStoreId, useOptimized]);

  const filteredAvailable = useMemo(() => {
    if (!availableOrders) return [];
    const list = multiStore && effectiveStoreId
      ? availableOrders.filter((o: any) => o.store_id === effectiveStoreId)
      : availableOrders;
    return useOptimized ? optimizeRoute(list) : list;
  }, [availableOrders, multiStore, effectiveStoreId, useOptimized]);

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

  const acceptOrder = async (orderId: string) => {
    const { error } = await supabase.rpc("driver_accept_order", { _order_id: orderId } as any);
    if (error) {
      toast.error("Não foi possível aceitar o pedido.");
    } else {
      toast.success("Pedido aceito! Adicionado à sua rota.");
      queryClient.invalidateQueries({ queryKey: ["store-driver-available"] });
      queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries"] });
    }
  };

  const acceptAllFiltered = async () => {
    if (!filteredAvailable.length) return;
    let accepted = 0;
    for (const order of filteredAvailable) {
      const { error } = await supabase.rpc("driver_accept_order", { _order_id: order.id } as any);
      if (!error) accepted++;
    }
    toast.success(`${accepted} pedido(s) aceito(s)!`);
    queryClient.invalidateQueries({ queryKey: ["store-driver-available"] });
    queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries"] });
  };

  const [departingId, setDepartingId] = useState<string | null>(null);

  const departForDelivery = async (orderId: string) => {
    setDepartingId(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: "saiu_entrega" as any })
      .eq("id", orderId);
    if (error) {
      toast.error("Erro ao atualizar status.");
    } else {
      toast.success("🚀 Saiu para entrega!");
      queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries"] });
    }
    setDepartingId(null);
  };

  const departAll = async () => {
    const readyOrders = filteredDeliveries.filter((o: any) => o.status === "pronto_para_entrega");
    if (!readyOrders.length) return;
    setDepartingId("all");
    for (const order of readyOrders) {
      await supabase.from("orders").update({ status: "saiu_entrega" as any }).eq("id", order.id);
    }
    toast.success(`🚀 ${readyOrders.length} pedido(s) saíram para entrega!`);
    queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries"] });
    setDepartingId(null);
  };

  const finishDelivery = async (orderId: string) => {
    const pin = pinInputs[orderId];
    if (!pin || pin.length !== 4) { toast.error("Digite o PIN de 4 dígitos."); return; }
    setVerifyingId(orderId);
    const { error } = await supabase.rpc("driver_finish_delivery", { _order_id: orderId, _pin: pin } as any);
    if (error) {
      toast.error(error.message || "PIN inválido.");
    } else {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      toast.success("🎉 Entrega confirmada!");
      setPinInputs((prev) => ({ ...prev, [orderId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["store-driver-my-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["store-driver-count"] });
    }
    setVerifyingId(null);
  };

  const hasActiveDeliveries = filteredDeliveries.length > 0;
  const hasAvailable = filteredAvailable.length > 0;
  const totalActive = (myDeliveries?.length || 0);
  const totalAvailable = (availableOrders?.length || 0);

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <Package className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-black text-foreground">{totalActive}</p>
          <p className="text-[9px] text-muted-foreground font-semibold uppercase">Na Rota</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-black text-foreground">{totalAvailable}</p>
          <p className="text-[9px] text-muted-foreground font-semibold uppercase">Disponíveis</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-black text-foreground">{deliveryCount || 0}</p>
          <p className="text-[9px] text-muted-foreground font-semibold uppercase">Realizadas</p>
        </div>
      </div>

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

      {/* Route optimization toggle */}
      {(hasActiveDeliveries || hasAvailable) && (
        <button
          onClick={() => setUseOptimized(!useOptimized)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
            useOptimized
              ? "bg-primary/5 border-primary/20"
              : "bg-muted/50 border-border"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Route className={`h-4 w-4 ${useOptimized ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-left">
              <p className="text-xs font-bold text-foreground">Rota Otimizada</p>
              <p className="text-[10px] text-muted-foreground">Agrupa entregas por proximidade</p>
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors ${useOptimized ? "bg-primary" : "bg-muted"} relative`}>
            <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${useOptimized ? "left-[19px]" : "left-[3px]"}`} />
          </div>
        </button>
      )}

      {/* ═══ ACTIVE ROUTE ═══ */}
      {hasActiveDeliveries && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Route className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Sua Rota ({filteredDeliveries.length} {filteredDeliveries.length === 1 ? "entrega" : "entregas"})
              </h3>
            </div>
            {filteredDeliveries.some((o: any) => o.status === "pronto_para_entrega") && (
              <button
                onClick={departAll}
                disabled={departingId === "all"}
                className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {departingId === "all" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />} Sair p/ Entrega
              </button>
            )}
          </div>

          {filteredDeliveries.map((order: any, index: number) => {
            const isExpanded = expandedOrder === order.id;
            const contact = getContact(order.client_id);
            const contactPhone = (contact as any)?.whatsapp_number || (contact as any)?.phone || "";
            const contactName = (contact as any)?.full_name || "Cliente";
            const readyToDepart = order.status === "pronto_para_entrega";
            const inDelivery = order.status === "saiu_entrega" || order.status === "em_transito";

            return (
              <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                    inDelivery ? "bg-green-500 text-white" : readyToDepart ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {order.neighborhood}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {!multiStore && <>{(order as any).stores?.name} • </>}
                      {contactName} • #{order.id.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    readyToDepart ? "bg-amber-500/10 text-amber-500" : inDelivery ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                  }`}>
                    {readyToDepart ? "PRONTO" : inDelivery ? "ENTREGAR" : order.status}
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* Store name badge for multi-store */}
                    {multiStore && (
                      <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-3 py-2">
                        <Store className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold text-primary">{(order as any).stores?.name}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{order.neighborhood}</p>
                        <p className="text-xs text-muted-foreground">{order.address_details}</p>
                        <NavigationLinks addr={order.address_details} />
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
                        <span className="text-xs text-amber-500 font-bold ml-auto">
                          Troco p/ R$ {Number(order.change_for).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {readyToDepart && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Bike className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-bold text-foreground">Sair para Entrega</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Clique quando estiver saindo da loja com este pedido.</p>
                        <button
                          onClick={() => departForDelivery(order.id)}
                          disabled={departingId === order.id || departingId === "all"}
                          className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        >
                          {departingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                          Saindo para Entrega
                        </button>
                      </div>
                    )}

                    {inDelivery && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-bold text-foreground">Confirmar Entrega</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Peça o PIN de 4 dígitos ao cliente.</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="• • • •"
                          value={pinInputs[order.id] || ""}
                          onChange={(e) => setPinInputs((prev) => ({ ...prev, [order.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                          className="w-full text-center text-2xl font-black tracking-[0.5em] bg-card border-2 border-green-500/20 rounded-xl py-3 text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-green-500"
                        />
                        <button
                          onClick={() => finishDelivery(order.id)}
                          disabled={!pinInputs[order.id] || pinInputs[order.id].length !== 4 || verifyingId === order.id}
                          className="w-full bg-green-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {verifyingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Finalizar Entrega
                        </button>
                      </div>
                    )}

                    <OrderChat
                      orderId={order.id}
                      storeName={(order as any).stores?.name || "Loja"}
                      storeOwnerId={(order as any).stores?.owner_id}
                      clientId={order.client_id}
                      driverId={user?.id}
                    />
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
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Disponíveis ({filteredAvailable.length})
              </h3>
            </div>
            {filteredAvailable.length > 1 && (
              <button
                onClick={acceptAllFiltered}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1"
              >
                <Zap className="h-3 w-3" /> Aceitar Todos
              </button>
            )}
          </div>

          {filteredAvailable.map((order: any, index: number) => (
            <div key={order.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-xs font-black text-amber-500">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{(order as any).stores?.name || "Loja"}</p>
                  <p className="text-[10px] text-muted-foreground">#{order.id.slice(0, 6).toUpperCase()}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-muted/50 rounded-xl p-3">
                <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-foreground">{order.neighborhood}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{order.address_details}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                {order.order_items?.map((item: any) => (
                  <span key={item.id}>{item.quantity}x {getOrderItemDisplayName(item)}</span>
                ))}
              </div>

              <button
                onClick={() => acceptOrder(order.id)}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                ACEITAR <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {loadingAvailable && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loadingAvailable && !hasActiveDeliveries && !hasAvailable && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-16 h-16 rounded-3xl bg-muted/80 flex items-center justify-center mb-4">
            <Bike className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">
            {multiStore ? `Sem pedidos em ${getStoreName(effectiveStoreId!)}` : "Aguardando pedidos"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-[260px]">
            Quando a loja tiver pedidos prontos, eles aparecerão aqui organizados por rota.
          </p>
        </div>
      )}
    </div>
  );
};

export default StoreDriverView;
