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
  CreditCard, Banknote, Settings, Save, AlertTriangle, User,
  Zap, ArrowRight, BarChart3, Eye
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

/* ─── Reusable UI Primitives ─── */
const StatCard = ({ icon: Icon, label, value, color = "text-primary" }: { icon: any; label: string; value: string; color?: string }) => (
  <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-1">
    <Icon className={`h-5 w-5 ${color}`} />
    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">{label}</p>
    <p className={`text-lg font-black ${color}`}>{value}</p>
  </div>
);

const SectionTitle = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 px-1">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{children}</h3>
  </div>
);

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
        .select("*, stores(name, owner_id, address_street, address_number, address_neighborhood, address_city, address_state, address_cep), order_items(*, products(name))")
        .eq("driver_id", user!.id)
        .in("status", ["pronto_para_entrega", "saiu_entrega", "em_transito"] as any)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 15000,
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

  const { data: pendingReturn } = useQuery({
    queryKey: ["driver-pending-return", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name)")
        .eq("driver_id", user!.id)
        .in("status", ["entregue", "finalizado"] as any)
        .in("payment_method", ["dinheiro", "cartao"])
        .eq("return_to_store_confirmed", false)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

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

  const earningsBreakdown = useMemo(() => {
    const pixEarnings = filteredHistory
      .filter((o: any) => !["dinheiro", "cartao"].includes(o.payment_method))
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
    const cashEarnings = filteredHistory
      .filter((o: any) => ["dinheiro", "cartao"].includes(o.payment_method))
      .reduce((sum: number, o: any) => sum + Number(o.delivery_fee), 0);
    const pixCount = filteredHistory.filter((o: any) => !["dinheiro", "cartao"].includes(o.payment_method)).length;
    const cashCount = filteredHistory.filter((o: any) => ["dinheiro", "cartao"].includes(o.payment_method)).length;
    return { pixEarnings, cashEarnings, pixCount, cashCount };
  }, [filteredHistory]);

  // ─── Side effects (same logic, untouched) ───
  useEffect(() => {
    if (!user) return;
    supabase.from("drivers").update({ is_online: isOnline } as any).eq("user_id", user.id).then(() => {});
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
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "UPDATE" && (payload.new as any).status === "pronto_para_entrega") {
          playAlert();
          notifyDeliveryAvailable();
          toast.info("🏍️ Nova entrega disponível!");
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
      .channel("driver-balance-realtime")
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
    const count = availableOrders?.length || 0;
    if (count > prevCountRef.current && prevCountRef.current >= 0) playAlert();
    prevCountRef.current = count;
  }, [availableOrders, playAlert]);

  // ─── Handlers (same logic) ───
  const toggleOnline = async () => {
    const next = !isOnline;
    setIsOnline(next);
    localStorage.setItem("driver_online", String(next));
    if (next) requestNotificationPermission();
    if (user) await supabase.from("drivers").update({ is_online: next } as any).eq("user_id", user.id);
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
          const msg = `🏍️ *FoodIta* informa: Seu lanche saiu para entrega! O motoboy já coletou o pedido e está a caminho de: ${myDelivery.address_details} 💨\n\n--------------------------\n💰 Total: R$ ${Number(myDelivery.total_price).toFixed(2)}\n💳 Pagamento: ${myDelivery.payment_method === "pix" ? "PIX" : myDelivery.payment_method === "cartao" ? "Cartão" : myDelivery.payment_method === "dinheiro" ? "Dinheiro" : myDelivery.payment_method}\nPedido: #${myDelivery.id.slice(0, 8).toUpperCase()}\n--------------------------`;
          setTimeout(() => openWhatsApp(clientPhone, msg), 600);
        }
      }
    }
  };

  const finishDelivery = async (orderId: string) => {
    if (pinInput.length !== 4) { toast.error("Digite o código de 4 dígitos do cliente."); return; }
    setVerifying(true);
    const orderData = myDelivery || availableOrders?.find((o: any) => o.id === orderId);
    const deliveryFee = Number(orderData?.delivery_fee || 0);
    const { error } = await supabase.rpc("driver_finish_delivery", { _order_id: orderId, _pin: pinInput } as any);
    if (error) {
      toast.error(error.message || "Código inválido. Verifique com o cliente.");
      setVerifying(false);
    } else {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
      const isPhysical = ["dinheiro", "cartao"].includes(orderData?.payment_method || "");
      if (isPhysical) {
        toast.success(`✅ Entrega confirmada! Retorne à loja para acertar R$ ${deliveryFee.toFixed(2)} em mãos.`, { duration: 8000, icon: "🏪" });
      } else {
        toast.success(`🎉 Parabéns! R$ ${deliveryFee.toFixed(2)} foi adicionado ao seu saldo Pix!`, { duration: 8000, icon: "💰" });
      }
      setPinInput("");
      setVerifying(false);
      queryClient.invalidateQueries({ queryKey: ["driver-my-delivery", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-history", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-balance", user!.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-earnings", user!.id] });
    }
  };

  const [settlementCodeInput, setSettlementCodeInput] = useState("");
  const [confirmingReturn, setConfirmingReturn] = useState(false);

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
  if (!user) { navigate("/auth", { replace: true }); return null; }

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
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

  const tabs = [
    { key: "entregas" as TabType, label: "Entregas", icon: Bike },
    { key: "historico" as TabType, label: "Ganhos", icon: BarChart3 },
    { key: "config" as TabType, label: "Pix", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto pb-24">
      {/* ─── Professional Header ─── */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bike className="h-3.5 w-3.5 text-primary" />
                </div>
                Painel Entregador
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected && isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                <span className="text-[10px] text-muted-foreground">
                  {isOnline ? (realtimeConnected ? "Conectado" : "Conectando...") : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={toggleOnline}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${isOnline ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${isOnline ? "left-7" : "left-0.5"}`} />
          </button>
        </div>
      </header>

      {/* ─── Tab Navigation ─── */}
      <div className="flex bg-card border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all relative ${isActive ? "text-primary" : "text-muted-foreground"}`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
              {isActive && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* ═════════════ ENTREGAS TAB ═════════════ */}
      {activeTab === "entregas" && (
        <>
          {!isOnline ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Bike className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">Você está offline</h2>
              <p className="text-sm text-muted-foreground max-w-xs">Ative o modo online para receber entregas.</p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard icon={DollarSign} label="Hoje" value={`R$ ${todayEarnings.toFixed(2)}`} color="text-green-500" />
                <StatCard icon={TrendingUp} label="Semana" value={`R$ ${weekEarnings.toFixed(2)}`} color="text-blue-500" />
                <StatCard icon={Package} label="Entregas" value={String(totalDeliveries)} color="text-primary" />
              </div>

              {/* Pix key warning */}
              {!(driverProfile as any)?.pix_key && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Cadastre sua chave Pix</p>
                    <p className="text-xs text-muted-foreground">Receba pagamentos automáticos</p>
                  </div>
                  <button onClick={() => setActiveTab("config")} className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap">
                    Cadastrar
                  </button>
                </div>
              )}

              {/* ─── Active Delivery ─── */}
              {myDelivery && (
                <div className="bg-card border-2 border-primary/30 rounded-2xl overflow-hidden">
                  {/* Delivery status banner */}
                  <div className="bg-primary/10 px-4 py-3 flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">
                      {(myDelivery as any).status === 'pronto_para_entrega' && !(myDelivery as any).collection_validated
                        ? "A CAMINHO DA LOJA"
                        : (myDelivery as any).collection_validated || (myDelivery as any).status === 'saiu_entrega'
                        ? "ENTREGA EM ANDAMENTO"
                        : "COLETA NA LOJA"}
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Store name & address */}
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground">{(myDelivery as any).stores?.name || "Loja"}</span>
                        {(() => {
                          const s = (myDelivery as any).stores;
                          const storeAddr = s?.address_street
                            ? `${s.address_street}${s.address_number ? `, ${s.address_number}` : ""} - ${s.address_neighborhood || ""}, ${s.address_city || "Itatinga"}`
                            : null;
                          if (!storeAddr) return null;
                          const encodedAddr = encodeURIComponent(storeAddr);
                          return (
                            <div className="mt-1 space-y-1.5">
                              <p className="text-xs text-muted-foreground">{storeAddr}</p>
                              <div className="flex gap-1.5">
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodedAddr}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-1 rounded-lg">
                                  <Navigation className="h-3 w-3" /> Google Maps
                                </a>
                                <a href={`https://waze.com/ul?q=${encodedAddr}&navigate=yes`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-2 py-1 rounded-lg">
                                  <Navigation className="h-3 w-3" /> Waze
                                </a>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {!(myDelivery as any).collection_validated && (myDelivery as any).status === 'pronto_para_entrega' ? (
                      <>
                        {/* Collection code section */}
                        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">Validar Coleta</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Peça o código de 4 dígitos ao lojista.</p>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="0000"
                              value={collectionCodeInput}
                              onChange={(e) => setCollectionCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                              className={`w-full text-center text-3xl font-black tracking-[0.5em] py-3 bg-card border-2 rounded-xl text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 transition-all ${
                                collectionCodeInput.length === 4 ? "border-green-500 focus:ring-green-500" : "border-border focus:ring-primary"
                              }`}
                            />
                            {collectionCodeInput.length === 4 && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-bounce">
                                <CheckCircle2 className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Order items */}
                        <div className="bg-muted/30 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Itens do pedido</p>
                          {(myDelivery as any).order_items?.map((item: any) => (
                            <p key={item.id} className="text-sm text-foreground">
                              <span className="text-primary font-bold">{item.quantity}x</span> {item.products?.name || "Item"}
                            </p>
                          ))}
                        </div>

                        {/* Earning display */}
                        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                          <span className="text-sm font-semibold text-foreground">Ganho da entrega</span>
                          <span className="text-xl font-black text-green-500">R$ {Number(myDelivery.delivery_fee).toFixed(2)}</span>
                        </div>

                        {/* WhatsApp store */}
                        {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                          <WhatsAppButton
                            number={getContactWhatsApp(deliveryStoreOwnerId)}
                            message={`Olá! Sou o entregador do app. Pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`}
                            label="Falar com a Loja"
                            size="md"
                            className="w-full"
                          />
                        )}

                        <button
                          onClick={() => validateCollection(myDelivery.id)}
                          disabled={collectionCodeInput.length !== 4 || verifyingCollection}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <ShieldCheck className="h-5 w-5" />
                          {verifyingCollection ? "Verificando..." : "VALIDAR COLETA"}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Delivery address */}
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                            <MapPin className="h-4 w-4 text-destructive" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground">{myDelivery.neighborhood}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{myDelivery.address_details}</p>
                          </div>
                        </div>

                        {/* Cash payment warning */}
                        {myDelivery.payment_method === "dinheiro" && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                            <p className="text-sm font-bold text-amber-500 mb-2">💰 Pagamento em Dinheiro</p>
                            <div className="text-xs text-muted-foreground space-y-1">
                              {(myDelivery as any).needs_change && Number((myDelivery as any).change_for) > 0 && (
                                <p>1️⃣ Pegar <span className="font-bold text-amber-500">R$ {(Number((myDelivery as any).change_for) - Number(myDelivery.total_price)).toFixed(2)}</span> de troco.</p>
                              )}
                              <p>{(myDelivery as any).needs_change ? "2️⃣" : "1️⃣"} Receber <span className="font-bold text-green-500">R$ {Number(myDelivery.total_price).toFixed(2)}</span> do cliente.</p>
                              <p>{(myDelivery as any).needs_change ? "3️⃣" : "2️⃣"} Retornar à loja para entregar o valor.</p>
                            </div>
                          </div>
                        )}

                        {/* WhatsApp contacts */}
                        <div className="flex gap-2">
                          {deliveryStoreOwnerId && getContactWhatsApp(deliveryStoreOwnerId) && (
                            <WhatsAppButton number={getContactWhatsApp(deliveryStoreOwnerId)} message={`Pedido #${myDelivery.id.slice(0, 8).toUpperCase()}.`} label="Loja" size="md" className="flex-1" />
                          )}
                          {deliveryClientId && getContactWhatsApp(deliveryClientId) && (
                            <WhatsAppButton number={getContactWhatsApp(deliveryClientId)} message="Olá, sou o entregador do FoodIta!" label="Cliente" size="md" className="flex-1" />
                          )}
                        </div>

                        {/* Items */}
                        <div className="bg-muted/30 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Itens</p>
                          {(myDelivery as any).order_items?.map((item: any) => (
                            <p key={item.id} className="text-sm text-foreground">
                              <span className="text-primary font-bold">{item.quantity}x</span> {item.products?.name || "Item"}
                            </p>
                          ))}
                        </div>

                        {/* Earning */}
                        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                          <span className="text-sm font-semibold text-foreground">Ganho</span>
                          <span className="text-xl font-black text-green-500">R$ {Number(myDelivery.delivery_fee).toFixed(2)}</span>
                        </div>

                        {/* PIN Input */}
                        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-bold text-foreground">Código do Cliente</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Peça o código de 4 dígitos ao cliente para finalizar.</p>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="0000"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="w-full text-center text-3xl font-black tracking-[0.5em] py-3 bg-card border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <button
                          onClick={() => finishDelivery(myDelivery.id)}
                          disabled={pinInput.length !== 4 || verifying}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          {verifying ? "Verificando..." : "CONFIRMAR ENTREGA"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Pending Return ─── */}
              {!myDelivery && pendingReturn && (
                <div className="bg-card border-2 border-amber-500/30 rounded-2xl overflow-hidden">
                  <div className="bg-amber-500/10 px-4 py-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-500">AGUARDANDO RETORNO À LOJA</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Entregue <span className="font-bold text-amber-500">R$ {Number(pendingReturn.total_price).toFixed(2)}</span> na loja <span className="font-bold text-foreground">{(pendingReturn as any).stores?.name}</span> e receba sua taxa.
                    </p>
                    <div>
                      <label className="text-xs font-bold text-amber-500 mb-2 block">🔐 Código de Acerto</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={settlementCodeInput}
                        onChange={(e) => setSettlementCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="0000"
                        className="w-full text-center text-2xl font-black tracking-[0.4em] bg-card border-2 border-amber-500/30 rounded-xl py-3 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <button
                      onClick={() => confirmStoreReturn(pendingReturn.id)}
                      disabled={settlementCodeInput.length !== 4 || confirmingReturn}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {confirmingReturn ? "Validando..." : "✅ Confirmar Acerto"}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Available Orders ─── */}
              {!myDelivery && !pendingReturn && (
                <>
                  <SectionTitle icon={Package}>Entregas disponíveis</SectionTitle>
                  {loadingAvailable ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse space-y-3">
                          <div className="h-4 bg-muted rounded w-1/2" />
                          <div className="h-3 bg-muted rounded w-3/4" />
                          <div className="h-12 bg-muted rounded" />
                        </div>
                      ))}
                    </div>
                  ) : availableOrders && availableOrders.length > 0 ? (
                    <div className="space-y-3">
                      {availableOrders.map((order: any) => (
                        <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Store className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-sm font-semibold text-foreground">{order.stores?.name || "Loja"}</span>
                            </div>

                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-sm text-foreground">{order.neighborhood}</span>
                                <p className="text-xs text-muted-foreground mt-0.5">{order.address_details}</p>
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {order.order_items?.map((item: any) => (
                                <span key={item.id} className="mr-2">{item.quantity}x {item.products?.name}</span>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Ganho</span>
                                <p className="text-xl font-black text-green-500">R$ {Number(order.delivery_fee).toFixed(2)}</p>
                              </div>
                              <button
                                onClick={() => acceptOrder(order.id)}
                                className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-sm active:scale-[0.98] transition-all flex items-center gap-2"
                              >
                                ACEITAR <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h2 className="text-base font-bold text-foreground mb-1">Aguardando pedidos...</h2>
                      <p className="text-sm text-muted-foreground">Aproveite para descansar! 😴</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ═════════════ PIX CONFIG TAB ═════════════ */}
      {activeTab === "config" && (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="bg-primary/5 px-4 py-3 flex items-center gap-3 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Minha Chave Pix</h2>
                <p className="text-[10px] text-muted-foreground">Recebimentos instantâneos</p>
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
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Como funciona?
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CreditCard className="h-3 w-3 text-green-500" />
                </div>
                <p><strong className="text-foreground">Pedidos via Pix/App:</strong> A taxa é transferida automaticamente para sua chave Pix.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Banknote className="h-3 w-3 text-amber-500" />
                </div>
                <p><strong className="text-foreground">Dinheiro:</strong> Você recebe a taxa em mãos. O sistema registra como "recebido".</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart3 className="h-3 w-3 text-primary" />
                </div>
                <p><strong className="text-foreground">Histórico:</strong> Na aba "Ganhos" veja o detalhamento.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════ GANHOS / FINANCEIRO TAB ═════════════ */}
      {activeTab === "historico" && (
        <div className="px-4 py-4 space-y-4">
          {/* Wallet Card */}
          {driverBalance && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-primary/5 px-4 py-3 flex items-center gap-2 border-b border-border">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Minha Carteira</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground font-semibold">Total Ganho</p>
                    <p className="text-lg font-black text-foreground">R$ {Number(driverBalance.total_earned || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-amber-500 font-semibold">Pendente</p>
                    <p className="text-lg font-black text-amber-500">R$ {Number(driverBalance.pending_amount || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-green-500 font-semibold">Pago</p>
                    <p className="text-lg font-black text-green-500">R$ {Number(driverBalance.paid_amount || 0).toFixed(2)}</p>
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
                          if (data?.active_request) toast.warning(`Solicitação de R$ ${Number(data.active_request.amount).toFixed(2)} em andamento.`);
                          else if (data?.limit_reached) toast.warning(data.error, { duration: 8000 });
                          else throw new Error(data.error);
                          return;
                        }
                        toast.success(`✅ Solicitação enviada! ID #${data?.request?.transaction_code} | R$ ${amount.toFixed(2)}.`);
                        queryClient.invalidateQueries({ queryKey: ["driver-balance"] });
                        queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
                        queryClient.invalidateQueries({ queryKey: ["withdrawal-history"] });
                      } catch (err: any) {
                        toast.error(err?.message || "Erro ao solicitar saque.");
                        queryClient.invalidateQueries({ queryKey: ["pending-withdrawal"] });
                      } finally { setRequestingSaque(false); }
                    }}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    {requestingSaque ? "PROCESSANDO..." : "SOLICITAR PAGAMENTO (PIX)"}
                  </button>
                ) : Number(driverBalance.pending_amount || 0) > 0 && !(driverProfile as any)?.pix_key ? (
                  <p className="text-xs text-amber-500 text-center">⚠️ Cadastre sua chave PIX na aba Pix para solicitar saque.</p>
                ) : null}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={DollarSign} label="Hoje" value={`R$ ${todayEarnings.toFixed(2)}`} color="text-green-500" />
            <StatCard icon={TrendingUp} label="Semana" value={`R$ ${weekEarnings.toFixed(2)}`} color="text-blue-500" />
            <StatCard icon={Package} label="Total" value={String(totalDeliveries)} color="text-primary" />
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
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${dateFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Earnings Breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-3.5 w-3.5 text-green-500" />
                <p className="text-[10px] text-muted-foreground">Pix App</p>
              </div>
              <p className="text-lg font-black text-green-500">R$ {Number(driverBalance?.pending_amount || 0).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{earningsBreakdown.pixCount} entregas</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] text-muted-foreground">Dinheiro</p>
              </div>
              <p className="text-lg font-black text-amber-500">R$ {earningsBreakdown.cashEarnings.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{earningsBreakdown.cashCount} entregas</p>
            </div>
          </div>

          {/* Total banner */}
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total no período</p>
              <p className="text-2xl font-black text-green-500">R$ {filteredEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{filteredHistory.length} entregas</p>
            </div>
            <button
              onClick={exportSummary}
              className="bg-muted hover:bg-muted/80 text-foreground p-3 rounded-xl active:scale-95 transition-all"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Withdrawal History */}
          {withdrawalHistory && withdrawalHistory.length > 0 && (
            <>
              <SectionTitle icon={Wallet}>Histórico de Saques</SectionTitle>
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${w.status === "solicitado" ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"}`}>
                        {w.status === "solicitado" ? "⏳ Pendente" : "✅ Pago"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Delivery History */}
          <SectionTitle icon={Clock}>Histórico de Corridas</SectionTitle>

          {loadingHistory ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
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
                  <div key={order.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Store className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground font-medium truncate">{(order as any).stores?.name || "Loja"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(orderDate, "dd/MM HH:mm", { locale: ptBR })}</span>
                        <span>•</span>
                        <span className="truncate">{order.neighborhood}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isRural ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                          {isRural ? "Rural" : "Urbano"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isCash ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"}`}>
                          {isCash ? "💵 Dinheiro" : "📱 Pix"}
                        </span>
                      </div>
                    </div>
                    <p className="text-lg font-black text-green-500 ml-3">R$ {Number(order.delivery_fee).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wallet className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-base font-bold text-foreground mb-1">Nenhuma entrega neste período</h2>
              <p className="text-sm text-muted-foreground">Suas entregas finalizadas aparecerão aqui.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
