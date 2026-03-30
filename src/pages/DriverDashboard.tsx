import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Bike, MapPin, Store, DollarSign, Package, CheckCircle2,
  ArrowLeft, Navigation
} from "lucide-react";

const DriverDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => {
    return localStorage.getItem("driver_online") === "true";
  });
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  // Check approval (must be before conditional returns)
  const { data: driverProfile } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  // Sound alert
  const playAlert = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkYyEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTQ==");
    }
    audioRef.current.play().catch(() => {});
  }, []);

  // Available deliveries (pronto_para_entrega)
  const { data: availableOrders, isLoading: loadingAvailable } = useQuery({
    queryKey: ["driver-available-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name), order_items(*, products(name))")
        .eq("status", "pronto_para_entrega" as any)
        .is("driver_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOnline,
    refetchInterval: isOnline ? 10000 : false,
  });

  // My active delivery (em_transito)
  const { data: myDelivery } = useQuery({
    queryKey: ["driver-my-delivery", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name), order_items(*, products(name))")
        .eq("driver_id", user!.id)
        .eq("status", "em_transito" as any)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Realtime for new available orders
  useEffect(() => {
    if (!user || !isOnline) return;
    const channel = supabase
      .channel("driver-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "UPDATE" && (payload.new as any).status === "pronto_para_entrega") {
            playAlert();
            toast.info("🏍️ Nova entrega disponível!");
          }
          queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
          queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user.id] });
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [user, isOnline, queryClient, playAlert]);

  // Alert for new orders
  useEffect(() => {
    const count = availableOrders?.length || 0;
    if (count > prevCountRef.current && prevCountRef.current >= 0) {
      playAlert();
    }
    prevCountRef.current = count;
  }, [availableOrders, playAlert]);

  const toggleOnline = () => {
    const next = !isOnline;
    setIsOnline(next);
    localStorage.setItem("driver_online", String(next));
    toast.success(next ? "Você está online! Aguardando entregas..." : "Você está offline.");
  };

  const acceptOrder = async (orderId: string) => {
    const { error } = await supabase.rpc("driver_accept_order", { _order_id: orderId } as any);

    if (error) {
      toast.error("Ops! Outro entregador já aceitou esta corrida.");
    } else {
      toast.success("Corrida aceita! Vá buscar o pedido.");
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
    }
  };

  const finishDelivery = async (orderId: string) => {
    const { error } = await supabase.rpc("driver_finish_delivery", { _order_id: orderId } as any);

    if (error) {
      toast.error("Erro ao finalizar entrega.");
    } else {
      toast.success("Entrega finalizada! 🎉");
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
    }
  };

  // Check approval
  const { data: profile } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (authLoading) return null;
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  if (profile && !(profile as any).is_approved) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🛡️</div>
        <h1 className="text-xl font-bold text-white mb-2">Cadastro em Análise!</h1>
        <p className="text-sm text-gray-400 max-w-xs mb-2">
          Olá! Recebemos seus dados. Em até 24h o administrador de Itatinga liberará seu acesso.
        </p>
        <p className="text-xs text-gray-500">Entraremos em contato via WhatsApp.</p>
        <button onClick={() => navigate("/")} className="mt-6 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl">
          Voltar à Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm flex items-center gap-2">
                <Bike className="h-4 w-4 text-green-400" />
                Painel Entregador
              </h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${realtimeConnected && isOnline ? "bg-green-400" : "bg-gray-600"}`} />
                <span className="text-xs text-gray-400">
                  {isOnline ? (realtimeConnected ? "Conectado" : "Conectando...") : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Online/Offline toggle */}
          <button
            onClick={toggleOnline}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isOnline ? "bg-green-500" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                isOnline ? "left-7" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </header>

      {!isOnline ? (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <Bike className="h-20 w-20 text-gray-700 mb-6" />
          <h2 className="text-xl font-bold text-gray-400 mb-2">Você está offline</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Ative o modo online para receber entregas em Itatinga.
          </p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {/* Active delivery card */}
          {myDelivery && (
            <div className="bg-blue-500/10 border-2 border-blue-500 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Navigation className="h-5 w-5 text-blue-400" />
                <h2 className="font-bold text-blue-400 text-sm">ENTREGA EM ANDAMENTO</h2>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-200">{(myDelivery as any).stores?.name || "Loja"}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-gray-200 font-medium">{myDelivery.neighborhood}</span>
                    <p className="text-gray-400 text-xs mt-0.5">{myDelivery.address_details}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-gray-900/50 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">Itens do pedido:</p>
                {(myDelivery as any).order_items?.map((item: any) => (
                  <p key={item.id} className="text-sm text-gray-300">
                    <span className="text-blue-400 font-bold">{item.quantity}x</span>{" "}
                    {item.products?.name || "Item"}
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">Ganho</span>
                <span className="text-xl font-black text-green-400">
                  R$ {Number(myDelivery.delivery_fee).toFixed(2)}
                </span>
              </div>

              <button
                onClick={() => finishDelivery(myDelivery.id)}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                FINALIZAR ENTREGA
              </button>
            </div>
          )}

          {/* Available deliveries */}
          {!myDelivery && (
            <>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Entregas disponíveis
              </h2>

              {loadingAvailable ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-gray-900 rounded-2xl p-4 animate-pulse space-y-3">
                      <div className="h-4 bg-gray-800 rounded w-1/2" />
                      <div className="h-3 bg-gray-800 rounded w-3/4" />
                      <div className="h-12 bg-gray-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : availableOrders && availableOrders.length > 0 ? (
                <div className="space-y-3">
                  {availableOrders.map((order: any) => (
                    <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      {/* Origin */}
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <Store className="h-4 w-4 text-orange-400" />
                        <span className="text-gray-200 font-medium">
                          {order.stores?.name || "Loja"}
                        </span>
                      </div>

                      {/* Destination */}
                      <div className="flex items-start gap-2 text-sm mb-3">
                        <MapPin className="h-4 w-4 text-red-400 mt-0.5" />
                        <div>
                          <span className="text-gray-200">{order.neighborhood}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{order.address_details}</p>
                        </div>
                      </div>

                      {/* Items preview */}
                      <div className="text-xs text-gray-500 mb-3">
                        {order.order_items?.map((item: any) => (
                          <span key={item.id} className="mr-2">
                            {item.quantity}x {item.products?.name}
                          </span>
                        ))}
                      </div>

                      {/* Fee + Accept */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-gray-500">Ganho</span>
                          <p className="text-xl font-black text-green-400">
                            R$ {Number(order.delivery_fee).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => acceptOrder(order.id)}
                          className="bg-gray-100 text-gray-900 font-bold px-6 py-3.5 rounded-2xl text-sm active:scale-95 transition-transform"
                        >
                          ACEITAR CORRIDA
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package className="h-16 w-16 text-gray-700 mb-4" />
                  <h2 className="text-lg font-bold text-gray-500 mb-1">
                    Aguardando novos pedidos...
                  </h2>
                  <p className="text-sm text-gray-600">
                    Aproveite para descansar! 😴
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
