import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Pause, Play, Clock, ChefHat, Truck, CheckCircle2,
  MapPin, CreditCard, Package, ArrowLeft, DollarSign, Banknote, UtensilsCrossed, ListOrdered, Plus, Printer, Bike
} from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";
import MenuBuilder from "@/components/MenuBuilder";
import StoreHoursManager from "@/components/StoreHoursManager";
import AddonManager from "@/components/AddonManager";
import OrderReceipt from "@/components/OrderReceipt";

type OrderStatus = "pendente" | "preparando" | "pronto_para_entrega" | "saiu_entrega" | "em_transito" | "entregue" | "finalizado";
type DashboardTab = "orders" | "menu" | "addons" | "hours";

const statusColumns: { status: OrderStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: "pendente", label: "Novos", icon: Clock, color: "text-yellow-400" },
  { status: "preparando", label: "Preparando", icon: ChefHat, color: "text-orange-400" },
  { status: "pronto_para_entrega", label: "Pronto", icon: Package, color: "text-purple-400" },
  { status: "saiu_entrega", label: "Saiu", icon: Truck, color: "text-blue-400" },
  { status: "em_transito", label: "Trânsito", icon: Truck, color: "text-cyan-400" },
  { status: "entregue", label: "Entregue", icon: CheckCircle2, color: "text-green-400" },
  { status: "finalizado", label: "Finalizados", icon: CheckCircle2, color: "text-emerald-400" },
];

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderStatus>("pendente");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("orders");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrint") === "true");
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const prevPendingCountRef = useRef(0);

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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store,
  });

  // Fetch driver names for assigned orders
  const driverIds = [...new Set(orders?.map(o => o.driver_id).filter(Boolean) || [])] as string[];
  const { data: driverProfiles } = useQuery({
    queryKey: ["driver-profiles", driverIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("user_id, name")
        .in("user_id", driverIds);
      return data || [];
    },
    enabled: driverIds.length > 0,
  });

  const getDriverName = (driverId: string) => {
    const d = driverProfiles?.find((dr: any) => dr.user_id === driverId);
    return d?.name || "Entregador";
  };

  // Fetch client profiles for WhatsApp
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

  // Alert sound
  const playAlert = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkYyEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTQ==");
    }
    audioRef.current.play().catch(() => {});
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["store-orders", store.id] });
          if (payload.eventType === "INSERT" && (payload.new as any).status === "pendente") {
            playAlert();
            toast.info("🔔 Novo pedido recebido!", { duration: 8000 });
          }
        }
      )
      .subscribe((status) => {
        setIsOnline(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [store, queryClient, playAlert]);

  useEffect(() => {
    const pendingCount = orders?.filter(o => o.status === "pendente").length || 0;
    if (pendingCount > 0 && pendingCount > prevPendingCountRef.current) {
      playAlert();
    }
    prevPendingCountRef.current = pendingCount;
  }, [orders, playAlert]);

  const handlePrint = useCallback((order: any) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintingOrder(null), 500);
    }, 300);
  }, []);

  const toggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrint(next);
    localStorage.setItem("autoPrint", String(next));
    toast.success(next ? "Impressão automática ativada" : "Impressão automática desativada");
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast.error("Erro ao atualizar pedido.");
    } else {
      toast.success(`Pedido movido para "${statusColumns.find(c => c.status === newStatus)?.label}"`);
      queryClient.invalidateQueries({ queryKey: ["store-orders", store?.id] });
      // Auto-print on accept
      if (newStatus === "preparando" && autoPrint) {
        const order = orders?.find((o: any) => o.id === orderId);
        if (order) handlePrint(order);
      }
    }
  };

  const toggleStoreOpen = async () => {
    if (!store) return;
    const { error } = await supabase
      .from("stores")
      .update({ is_open: !store.is_open })
      .eq("id", store.id);
    if (error) {
      toast.error("Erro ao atualizar status da loja.");
    } else {
      toast.success(store.is_open ? "Loja pausada" : "Loja reaberta!");
      queryClient.invalidateQueries({ queryKey: ["my-store", user?.id] });
    }
  };

  const filteredOrders = orders?.filter(o => o.status === activeTab) || [];

  const getNextAction = (status: OrderStatus): { label: string; next: OrderStatus; color: string } | null => {
    switch (status) {
      case "pendente": return { label: "Aceitar", next: "preparando", color: "bg-green-500 hover:bg-green-600" };
      case "preparando": return { label: "🔔 Chamar Motoboy", next: "pronto_para_entrega" as OrderStatus, color: "bg-purple-500 hover:bg-purple-600" };
      // pronto_para_entrega: no manual action - driver validates collection code to move to saiu_entrega
      case "saiu_entrega": return { label: "Finalizar", next: "finalizado", color: "bg-emerald-500 hover:bg-emerald-600" };
      default: return null;
    }
  };

  const pendingCount = orders?.filter(o => o.status === "pendente").length || 0;

  return (
    <div className="min-h-screen bg-[#111827] text-white overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1F2937] border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm">{store?.name || "Painel"}</h1>
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <><Wifi className="h-3 w-3 text-green-400" /><span className="text-xs text-green-400">Online</span></>
                ) : (
                  <><WifiOff className="h-3 w-3 text-red-400" /><span className="text-xs text-red-400">Offline</span></>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoPrint}
              title={autoPrint ? "Impressão automática ATIVA" : "Impressão automática INATIVA"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                autoPrint
                  ? "bg-primary/20 text-primary"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              <Printer className="h-3.5 w-3.5" />
              Auto
            </button>
            <button
              onClick={toggleStoreOpen}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                store?.is_open
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              }`}
            >
              {store?.is_open ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {store?.is_open ? "Pausar" : "Reabrir"}
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => setDashboardTab("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${
            dashboardTab === "orders" ? "bg-primary text-primary-foreground" : "bg-[#1F2937] text-gray-400"
          }`}
        >
          <ListOrdered className="h-4 w-4" /> Pedidos
          {pendingCount > 0 && (
            <span className="bg-yellow-400 text-gray-900 text-xs px-1.5 py-0.5 rounded-full font-black animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setDashboardTab("menu")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${
            dashboardTab === "menu" ? "bg-primary text-primary-foreground" : "bg-[#1F2937] text-gray-400"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" /> Cardápio
        </button>
        <button
          onClick={() => setDashboardTab("addons")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${
            dashboardTab === "addons" ? "bg-primary text-primary-foreground" : "bg-[#1F2937] text-gray-400"
          }`}
        >
          <Plus className="h-4 w-4" /> Adicionais
        </button>
        <button
          onClick={() => setDashboardTab("hours")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${
            dashboardTab === "hours" ? "bg-primary text-primary-foreground" : "bg-[#1F2937] text-gray-400"
          }`}
        >
          <Clock className="h-4 w-4" /> Horários
        </button>
      </div>

      {dashboardTab === "menu" && store ? (
        <div className="px-4 py-4">
          <MenuBuilder storeId={store.id} />
        </div>
      ) : dashboardTab === "addons" && store ? (
        <div className="px-4 py-4">
          <AddonManager storeId={store.id} />
        </div>
      ) : dashboardTab === "hours" && store ? (
        <div className="px-4 py-4">
          <StoreHoursManager storeId={store.id} forceClosed={(store as any).force_closed || false} />
        </div>
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex overflow-x-auto gap-1 px-4 py-3 bg-[#1F2937]/50 no-scrollbar">
            {statusColumns.map((col) => {
              const count = orders?.filter(o => o.status === col.status).length || 0;
              const Icon = col.icon;
              return (
                <button
                  key={col.status}
                  onClick={() => setActiveTab(col.status)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === col.status
                      ? `bg-gray-700 ${col.color}`
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {col.label}
                  {count > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                      col.status === "pendente" && count > 0
                        ? "bg-yellow-400 text-gray-900 animate-pulse"
                        : "bg-gray-600 text-gray-200"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Orders list */}
          <div className="px-4 py-4 pb-28 space-y-3 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#1F2937] rounded-2xl p-4 animate-pulse space-y-3">
                    <div className="h-4 bg-gray-700 rounded w-1/2" />
                    <div className="h-3 bg-gray-700 rounded w-3/4" />
                    <div className="h-8 bg-gray-700 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order: any) => {
                const action = getNextAction(order.status);
                return (
                  <div
                    key={order.id}
                    className={`bg-[#1F2937] rounded-2xl p-4 border ${
                      order.status === "pendente"
                        ? "border-yellow-400/50 animate-pulse-border"
                        : "border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs text-gray-400">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-300 font-medium">
                          {paymentLabels[order.payment_method] || order.payment_method}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      {order.order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-200">
                            <span className="text-yellow-400 font-bold">{item.quantity}x</span>{" "}
                            {item.products?.name || "Item"}
                          </span>
                          <span className="text-gray-400">
                            R$ {(item.unit_price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{order.neighborhood} — {order.address_details}</span>
                    </div>

                    {/* Driver assigned info */}
                    {order.status === "pronto_para_entrega" && order.driver_id && (
                      <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-3 mb-3 flex items-center gap-2">
                        <Bike className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-blue-300 font-bold">
                          🏍️ {getDriverName(order.driver_id)} aceitou e está vindo buscar
                        </span>
                      </div>
                    )}

                    {/* Collection Code Display */}
                    {(order.status === "pronto_para_entrega" || order.status === "saiu_entrega" || order.status === "em_transito") && (order as any).collection_code && (
                      <div className="bg-purple-500/20 border border-purple-500/40 rounded-xl p-3 mb-3">
                        <p className="text-xs font-bold text-purple-400 mb-1">🔐 Código de Coleta</p>
                        <p className="text-3xl font-black text-purple-300 tracking-[0.3em] text-center">
                          {(order as any).collection_code}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 text-center">Informe ao motoboy para retirada</p>
                      </div>
                    )}

                    {order.payment_method === "dinheiro" && (
                      <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-2.5 mb-3 flex items-start gap-2">
                        <Banknote className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold text-yellow-400">Pagamento em Dinheiro</p>
                          {(order as any).needs_change && Number((order as any).change_for) > 0 && (
                            <p className="text-gray-300 mt-0.5">
                              Preparar troco: <span className="font-bold text-yellow-400">R$ {(Number((order as any).change_for) - Number(order.total_price)).toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {getClientWhatsApp(order.client_id) && (
                      <div className="mb-3">
                        <WhatsAppButton
                          number={getClientWhatsApp(order.client_id)}
                          message={`Olá ${getClientName(order.client_id)}! Aqui é do ${store?.name || "estabelecimento"}. Sobre seu pedido #${order.id.slice(0, 8).toUpperCase()}...`}
                          label="Chamar Cliente no WhatsApp"
                          size="md"
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                      <div>
                        <span className="text-xs text-gray-400">Total</span>
                        <p className="text-lg font-black text-green-400">
                          R$ {Number(order.total_price).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePrint(order)}
                          className="bg-gray-600 hover:bg-gray-500 text-white font-bold px-3 py-2.5 rounded-xl text-sm active:scale-95 transition-transform flex items-center gap-1.5"
                          title="Imprimir Comanda"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {action && (
                          <button
                            onClick={() => updateOrderStatus(order.id, action.next)}
                            className={`${action.color} text-white font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-transform`}
                          >
                            {action.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="h-16 w-16 text-gray-600 mb-4" />
                <h2 className="text-lg font-bold text-gray-400">
                  Nenhum pedido {statusColumns.find(c => c.status === activeTab)?.label.toLowerCase()}
                </h2>
              </div>
            )}
          </div>

          {pendingCount > 0 && activeTab !== "pendente" && (
            <button
              onClick={() => setActiveTab("pendente")}
              className="fixed bottom-6 right-6 bg-yellow-400 text-gray-900 font-bold px-5 py-3 rounded-2xl shadow-lg animate-bounce flex items-center gap-2"
            >
              <Clock className="h-5 w-5" />
              {pendingCount} novo{pendingCount > 1 ? "s" : ""}
            </button>
          )}
        </>
      )}
      {/* Hidden receipt for printing */}
      {printingOrder && (
        <OrderReceipt
          ref={receiptRef}
          order={printingOrder}
          storeName={store?.name || "Loja"}
          clientName={getClientName(printingOrder.client_id)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
