import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Bike, MapPin, Store, DollarSign, Package, CheckCircle2,
  ArrowLeft, Navigation, KeyRound, Smartphone, ShieldCheck,
  Wallet, TrendingUp, Calendar, Download, Clock, ChevronDown
} from "lucide-react";
import confetti from "canvas-confetti";
import WhatsAppButton from "@/components/WhatsAppButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, startOfDay, startOfWeek, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type TabType = "entregas" | "historico";
type DateFilter = "hoje" | "semana" | "mes" | "custom";

const URBAN_FEE = 4;
const RURAL_FEE = 12;
const RURAL_NEIGHBORHOODS = [
  "Distrito do Lobo", "Recanto dos Cambarás", "Engenheiro Serra",
  "Vila dos Lavradores", "Entorno do CDP", "Fazendas/Sítios (Geral)"
];

const DriverDashboard = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
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
  const [activeTab, setActiveTab] = useState<TabType>("entregas");
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoje");

  const { data: driverProfile } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const playAlert = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkYyEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTVhojJylp6CUhXRjVEdAP0RNW26Hm6ewsKifkH5sXU5EQENLWGmBl6iwsqyhlYN0ZFVJQkRMWWmAlaOssK2km5GBcmRXTEVFTFlpgJSkrrKupZqPf3BjV01HR1Bcb4OXpq+0sKadkYBwY1hNSElSYHGFmKewtLOroJSEd2lbUExKTVJeaoOSm5uTiHpqXE9FQEFHTQ==");
    }
    audioRef.current.play().catch(() => {});
  }, []);

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

  const { data: myDelivery } = useQuery({
    queryKey: ["driver-my-delivery", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name, owner_id), order_items(*, products(name))")
        .eq("driver_id", user!.id)
        .in("status", ["pronto_para_entrega", "saiu_entrega", "em_transito"] as any)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Fetch ALL finalized deliveries for history/earnings
  const { data: deliveryHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["driver-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, delivery_fee, neighborhood, confirmed_at, created_at, stores(name)")
        .eq("driver_id", user!.id)
        .eq("status", "finalizado" as any)
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch profiles for WhatsApp (client + store owner)
  const deliveryClientId = myDelivery?.client_id;
  const deliveryStoreOwnerId = (myDelivery as any)?.stores?.owner_id;
  const profileIds = [deliveryClientId, deliveryStoreOwnerId].filter(Boolean) as string[];
  
  const { data: contactProfiles } = useQuery({
    queryKey: ["driver-contacts", profileIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
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

  // Pending return (cash orders delivered but not confirmed return)
  const { data: pendingReturn } = useQuery({
    queryKey: ["driver-pending-return", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name)")
        .eq("driver_id", user!.id)
        .in("status", ["entregue", "finalizado"] as any)
        .eq("payment_method", "dinheiro")
        .eq("return_to_store_confirmed", false)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Calculate earnings based on date filter
  const filteredHistory = useMemo(() => {
    if (!deliveryHistory) return [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = subDays(now, 30);

    return deliveryHistory.filter((order: any) => {
      const orderDate = parseISO(order.confirmed_at || order.created_at);
      switch (dateFilter) {
        case "hoje":
          return isWithinInterval(orderDate, { start: todayStart, end: now });
        case "semana":
          return isWithinInterval(orderDate, { start: weekStart, end: now });
        case "mes":
          return isWithinInterval(orderDate, { start: monthStart, end: now });
        default:
          return true;
      }
    });
  }, [deliveryHistory, dateFilter]);

  const todayEarnings = useMemo(() => {
    if (!deliveryHistory) return 0;
    const todayStart = startOfDay(new Date());
    return deliveryHistory
      .filter((o: any) => {
        const d = parseISO(o.confirmed_at || o.created_at);
        return d >= todayStart;
      })
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
  }, [deliveryHistory]);

  const weekEarnings = useMemo(() => {
    if (!deliveryHistory) return 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return deliveryHistory
      .filter((o: any) => {
        const d = parseISO(o.confirmed_at || o.created_at);
        return d >= weekStart;
      })
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
  }, [deliveryHistory]);

  const totalDeliveries = deliveryHistory?.length || 0;

  const filteredEarnings = useMemo(() => {
    return filteredHistory.reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
  }, [filteredHistory]);

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
          queryClient.invalidateQueries({ queryKey: ["driver-history", user.id] });
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [user, isOnline, queryClient, playAlert]);

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
      toast.success("Corrida aceita! Vá buscar o pedido na loja.");
      setPinInput("");
      setCollectionCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
    }
  };

  const validateCollection = async (orderId: string) => {
    if (collectionCodeInput.length !== 4) {
      toast.error("Digite o código de 4 dígitos do lojista.");
      return;
    }
    setVerifyingCollection(true);
    const { error } = await supabase.rpc("driver_validate_collection" as any, {
      _order_id: orderId,
      _code: collectionCodeInput,
    });
    if (error) {
      toast.error(error.message || "Código inválido. Verifique com o lojista.");
      setVerifyingCollection(false);
    } else {
      toast.success("✅ Coleta validada! Agora entregue ao cliente.");
      setVerifyingCollection(false);
      setCollectionCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
    }
  };

  const finishDelivery = async (orderId: string) => {
    if (pinInput.length !== 4) {
      toast.error("Digite o código de 4 dígitos do cliente.");
      return;
    }
    setVerifying(true);
    const { error } = await supabase.rpc("driver_finish_delivery", {
      _order_id: orderId,
      _pin: pinInput,
    } as any);

    if (error) {
      toast.error(error.message || "Código inválido. Verifique com o cliente.");
      setVerifying(false);
    } else {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      toast.success("Entrega finalizada! 💰 Saldo liberado!");
      setPinInput("");
      setVerifying(false);
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-history", user!.id] });
    }
  };

  const confirmStoreReturn = async (orderId: string) => {
    const { error } = await supabase.rpc("driver_confirm_store_return", { _order_id: orderId } as any);
    if (error) {
      toast.error(error.message || "Erro ao confirmar retorno.");
    } else {
      toast.success("Acerto com a loja confirmado! ✅");
      queryClient.invalidateQueries({ queryKey: ["driver-pending-return", user!.id] });
    }
  };

  const exportSummary = () => {
    const filterLabel = dateFilter === "hoje" ? "Hoje" : dateFilter === "semana" ? "Semana" : dateFilter === "mes" ? "Últimos 30 dias" : "Todos";
    const lines = [
      `📊 RELATÓRIO DO ENTREGADOR`,
      `Período: ${filterLabel}`,
      `Data: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      ``,
      `💰 Total de Ganhos: R$ ${filteredEarnings.toFixed(2)}`,
      `📦 Entregas Realizadas: ${filteredHistory.length}`,
      ``,
      `--- DETALHAMENTO ---`,
      ...filteredHistory.map((o: any) => {
        const date = format(parseISO(o.confirmed_at || o.created_at), "dd/MM HH:mm", { locale: ptBR });
        const isRural = RURAL_NEIGHBORHOODS.some(n => o.neighborhood?.toLowerCase().includes(n.toLowerCase()));
        return `${date} | ${(o as any).stores?.name || "Loja"} | ${o.neighborhood} | ${isRural ? "Rural" : "Urbano"} | R$ ${Number(o.delivery_fee).toFixed(2)}`;
      }),
    ];
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success("📋 Relatório copiado! Cole no WhatsApp para enviar ao Admin.");
    }).catch(() => {
      // Fallback
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

  if (authLoading) return null;
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  // Desktop restriction
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-black">Acesso Restrito</h1>
          <p className="text-gray-400">
            O painel do entregador está disponível apenas para <span className="text-primary font-bold">dispositivos móveis</span> (Celular).
            Por favor, acesse pelo seu smartphone.
          </p>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-3">
            <p className="text-sm text-gray-400">Escaneie o QR Code ou acesse pelo celular:</p>
            <div className="bg-white rounded-xl p-4 inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`}
                alt="QR Code"
                className="w-44 h-44"
              />
            </div>
            <p className="text-xs text-gray-500 break-all">{window.location.href}</p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-primary hover:underline text-sm font-bold"
          >
            ← Voltar para a Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-y-auto pb-32">
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

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab("entregas")}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${
            activeTab === "entregas"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-500"
          }`}
        >
          🏍️ Entregas
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${
            activeTab === "historico"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-500"
          }`}
        >
          💰 Financeiro
        </button>
      </div>

      {activeTab === "entregas" ? (
        /* ===== ENTREGAS TAB ===== */
        <>
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
              {myDelivery && (
                <div className="bg-blue-500/10 border-2 border-blue-500 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Navigation className="h-5 w-5 text-blue-400" />
                    <h2 className="font-bold text-blue-400 text-sm">
                      {(myDelivery as any).status === 'pronto_para_entrega' && !(myDelivery as any).collection_validated
                        ? "A CAMINHO DA LOJA"
                        : (myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega'
                        ? "ENTREGA EM ANDAMENTO"
                        : "COLETA NA LOJA"}
                    </h2>
                  </div>

                  {/* Store info always visible */}
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Store className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-200">{(myDelivery as any).stores?.name || "Loja"}</span>
                  </div>

                  {!(myDelivery as any).collection_validated && (myDelivery as any).status === 'pronto_para_entrega' ? (
                    /* STEP 1: Collection code validation */
                    <div>
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck className="h-5 w-5 text-purple-400" />
                          <span className="text-sm font-bold text-purple-400">Validar Coleta na Loja</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">
                          Peça o código de coleta de 4 dígitos ao lojista para retirar o pedido.
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="0000"
                          value={collectionCodeInput}
                          onChange={(e) => setCollectionCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="w-full text-center text-3xl font-black tracking-[0.5em] py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          autoFocus
                        />
                      </div>

                      {/* Items preview */}
                      <div className="bg-gray-900/50 rounded-xl p-3 mb-3">
                        <p className="text-xs text-gray-500 mb-1">Itens do pedido:</p>
                        {(myDelivery as any).order_items?.map((item: any) => (
                          <p key={item.id} className="text-sm text-gray-300">
                            <span className="text-blue-400 font-bold">{item.quantity}x</span>{" "}
                            {item.products?.name || "Item"}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        <span className="text-sm font-bold text-green-400">🏍️ Ganho da Entrega</span>
                        <span className="text-xl font-black text-green-400">
                          R$ {Number(myDelivery.delivery_fee).toFixed(2)}
                        </span>
                      </div>

                      {/* WhatsApp loja */}
                      {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                        <div className="mb-3">
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryStoreOwnerId)}
                            message={`Olá! Sou o entregador do app. Estou com o pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`}
                            label="Falar com a Loja"
                            size="md"
                            className="w-full"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => validateCollection(myDelivery.id)}
                        disabled={collectionCodeInput.length !== 4 || verifyingCollection}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                      >
                        <ShieldCheck className="h-5 w-5" />
                        {verifyingCollection ? "Verificando..." : "VALIDAR COLETA"}
                      </button>
                    </div>
                  ) : (
                    /* STEP 2: Delivery to client (after collection validated) */
                    <div>
                      <div className="flex items-start gap-2 text-sm mb-3">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-200 font-medium">{myDelivery.neighborhood}</span>
                          <p className="text-gray-400 text-xs mt-0.5">{myDelivery.address_details}</p>
                        </div>
                      </div>

                      {/* Cash payment alert */}
                      {myDelivery.payment_method === "dinheiro" && (
                        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 mb-3">
                          <p className="text-sm font-bold text-yellow-400 mb-2">💰 PAGAMENTO EM DINHEIRO</p>
                          <div className="text-xs text-gray-300 space-y-1">
                            {(myDelivery as any).needs_change && Number((myDelivery as any).change_for) > 0 && (
                              <p>1️⃣ Pegar <span className="font-bold text-yellow-400">R$ {(Number((myDelivery as any).change_for) - Number(myDelivery.total_price)).toFixed(2)}</span> de troco com o lojista.</p>
                            )}
                            <p>{(myDelivery as any).needs_change ? "2️⃣" : "1️⃣"} Receber <span className="font-bold text-green-400">R$ {Number(myDelivery.total_price).toFixed(2)}</span> do cliente.</p>
                            <p>{(myDelivery as any).needs_change ? "3️⃣" : "2️⃣"} Retornar à loja para entregar o valor total.</p>
                          </div>
                        </div>
                      )}

                      {/* WhatsApp contact buttons */}
                      <div className="flex gap-2 mb-3">
                        {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryStoreOwnerId)}
                            message={`Olá! Sou o entregador. Pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`}
                            label="Loja"
                            size="md"
                            className="flex-1"
                          />
                        )}
                        {deliveryClientId && getContactWhatsApp(deliveryClientId) && (
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryClientId)}
                            message="Olá, sou o entregador do app de Itatinga e estou com seu pedido!"
                            label="Cliente"
                            size="md"
                            className="flex-1"
                          />
                        )}
                      </div>

                      <div className="bg-gray-900/50 rounded-xl p-3 mb-3">
                        <p className="text-xs text-gray-500 mb-1">Itens do pedido:</p>
                        {(myDelivery as any).order_items?.map((item: any) => (
                          <p key={item.id} className="text-sm text-gray-300">
                            <span className="text-blue-400 font-bold">{item.quantity}x</span>{" "}
                            {item.products?.name || "Item"}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        <span className="text-sm font-bold text-green-400">🏍️ Ganho da Entrega</span>
                        <span className="text-xl font-black text-green-400">
                          R$ {Number(myDelivery.delivery_fee).toFixed(2)}
                        </span>
                      </div>

                      {/* PIN Input Section */}
                      <div className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                          <KeyRound className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm font-bold text-yellow-400">Código do Cliente</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          Peça o código de 4 dígitos ao cliente para finalizar.
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="0000"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="w-full text-center text-3xl font-black tracking-[0.5em] py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          autoFocus
                        />
                      </div>

                      <button
                        onClick={() => finishDelivery(myDelivery.id)}
                        disabled={pinInput.length !== 4 || verifying}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        {verifying ? "Verificando..." : "CONFIRMAR ENTREGA"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Pending return to store card */}
              {!myDelivery && pendingReturn && (
                <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-yellow-400" />
                    <h2 className="font-bold text-yellow-400 text-sm">AGUARDANDO RETORNO À LOJA</h2>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Entregue o valor de <span className="font-bold text-yellow-400">R$ {Number(pendingReturn.total_price).toFixed(2)}</span> na loja <span className="font-bold text-gray-200">{(pendingReturn as any).stores?.name}</span>.
                  </p>
                  <button
                    onClick={() => confirmStoreReturn(pendingReturn.id)}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-2xl text-sm active:scale-95 transition-transform"
                  >
                    ✅ Confirmei acerto com a loja
                  </button>
                </div>
              )}

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
                          <div className="flex items-center gap-2 text-sm mb-2">
                            <Store className="h-4 w-4 text-orange-400" />
                            <span className="text-gray-200 font-medium">
                              {order.stores?.name || "Loja"}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-sm mb-3">
                            <MapPin className="h-4 w-4 text-red-400 mt-0.5" />
                            <div>
                              <span className="text-gray-200">{order.neighborhood}</span>
                              <p className="text-xs text-gray-500 mt-0.5">{order.address_details}</p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mb-3">
                            {order.order_items?.map((item: any) => (
                              <span key={item.id} className="mr-2">
                                {item.quantity}x {item.products?.name}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs text-gray-500">🏍️ Ganho da Entrega</span>
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
        </>
      ) : (
        /* ===== FINANCEIRO TAB ===== */
        <div className="px-4 py-4 space-y-4">
          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-2xl p-3 text-center">
              <DollarSign className="h-5 w-5 text-green-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Hoje</p>
              <p className="text-lg font-black text-green-400">R$ {todayEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-3 text-center">
              <TrendingUp className="h-5 w-5 text-blue-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Semana</p>
              <p className="text-lg font-black text-blue-400">R$ {weekEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-3 text-center">
              <Package className="h-5 w-5 text-purple-400 mx-auto mb-1" />
              <p className="text-[10px] text-gray-400 uppercase font-bold">Total</p>
              <p className="text-lg font-black text-purple-400">{totalDeliveries}</p>
            </div>
          </div>

          {/* Date filter */}
          <div className="flex gap-2">
            {([
              { key: "hoje", label: "Hoje" },
              { key: "semana", label: "7 dias" },
              { key: "mes", label: "30 dias" },
              { key: "custom", label: "Todos" },
            ] as { key: DateFilter; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  dateFilter === f.key
                    ? "bg-green-500 text-white"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtered Earnings Banner */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">💵 Ganhos no período</p>
              <p className="text-2xl font-black text-green-400">R$ {filteredEarnings.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{filteredHistory.length} entregas</p>
            </div>
            <button
              onClick={exportSummary}
              className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-xl active:scale-95 transition-transform"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Delivery History List */}
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Corridas
          </h3>

          {loadingHistory ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-1/3" />
                  <div className="h-3 bg-gray-800 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-2">
              {filteredHistory.map((order: any) => {
                const isRural = RURAL_NEIGHBORHOODS.some(n => order.neighborhood?.toLowerCase().includes(n.toLowerCase()));
                const orderDate = parseISO(order.confirmed_at || order.created_at);
                return (
                  <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Store className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                        <span className="text-sm text-gray-200 font-medium truncate">
                          {(order as any).stores?.name || "Loja"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{format(orderDate, "dd/MM HH:mm", { locale: ptBR })}</span>
                        <span>•</span>
                        <span className="truncate">{order.neighborhood}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${
                        isRural ? "bg-amber-500/20 text-amber-400" : "bg-cyan-500/20 text-cyan-400"
                      }`}>
                        {isRural ? "Rural" : "Urbano"}
                      </span>
                    </div>
                    <p className="text-lg font-black text-green-400 ml-3">
                      R$ {Number(order.delivery_fee).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="h-14 w-14 text-gray-700 mb-4" />
              <h2 className="text-base font-bold text-gray-500 mb-1">
                Nenhuma entrega neste período
              </h2>
              <p className="text-sm text-gray-600">
                Suas entregas finalizadas aparecerão aqui.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
