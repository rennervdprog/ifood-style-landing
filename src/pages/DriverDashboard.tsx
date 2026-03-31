import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Bike, MapPin, Store, DollarSign, Package, CheckCircle2,
  ArrowLeft, Navigation, KeyRound, Smartphone, ShieldCheck,
  Wallet, TrendingUp, Calendar, Download, Clock, ChevronDown,
  CreditCard, Banknote, Settings, Save
} from "lucide-react";
import confetti from "canvas-confetti";
import WhatsAppButton from "@/components/WhatsAppButton";
import { openWhatsApp } from "@/lib/whatsapp";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, startOfDay, startOfWeek, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requestNotificationPermission, notifyDeliveryAvailable } from "@/lib/notifications";

type TabType = "entregas" | "historico" | "config";
type DateFilter = "hoje" | "semana" | "mes" | "custom";

const URBAN_FEE = 4;
const RURAL_FEE = 12;
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

  // Pix config state
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState<string>("cpf");
  const [savingPix, setSavingPix] = useState(false);

  const { data: driverProfile } = useQuery({
    queryKey: ["my-profile-approval", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_approved, role, pix_key, pix_type").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Populate pix fields from profile
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

  // Fetch ALL finalized deliveries for history/earnings (include payment_method)
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

  // Driver balance from driver_balances table
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

  // Driver individual earnings
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

  // Check for pending withdrawal request
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

  // Withdrawal history
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
      .filter((o: any) => parseISO(o.confirmed_at || o.created_at) >= todayStart)
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
  }, [deliveryHistory]);

  const weekEarnings = useMemo(() => {
    if (!deliveryHistory) return 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return deliveryHistory
      .filter((o: any) => parseISO(o.confirmed_at || o.created_at) >= weekStart)
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
  }, [deliveryHistory]);

  const totalDeliveries = deliveryHistory?.length || 0;

  const filteredEarnings = useMemo(() => {
    return filteredHistory.reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
  }, [filteredHistory]);

  // Pix vs Cash breakdown for filtered period
  const earningsBreakdown = useMemo(() => {
    const pixEarnings = filteredHistory
      .filter((o: any) => o.payment_method !== "dinheiro")
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
    const cashEarnings = filteredHistory
      .filter((o: any) => o.payment_method === "dinheiro")
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
    const pixCount = filteredHistory.filter((o: any) => o.payment_method !== "dinheiro").length;
    const cashCount = filteredHistory.filter((o: any) => o.payment_method === "dinheiro").length;
    return { pixEarnings, cashEarnings, pixCount, cashCount };
  }, [filteredHistory]);

  // Sync online status on mount and set offline on unload
  useEffect(() => {
    if (!user) return;
    supabase
      .from("drivers")
      .update({ is_online: isOnline } as any)
      .eq("user_id", user.id)
      .then(() => {});
    const handleUnload = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/drivers?user_id=eq.${user.id}`;
      fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ is_online: false }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => { window.removeEventListener("beforeunload", handleUnload); };
  }, [user]);

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
            notifyDeliveryAvailable();
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

  const toggleOnline = async () => {
    const next = !isOnline;
    setIsOnline(next);
    localStorage.setItem("driver_online", String(next));
    if (next) requestNotificationPermission();
    if (user) {
      await supabase
        .from("drivers")
        .update({ is_online: next } as any)
        .eq("user_id", user.id);
    }
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
      if (myDelivery) {
        const clientPhone = getContactWhatsApp(myDelivery.client_id);
        if (clientPhone) {
          const clientName = contactProfiles?.find((c: any) => c.user_id === myDelivery.client_id);
          const name = (clientName as any)?.full_name || "Cliente";
          const msg = `🏍️ *ItaFood* informa: Seu lanche saiu para entrega! O motoboy já coletou o pedido e está a caminho de: ${myDelivery.address_details} 💨\n\n--------------------------\n💰 Total: R$ ${Number(myDelivery.total_price).toFixed(2)}\n💳 Pagamento: ${myDelivery.payment_method === "pix" ? "PIX" : myDelivery.payment_method === "cartao" ? "Cartão" : myDelivery.payment_method === "dinheiro" ? "Dinheiro" : myDelivery.payment_method}\nPedido: #${myDelivery.id.slice(0, 8).toUpperCase()}\n--------------------------`;
          setTimeout(() => openWhatsApp(clientPhone, msg), 600);
        }
      }
    }
  };

  const finishDelivery = async (orderId: string) => {
    if (pinInput.length !== 4) {
      toast.error("Digite o código de 4 dígitos do cliente.");
      return;
    }
    setVerifying(true);

    // Get delivery fee before finishing
    const orderData = myDelivery || availableOrders?.find((o: any) => o.id === orderId);
    const deliveryFee = Number(orderData?.delivery_fee || 0);

    const { error } = await supabase.rpc("driver_finish_delivery", {
      _order_id: orderId,
      _pin: pinInput,
    } as any);

    if (error) {
      toast.error(error.message || "Código inválido. Verifique com o cliente.");
      setVerifying(false);
    } else {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
      toast.success(
        `🎉 Parabéns! R$ ${deliveryFee.toFixed(2)} foi adicionado ao seu saldo!`,
        { duration: 8000, icon: "💰" }
      );
      setPinInput("");
      setVerifying(false);
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-history", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-balance", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-earnings", user!.id] });
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

  const savePixKey = async () => {
    if (!pixKey.trim()) {
      toast.error("Informe sua chave Pix.");
      return;
    }
    setSavingPix(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pix_key: pixKey.trim(), pix_type: pixType as any })
      .eq("user_id", user!.id);
    if (error) {
      toast.error("Erro ao salvar chave Pix.");
    } else {
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
      `💰 Total de Ganhos: R$ ${filteredEarnings.toFixed(2)}`,
      `📱 Via Pix App: R$ ${earningsBreakdown.pixEarnings.toFixed(2)} (${earningsBreakdown.pixCount} entregas)`,
      `💵 Em Dinheiro: R$ ${earningsBreakdown.cashEarnings.toFixed(2)} (${earningsBreakdown.cashCount} entregas)`,
      `📦 Entregas Realizadas: ${filteredHistory.length}`,
      ``,
      `--- DETALHAMENTO ---`,
      ...filteredHistory.map((o: any) => {
        const date = format(parseISO(o.confirmed_at || o.created_at), "dd/MM HH:mm", { locale: ptBR });
        const payIcon = o.payment_method === "dinheiro" ? "💵" : "📱";
        return `${date} | ${(o as any).stores?.name || "Loja"} | ${o.neighborhood} | ${payIcon} R$ ${Number(o.delivery_fee).toFixed(2)}`;
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

  if (authLoading) return null;
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-black">Acesso Restrito</h1>
          <p className="text-gray-400">
            O painel do entregador está disponível apenas para <span className="text-primary font-bold">dispositivos móveis</span>.
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
          </div>
          <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm font-bold">
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
            className={`relative w-14 h-7 rounded-full transition-colors ${isOnline ? "bg-green-500" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${isOnline ? "left-7" : "left-0.5"}`} />
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab("entregas")}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${activeTab === "entregas" ? "text-green-400 border-b-2 border-green-400" : "text-gray-500"}`}
        >
          🏍️ Entregas
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${activeTab === "historico" ? "text-green-400 border-b-2 border-green-400" : "text-gray-500"}`}
        >
          💰 Ganhos
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${activeTab === "config" ? "text-green-400 border-b-2 border-green-400" : "text-gray-500"}`}
        >
          ⚙️ Pix
        </button>
      </div>

      {activeTab === "entregas" ? (
        /* ===== ENTREGAS TAB ===== */
        <>
          {!isOnline ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <Bike className="h-20 w-20 text-gray-700 mb-6" />
              <h2 className="text-xl font-bold text-gray-400 mb-2">Você está offline</h2>
              <p className="text-sm text-gray-500 max-w-xs">Ative o modo online para receber entregas no ItaFood.</p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4">
              {/* Pix key warning */}
              {!(driverProfile as any)?.pix_key && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-yellow-400">Cadastre sua chave Pix!</p>
                    <p className="text-[10px] text-gray-400">Para receber pagamentos automáticos das entregas via app.</p>
                  </div>
                  <button onClick={() => setActiveTab("config")} className="bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl">
                    Cadastrar
                  </button>
                </div>
              )}

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

                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Store className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-200">{(myDelivery as any).stores?.name || "Loja"}</span>
                  </div>

                  {!(myDelivery as any).collection_validated && (myDelivery as any).status === 'pronto_para_entrega' ? (
                    <div>
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck className="h-5 w-5 text-purple-400" />
                          <span className="text-sm font-bold text-purple-400">Validar Coleta na Loja</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">Peça o código de coleta de 4 dígitos ao lojista.</p>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="0000"
                            value={collectionCodeInput}
                            onChange={(e) => setCollectionCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className={`w-full text-center text-3xl font-black tracking-[0.5em] py-3 bg-gray-800 border-2 rounded-xl text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 transition-all ${
                              collectionCodeInput.length === 4 ? "border-green-400 focus:ring-green-400" : "border-gray-600 focus:ring-purple-400"
                            }`}
                            autoFocus
                          />
                          {collectionCodeInput.length === 4 && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 animate-bounce">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-900/50 rounded-xl p-3 mb-3">
                        <p className="text-xs text-gray-500 mb-1">Itens do pedido:</p>
                        {(myDelivery as any).order_items?.map((item: any) => (
                          <p key={item.id} className="text-sm text-gray-300">
                            <span className="text-blue-400 font-bold">{item.quantity}x</span> {item.products?.name || "Item"}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        <span className="text-sm font-bold text-green-400">🏍️ Ganho da Entrega</span>
                        <span className="text-xl font-black text-green-400">R$ {Number(myDelivery.delivery_fee).toFixed(2)}</span>
                      </div>

                      {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                        <div className="mb-3">
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryStoreOwnerId)}
                            message={`Olá! Sou o entregador do app. Pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`}
                            label="Falar com a Loja"
                            size="md"
                            className="w-full"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => validateCollection(myDelivery.id)}
                        disabled={collectionCodeInput.length !== 4 || verifyingCollection}
                        className={`w-full text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                          collectionCodeInput.length === 4 ? "bg-green-500 hover:bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-pulse" : "bg-purple-500 hover:bg-purple-600"
                        }`}
                      >
                        <ShieldCheck className="h-5 w-5" />
                        {verifyingCollection ? "Verificando..." : "VALIDAR COLETA"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start gap-2 text-sm mb-3">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-200 font-medium">{myDelivery.neighborhood}</span>
                          <p className="text-gray-400 text-xs mt-0.5">{myDelivery.address_details}</p>
                        </div>
                      </div>

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

                      <div className="flex gap-2 mb-3">
                        {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                          <WhatsAppButton number={getContactWhatsApp(deliveryStoreOwnerId)} message={`Pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`} label="Loja" size="md" className="flex-1" />
                        )}
                        {deliveryClientId && getContactWhatsApp(deliveryClientId) && (
                          <WhatsAppButton number={getContactWhatsApp(deliveryClientId)} message="Olá, sou o entregador do ItaFood!" label="Cliente" size="md" className="flex-1" />
                        )}
                      </div>

                      <div className="bg-gray-900/50 rounded-xl p-3 mb-3">
                        <p className="text-xs text-gray-500 mb-1">Itens:</p>
                        {(myDelivery as any).order_items?.map((item: any) => (
                          <p key={item.id} className="text-sm text-gray-300">
                            <span className="text-blue-400 font-bold">{item.quantity}x</span> {item.products?.name || "Item"}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        <span className="text-sm font-bold text-green-400">🏍️ Ganho</span>
                        <span className="text-xl font-black text-green-400">R$ {Number(myDelivery.delivery_fee).toFixed(2)}</span>
                      </div>

                      <div className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                          <KeyRound className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm font-bold text-yellow-400">Código do Cliente</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Peça o código de 4 dígitos ao cliente para finalizar.</p>
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
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        {verifying ? "Verificando..." : "CONFIRMAR ENTREGA"}
                      </button>
                    </div>
                  )}
                </div>
              )}

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
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Entregas disponíveis</h2>
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
                            <span className="text-gray-200 font-medium">{order.stores?.name || "Loja"}</span>
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
                              <span key={item.id} className="mr-2">{item.quantity}x {item.products?.name}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs text-gray-500">🏍️ Ganho</span>
                              <p className="text-xl font-black text-green-400">R$ {Number(order.delivery_fee).toFixed(2)}</p>
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
                      <h2 className="text-lg font-bold text-gray-500 mb-1">Aguardando novos pedidos...</h2>
                      <p className="text-sm text-gray-600">Aproveite para descansar! 😴</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : activeTab === "config" ? (
        /* ===== PIX CONFIG TAB ===== */
        <div className="px-4 py-4 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Minha Chave Pix</h2>
                <p className="text-[10px] text-gray-400">Para recebimentos instantâneos das entregas</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Tipo da Chave</label>
              <select
                value={pixType}
                onChange={e => setPixType(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 text-sm"
              >
                {Object.entries(PIX_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Chave Pix</label>
              <input
                type="text"
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder={pixType === "cpf" ? "000.000.000-00" : pixType === "email" ? "seuemail@email.com" : pixType === "phone" ? "(14) 99999-9999" : "Cole sua chave aqui"}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder:text-gray-600"
              />
            </div>

            <button
              onClick={savePixKey}
              disabled={savingPix || !pixKey.trim()}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingPix ? "Salvando..." : "Salvar Chave Pix"}
            </button>
          </div>

          {(driverProfile as any)?.pix_key && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm font-bold text-green-400">Chave Pix Cadastrada</span>
              </div>
              <p className="text-xs text-gray-400">
                Tipo: <span className="text-white font-medium">{PIX_TYPE_LABELS[(driverProfile as any).pix_type] || "CPF"}</span>
              </p>
              <p className="text-xs text-gray-400">
                Chave: <span className="text-white font-medium">{(driverProfile as any).pix_key}</span>
              </p>
            </div>
          )}

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-gray-300 mb-2">ℹ️ Como funciona?</h3>
            <div className="space-y-2 text-xs text-gray-400">
              <p>📱 <strong className="text-gray-300">Pedidos via Pix/App:</strong> A taxa de entrega é transferida automaticamente para sua chave Pix cadastrada.</p>
              <p>💵 <strong className="text-gray-300">Pedidos em Dinheiro:</strong> Você já recebe a taxa em mãos. O sistema registra como "recebido em dinheiro".</p>
              <p>📊 <strong className="text-gray-300">Histórico:</strong> Na aba "Ganhos" você vê o detalhamento de cada entrega.</p>
            </div>
          </div>
        </div>
      ) : (
        /* ===== FINANCEIRO/GANHOS TAB ===== */
        <div className="px-4 py-4 space-y-4">
          {/* Driver Balance Card */}
          {driverBalance && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="h-5 w-5 text-green-500" />
                <span className="text-sm font-bold text-foreground">Minha Carteira</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Total Ganho</p>
                  <p className="text-lg font-black text-foreground">R$ {Number(driverBalance.total_earned || 0).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-amber-500">Pendente</p>
                  <p className="text-lg font-black text-amber-500">R$ {Number(driverBalance.pending_amount || 0).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-green-500">Pago</p>
                  <p className="text-lg font-black text-green-500">R$ {Number(driverBalance.paid_amount || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Withdrawal Button */}
              {pendingWithdrawal ? (
                <div className="mt-4 space-y-2">
                  <button
                    disabled
                    className="w-full bg-muted text-muted-foreground font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
                  >
                    <Clock className="h-4 w-4" />
                    SAQUE SOLICITADO — {pendingWithdrawal.transaction_code || "Processando..."}
                  </button>
                  <p className="text-xs text-amber-500 text-center">
                    ⏳ Solicitação <span className="font-bold">{pendingWithdrawal.transaction_code}</span> no valor de R$ {Number(pendingWithdrawal.amount).toFixed(2)}. O Admin já foi notificado.
                  </p>
                </div>
              ) : Number(driverBalance.pending_amount || 0) > 0 && (driverProfile as any)?.pix_key ? (
                <button
                  disabled={requestingSaque}
                  onClick={async () => {
                    setRequestingSaque(true);
                    try {
                      // Double-check no pending request exists
                      const { data: existing } = await supabase
                        .from("withdrawal_requests" as any)
                        .select("id")
                        .eq("driver_user_id", user!.id)
                        .eq("status", "solicitado")
                        .maybeSingle();
                      if (existing) {
                        toast.warning("Você já possui uma solicitação de saque pendente. Aguarde o processamento.");
                        queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
                        return;
                      }
                      const amount = Number(driverBalance.pending_amount);
                      const { error } = await supabase.from("withdrawal_requests" as any).insert({
                        driver_user_id: user!.id,
                        amount,
                        pix_key: (driverProfile as any).pix_key,
                        pix_type: (driverProfile as any).pix_type || "cpf",
                      } as any);
                      if (error) throw error;
                      toast.success(`✅ Solicitação enviada! Valor: R$ ${amount.toFixed(2)}. O Admin foi notificado.`);
                      queryClient.invalidateQueries({ queryKey: ["driver-balance"] });
                      queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
                      queryClient.invalidateQueries({ queryKey: ["withdrawal-history"] });
                    } catch (err: any) {
                      toast.error(err?.message || "Erro ao solicitar saque.");
                    } finally {
                      setRequestingSaque(false);
                    }
                  }}
                  className="w-full mt-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <DollarSign className="h-4 w-4" />
                  {requestingSaque ? "PROCESSANDO..." : "SOLICITAR PAGAMENTO (PIX)"}
                </button>
              ) : Number(driverBalance.pending_amount || 0) > 0 && !(driverProfile as any)?.pix_key ? (
                <p className="text-xs text-amber-500 mt-3 text-center">
                  ⚠️ Cadastre sua chave PIX na aba Configurações para solicitar saque.
                </p>
              ) : null}
            </div>
          )}

          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-2xl p-3 text-center">
              <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Hoje</p>
              <p className="text-lg font-black text-green-500">R$ {todayEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 text-center">
              <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Semana</p>
              <p className="text-lg font-black text-blue-500">R$ {weekEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 text-center">
              <Package className="h-5 w-5 text-purple-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
              <p className="text-lg font-black text-purple-500">{totalDeliveries}</p>
            </div>
          </div>

          {/* Date filter */}
          <div className="flex gap-2">
            {([
              { key: "hoje" as DateFilter, label: "Hoje" },
              { key: "semana" as DateFilter, label: "7 dias" },
              { key: "mes" as DateFilter, label: "30 dias" },
              { key: "custom" as DateFilter, label: "Todos" },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${dateFilter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Earnings Breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-2xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">📱 Pix App (a receber)</p>
              <p className="text-lg font-black text-green-500">R$ {earningsBreakdown.pixEarnings.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{earningsBreakdown.pixCount} entregas</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">💵 Dinheiro (em mãos)</p>
              <p className="text-lg font-black text-amber-500">R$ {earningsBreakdown.cashEarnings.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{earningsBreakdown.cashCount} entregas</p>
            </div>
          </div>

          {/* Total Banner */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">💵 Total no período</p>
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

          {/* Withdrawal History */}
          {withdrawalHistory && withdrawalHistory.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Histórico de Saques
              </h3>
              <div className="space-y-2">
                {withdrawalHistory.map((w: any) => (
                  <div key={w.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{w.transaction_code || "#---"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-foreground">R$ {Number(w.amount).toFixed(2)}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${w.status === "solicitado" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"}`}>
                        {w.status === "solicitado" ? "⏳ Pendente" : "✅ Pago"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

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
                const isCash = order.payment_method === "dinheiro";
                return (
                  <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Store className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                        <span className="text-sm text-gray-200 font-medium truncate">{(order as any).stores?.name || "Loja"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{format(orderDate, "dd/MM HH:mm", { locale: ptBR })}</span>
                        <span>•</span>
                        <span className="truncate">{order.neighborhood}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isRural ? "bg-amber-500/20 text-amber-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                          {isRural ? "Rural" : "Urbano"}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCash ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>
                          {isCash ? "💵 Dinheiro" : "📱 Pix App"}
                        </span>
                      </div>
                    </div>
                    <p className="text-lg font-black text-green-400 ml-3">R$ {Number(order.delivery_fee).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="h-14 w-14 text-gray-700 mb-4" />
              <h2 className="text-base font-bold text-gray-500 mb-1">Nenhuma entrega neste período</h2>
              <p className="text-sm text-gray-600">Suas entregas finalizadas aparecerão aqui.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
