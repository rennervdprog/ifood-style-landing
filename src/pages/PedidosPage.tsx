import { formatBRL } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
 import { ClipboardList, Clock, ChefHat, Truck, CheckCircle2, Lock, Copy, QrCode, XCircle, X, Loader2, Trash2, ShieldAlert, AlertCircle, TimerReset, RefreshCw, MessageCircle, Bell, AlertTriangle, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { notifyOrderPreparing, notifyOrderOnTheWay, notifyOrderDelivered, pushNotifyNewOrder } from "@/lib/notifications";
import OrderRating from "@/components/OrderRating";

import DeliveryTimeEstimate from "@/components/DeliveryTimeEstimate";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import CancelOrderModal from "@/components/CancelOrderModal";
import RefundRequestModal from "@/components/RefundRequestModal";
import WalletBanner from "@/components/WalletBanner";
import { Capacitor } from "@capacitor/core";

import {
  recordPixAttempt,
  resetPixAttempts,
  isPixCooldownActive,
  getPixCooldownRemainingMs,
  activatePixCooldown,
  activateSafetyMode,
  isSafetyModeActive,
  getSafetyModeRemainingMs,
  formatCooldownTime,
} from "@/lib/pixSafeGuard";
import { SIMULATION_MODE, createSimulatedPixCharge, simulatePaymentDelay } from "@/lib/pixSimulation";
import SimulationBanner from "@/components/SimulationBanner";

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
   aguardando_pagamento: { label: "Aguardando Pagamento", icon: Clock, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800" },
   pendente: { label: "Pedido Recebido", icon: Clock, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-900/50" },
   preparando: { label: "Preparando", icon: ChefHat, color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-900/50" },
   pronto_para_entrega: { label: "Pronto p/ Entrega", icon: CheckCircle2, color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/20", border: "border-indigo-200 dark:border-indigo-900/50" },
   saiu_entrega: { label: "Saiu p/ Entrega", icon: Truck, color: "text-[#6A3B1F] dark:text-[#8B5E3C]", bg: "bg-[#6A3B1F]/5 dark:bg-[#6A3B1F]/10", border: "border-[#6A3B1F]/20 dark:border-[#6A3B1F]/30" },
   em_transito: { label: "Em Trânsito", icon: Truck, color: "text-[#6A3B1F] dark:text-[#8B5E3C]", bg: "bg-[#6A3B1F]/5 dark:bg-[#6A3B1F]/10", border: "border-[#6A3B1F]/20 dark:border-[#6A3B1F]/30" },
   entregue: { label: "Entregue", icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
   finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
   cancelado: { label: "Cancelado", icon: XCircle, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-900/50" },
};

/* Status timeline steps for visual progress */
const statusSteps = ["pendente", "preparando", "pronto_para_entrega", "saiu_entrega", "entregue"];
const pickupStatusSteps = ["pendente", "preparando", "pronto_para_entrega", "finalizado"];

const getStepIndex = (status: string, isPickup = false) => {
  if (status === "aguardando_pagamento") return -1;
  if (isPickup) {
    if (status === "finalizado") return 3;
    return pickupStatusSteps.indexOf(status);
  }
  if (status === "em_transito") return 3;
  if (status === "finalizado") return 4;
  return statusSteps.indexOf(status);
};

const StatusTimeline = ({ status, isPickup = false }: { status: string; isPickup?: boolean }) => {
  const currentIdx = getStepIndex(status, isPickup);
  if (currentIdx < 0 || status === "cancelado") return null;
  
  const labels = isPickup ? ["Recebido", "Preparando", "Pronto", "Retirado"] : ["Recebido", "Preparando", "Pronto", "A caminho", "Entregue"];
  const icons = isPickup ? [Clock, ChefHat, CheckCircle2, CheckCircle2] : [Clock, ChefHat, CheckCircle2, Truck, CheckCircle2];
  
  return (
    <div className="flex items-center justify-between mt-3 mb-1 px-1">
      {labels.map((label, i) => {
        const Icon = icons[i];
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={label} className="flex flex-col items-center gap-1 flex-1 relative">
            {i > 0 && (
              <div
                className={`absolute top-3 -left-1/2 right-1/2 h-0.5 ${i <= currentIdx ? "bg-primary" : "bg-border"}`}
              />
            )}
            <div
              className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                active
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : done
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
            </div>
            <span className={`text-[9px] font-bold leading-tight text-center ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const PedidosPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Check if user is lojista
  const { data: userProfile } = useQuery({
    queryKey: ["pedidos-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

   const isLojista = (userProfile?.role as string) === "lojista" || (userProfile?.role as string) === "admin";

  // Get lojista's store ID
  const { data: ownStore } = useQuery({
    queryKey: ["own-store-pedidos", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isLojista,
    staleTime: 1000 * 60 * 5,
  });

  // Handle payment return redirect
  const [showNewOrderNotifPrompt, setShowNewOrderNotifPrompt] = useState(false);
  const [isNewOrder, setIsNewOrder] = useState(false);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus) {
      if (paymentStatus === "success") {
        toast.success("✅ Pagamento confirmado com sucesso!");
      } else if (paymentStatus === "failure") {
        toast.error("❌ Pagamento não aprovado. Tente novamente.");
      } else if (paymentStatus === "pending") {
        toast("⏳ Pagamento pendente. Aguardando confirmação...");
      }
      setSearchParams({}, { replace: true });
    }

    // Show notification prompt + auto-open chat after new order
    if (searchParams.get("new_order") === "1") {
      setIsNewOrder(true);
      setSearchParams({}, { replace: true });
      
      // Prompt notifications only on web (Capacitor handles permissions natively via onboarding)
      if (!Capacitor.isNativePlatform() && "Notification" in window && Notification.permission === "default") {
        setTimeout(() => setShowNewOrderNotifPrompt(true), 1500);
      }
    }
  }, [searchParams, setSearchParams]);

  const storeFilter = searchParams.get("store");

  useEffect(() => {
    if (!storeFilter) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("store");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, storeFilter]);

  const refreshPedidosData = useCallback(async () => {
    if (!user) return;

    await Promise.allSettled([
      queryClient.refetchQueries({ queryKey: ["orders", user.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["own-store-pedidos", user.id], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["store-orders-lojista", ownStore?.id], type: "active" }),
    ]);
  }, [ownStore?.id, queryClient, user]);

  // Refetch orders when Capacitor app resumes from background
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    import("@capacitor/app")
      .then(async ({ App }) => {
        const listener = await App.addListener("appStateChange", (state: { isActive: boolean }) => {
          if (!state.isActive || !user) return;

          refreshPedidosData().catch(console.error);
        });

        cleanup = () => {
          listener.remove();
        };
      })
      .catch(() => {
        cleanup = undefined;
      });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshPedidosData().catch(console.error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cleanup?.();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshPedidosData, user]);

  // Client orders (for clients and lojistas viewing as client)
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, created_at, status, store_id, client_id, total_price, subtotal, delivery_fee, app_fee, payment_method, neighborhood, address_details, delivery_pin, collection_code, settlement_code, visible_to_client, return_to_store_confirmed, delivery_confirmed_by_client, confirmed_at, driver_id, scheduled_for, change_for, needs_change, stores(name, delivery_mode, slug, owner_id), order_items(id, quantity, unit_price, observations, addons, products(name))")
        .eq("client_id", user!.id)
        .eq("visible_to_client", true)
        .order("created_at", { ascending: false })
        .limit(100);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
       enabled: !!user,
    // Mostra cache imediatamente; revalida em background — evita "tela laranja"
    // ao reentrar na página em apps Capacitor.
    staleTime: 1000 * 30,
    refetchOnMount: true,
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      return data?.some((o: any) => o.status === "aguardando_pagamento") ? 5000 : false;
    },
  });

  // Store orders (for lojistas)
  const { data: storeOrders, isLoading: storeOrdersLoading } = useQuery({
    queryKey: ["store-orders-lojista", ownStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, store_id, client_id, total_price, subtotal, delivery_fee, app_fee, payment_method, neighborhood, address_details, delivery_pin, collection_code, settlement_code, confirmed_at, driver_id, scheduled_for, change_for, needs_change, order_items(id, quantity, unit_price, observations, addons, products(name))")
        .eq("store_id", ownStore!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ownStore?.id && isLojista,
    staleTime: 1000 * 30,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Fetch existing ratings to know which orders are already rated
  const { data: existingRatings, refetch: refetchRatings } = useQuery({
    queryKey: ["my-ratings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_ratings" as any)
        .select("order_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.order_id));
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const [clearingHistory, setClearingHistory] = useState(false);

  const clearHistory = async () => {
    if (!user) return;
    // CORREÇÃO: confirm() nativo removido — funciona mal em WebViews do Capacitor.
    // Confirmação via toast com ação de desfazer.
    setClearingHistory(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ visible_to_client: false } as any)
        .eq("client_id", user.id)
        .in("status", ["entregue", "finalizado", "cancelado"]);
      if (error) throw error;
      toast.success("Histórico limpo!");
      queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
    } catch {
      toast.error("Erro ao limpar histórico.");
    } finally {
      setClearingHistory(false);
    }
  };

  // 🔧 Diagnóstico: revela pedidos "sumidos" (visibilidade ou client_id divergente)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const runDiagnostic = useCallback(async () => {
    if (!user) { toast.error("Faça login primeiro."); return; }
    setDiagnosticLoading(true);
    setDiagnosticOpen(true);
    try {
      const { data: all, error } = await supabase
        .from("orders")
        .select("id, created_at, status, store_id, client_id, visible_to_client, total_price, payment_method, stores(name)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const hidden = (all || []).filter((o: any) => o.visible_to_client === false);
      setDiagnosticData({
        userId: user.id,
        email: user.email,
        total: all?.length || 0,
        hidden: hidden.length,
        list: all || [],
      });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "falha"));
      setDiagnosticData({ error: e?.message });
    } finally {
      setDiagnosticLoading(false);
    }
  }, [user]);

  const restoreOrderVisibility = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ visible_to_client: true } as any)
        .eq("id", orderId)
        .eq("client_id", user!.id);
      if (error) throw error;
      toast.success("Pedido restaurado!");
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
      runDiagnostic();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "falha"));
    }
  };

   const hasCompletedOrders = orders?.some((o: any) =>
     ["entregue", "finalizado", "cancelado"].includes(o.status)
   );

  // Realtime subscription for CLIENT orders
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`orders-realtime-client-${user.id}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `client_id=eq.${user.id}`,
      },
      (payload) => {
        const updated = payload.new as any;
        const previous = payload.old as any;

        if (payload.eventType === "INSERT") {
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
        } else if (payload.eventType === "UPDATE") {
          // Patch every cached variant (different storeFilter values share base key)
          queryClient.setQueriesData<any[] | undefined>(
            { queryKey: ["orders", user.id] },
            (old) => {
              if (!old) return old;
              const exists = old.findIndex((o: any) => o.id === updated.id);
              if (exists >= 0) {
                const copy = [...old];
                copy[exists] = { ...copy[exists], ...updated };
                return copy;
              }
              return old;
            }
          );
          // Safety net: invalidate so any new joined data (items, store) is fetched
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
        }

        if (payload.eventType !== "UPDATE") return;

        const newStatus = updated?.status;
        const oldStatus = previous?.status;

        if (!newStatus || newStatus === oldStatus) return;

        if (newStatus === "pendente" && oldStatus === "aguardando_pagamento") {
          const orderId = updated.id;
          clearPixForOrder(orderId);
          setPixModal(null);
          toast.success("✅ Pagamento confirmado! Seu pedido foi enviado à loja.");
        }

        if (newStatus === "preparando" && oldStatus !== "preparando") notifyOrderPreparing();
        if ((newStatus === "em_transito" || newStatus === "saiu_entrega") && oldStatus !== newStatus) notifyOrderOnTheWay();
        if ((newStatus === "finalizado" || newStatus === "entregue") && oldStatus !== newStatus) notifyOrderDelivered();
      }
    );
    subscribeWithRejoin(channel, (status) => {
      if (status === "SUBSCRIBED") {
        refreshPedidosData().catch(console.error);
      }
    });

    return () => {
      cleanupChannel(channel);
    };
  }, [refreshPedidosData, user, queryClient]);

  // Realtime subscription for LOJISTA store orders
  useEffect(() => {
    if (!ownStore?.id || !isLojista) return;
    const channel = supabase.channel(`store-orders-realtime-${ownStore.id}-${user?.id || "anon"}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `store_id=eq.${ownStore.id}`,
      },
      (payload) => {
        const updated = payload.new as any;

        if (payload.eventType === "INSERT") {
          queryClient.invalidateQueries({ queryKey: ["store-orders-lojista", ownStore.id] });
          toast.info("🔔 Novo pedido recebido!");
        } else if (payload.eventType === "UPDATE") {
          queryClient.setQueryData(["store-orders-lojista", ownStore.id], (old: any[] | undefined) => {
            if (!old) return old;
            const idx = old.findIndex((o: any) => o.id === updated.id);
            if (idx >= 0) {
              const copy = [...old];
              copy[idx] = { ...copy[idx], ...updated };
              return copy;
            }
            return [updated, ...old];
          });
        }
      }
    );
    subscribeWithRejoin(channel, (status) => {
      if (status === "SUBSCRIBED") {
        queryClient.invalidateQueries({ queryKey: ["store-orders-lojista", ownStore.id] });
      }
    });

    return () => {
      cleanupChannel(channel);
    };
  }, [ownStore?.id, isLojista, queryClient, refreshPedidosData]);

  const copyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast.success("Código copiado!");
  };

  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState<any>(null);
  const [showRefundModal, setShowRefundModal] = useState<any>(null);
  const [detailsOrder, setDetailsOrder] = useState<any>(null);

  // Fechar modal de detalhes ao usar o botão voltar (Android/navegador)
  useEffect(() => {
    if (!detailsOrder) return;
    window.history.pushState({ detailsModal: true }, "");
    const onPop = () => setDetailsOrder(null);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.detailsModal) {
        window.history.back();
      }
    };
  }, [detailsOrder]);

  const [pixModal, setPixModal] = useState<{
    orderId: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    loading: boolean;
  } | null>(null);

  // Persist PIX data per order in localStorage so it survives app restarts
  const [savedPixData, setSavedPixData] = useState<Record<string, { qrCode: string | null; qrCodeBase64: string | null }>>(() => {
    try {
      const stored = localStorage.getItem("pix_order_data");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const savePixForOrder = (orderId: string, qrCode: string | null, qrCodeBase64: string | null) => {
    setSavedPixData(prev => {
      const next = { ...prev, [orderId]: { qrCode, qrCodeBase64 } };
      localStorage.setItem("pix_order_data", JSON.stringify(next));
      return next;
    });
  };

  const clearPixForOrder = (orderId: string) => {
    setSavedPixData(prev => {
      const next = { ...prev };
      delete next[orderId];
      localStorage.setItem("pix_order_data", JSON.stringify(next));
      return next;
    });
  };

  const [pixCooldownMs, setPixCooldownMs] = useState(0);
  const [safetyModeMs, setSafetyModeMs] = useState(0);
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null);

  const handleConfirmDelivery = async (orderId: string) => {
    if (!user) return;
    setConfirmingDelivery(orderId);
    try {
      const { error } = await supabase.rpc("client_confirm_delivery", { _order_id: orderId });
      if (error) throw error;
      toast.success("Entrega confirmada! Obrigado 🎉");
      queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar entrega.");
    } finally {
      setConfirmingDelivery(null);
    }
  };

  // Poll cooldown / safety mode
  useEffect(() => {
    const interval = window.setInterval(() => {
      setPixCooldownMs(getPixCooldownRemainingMs("order_pix"));
      setSafetyModeMs(getSafetyModeRemainingMs());
    }, 1000);
    setPixCooldownMs(getPixCooldownRemainingMs("order_pix"));
    setSafetyModeMs(getSafetyModeRemainingMs());
    return () => window.clearInterval(interval);
  }, []);

  const isPixBlocked = pixCooldownMs > 0 || safetyModeMs > 0;

   // Webhook fallback: poll Asaas directly while any order is awaiting PIX payment.
  // CORREÇÃO PERFORMANCE: Polling manual removido.
  // O refetchInterval já cuida do polling (5s) quando há pedido aguardando_pagamento.
  // Ter dois pollings simultâneos (5s + 6s) dobrava a carga no Supabase.
  // O webhook automático do Asaas é a fonte primária de confirmação.
  // useEffect removido — confiar no refetchInterval + realtime subscription acima.
 
  const generatePix = async (order: any) => {
    if (!user) return;

    if (!SIMULATION_MODE && isSafetyModeActive()) {
      toast.error("Sistema de pagamentos em manutenção temporária. Aguarde alguns minutos.");
      return;
    }
    if (!SIMULATION_MODE && isPixCooldownActive("order_pix")) {
      toast.error("Muitas tentativas sem pagamento. Por segurança, aguarde alguns minutos.");
      return;
    }

    if (!SIMULATION_MODE) {
      recordPixAttempt("order_pix");
      if (isPixCooldownActive("order_pix")) {
        activatePixCooldown("order_pix");
        toast.error("Muitas tentativas sem pagamento. Por segurança, aguarde alguns minutos.");
        return;
      }
    }

    setPayingOrderId(order.id);
    setPixModal({ orderId: order.id, qrCode: null, qrCodeBase64: null, loading: true });

    try {
      if (SIMULATION_MODE) {
        // --- SIMULATION MODE: bypass real payment ---
        const sim = createSimulatedPixCharge(Number(order.total_price), "PIX");
        setPixModal({
          orderId: order.id,
          qrCode: sim.qr_code,
          qrCodeBase64: sim.qr_code_base64,
          loading: false,
        });
        toast.success(`[SIMULAÇÃO] PIX ${sim.reference_code} gerado!`);
        setPayingOrderId(null);
        return;
      }

      // Roteador universal de pagamentos com failover automático
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, document")
        .eq("user_id", user.id)
        .maybeSingle();

      const nameParts = (profile?.full_name || "Cliente ItaSuper").split(" ");
      const firstName = nameParts[0] || "Cliente";
      const lastName = nameParts.slice(1).join(" ") || "ItaSuper";
      const cpf = profile?.document?.replace(/\D/g, "") || "";

      if (!cpf || cpf.length !== 11) {
        toast.error("Cadastre seu CPF no perfil antes de pagar com PIX.");
        setPixModal(null);
        setPayingOrderId(null);
        return;
      }

      const { data: pixData, error: pixError } = await supabase.functions.invoke(
        "payment-router",
        {
          body: {
            action: "order_pix",
            order_id: order.id,
            amount: Number(order.total_price),
            description: `Pedido #${order.id.substring(0, 6).toUpperCase()} - ${order.stores?.name || "ItaSuper"}`,
            payer_first_name: firstName,
            payer_last_name: lastName,
            payer_cpf: cpf,
          },
        }
      );

      if (pixError) {
        console.error("PIX function error:", JSON.stringify(pixError, null, 2));
        const contextBody = (pixError as any)?.context?.body;
        let gatewayMessage = "";
        if (typeof contextBody === "string") {
          try {
            const parsedBody = JSON.parse(contextBody);
            gatewayMessage = parsedBody?.error || parsedBody?.message || "";
          } catch {
            gatewayMessage = contextBody;
          }
        } else if (contextBody && typeof contextBody === "object") {
          gatewayMessage = contextBody.error || contextBody.message || "";
        }
        throw new Error(gatewayMessage || pixError.message || "Erro ao gerar PIX.");
      }

      if (pixData?.rate_limited) {
        activateSafetyMode();
        throw new Error("Sistema de pagamentos temporariamente indisponível. Tente novamente em alguns minutos.");
      }

      if (pixData?.error) {
        const error = new Error(pixData.error) as Error & { missingPixKey?: boolean };
        error.missingPixKey = !!pixData.missing_pix_key;
        throw error;
      }

      // Standardized response: pix_code, qr_code_url (with fallback to legacy fields)
      const qrCode = pixData?.pix_code || pixData?.qr_code || null;
      const qrCodeBase64 = pixData?.qr_code_url || pixData?.qr_code_base64 || null;
      if (qrCode || qrCodeBase64) {
        // Save to localStorage so it persists across app restarts
        savePixForOrder(order.id, qrCode, qrCodeBase64);
        setPixModal({
          orderId: order.id,
          qrCode,
          qrCodeBase64,
          loading: false,
        });
        resetPixAttempts("order_pix");
      } else {
        throw new Error("QR Code não retornado");
      }
    } catch (err: any) {
      console.error("PIX generation error:", JSON.stringify(err, null, 2), "status:", err?.status, "code:", err?.code);

      if (err?.context?.status === 429 || err?.status === 429) {
        activateSafetyMode();
      }

      const msg = err?.message || err?.error_description || "Erro ao gerar PIX. Verifique se seu e-mail e CPF estão corretos.";
      if (err?.missingPixKey) {
        toast.error(msg, { duration: 9000 });
        return;
      }
      toast.error(msg);
      setPixModal(null);
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleSimulateOrderPayment = async () => {
    if (!pixModal || !user) return;
    setSimulatingPayment(true);
    try {
      await simulatePaymentDelay();
      // Update order status from aguardando_pagamento to pendente via secure RPC
      const { error } = await supabase
        .rpc("confirm_order_payment", { _order_id: pixModal.orderId });
      if (error) throw error;

      // Send push notification to store owner after PIX payment confirmed
      const order = orders?.find((o: any) => o.id === pixModal.orderId);
      if (order?.store_id) {
        const { data: storeData } = await supabase
          .from("stores")
          .select("owner_id")
          .eq("id", order.store_id)
          .single();
        if (storeData?.owner_id) {
          pushNotifyNewOrder([storeData.owner_id], order.id).catch(console.error);
        }
      }

      toast.success("[SIMULAÇÃO] Pagamento confirmado! Pedido enviado à loja.");
      setPixModal(null);
      queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao simular pagamento.");
    } finally {
      setSimulatingPayment(false);
    }
  };

  const copyPixCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado! Cole no app do seu banco.");
  };

  const cancelOrder = async (orderId: string) => {
    const order = orders?.find((o: any) => o.id === orderId);
    if (!order) return;

    // For PIX awaiting payment, cancel directly (no fee)
    if (order.status === "aguardando_pagamento" && order.payment_method === "pix") {
      // CORREÇÃO: confirm() nativo substituído por modal React — Capacitor WebView bloqueia confirm()
      // Redireciona para o CancelOrderModal que já suporta aguardando_pagamento (taxa 0%)
      setShowCancelModal(order);
      return;
    }

     if ((order.status as string) === "aguardando_pagamento_pix_direct") {
      // branch morto — mantido para segurança
      setCancellingOrderId(orderId);
      try {
        await supabase.functions.invoke("payment-router", {
          body: { action: "cancel_payment", order_id: orderId },
        });
        clearPixForOrder(orderId);
        // Use RPC for policy-based cancellation
        await supabase.rpc("apply_cancellation_policy", { _order_id: orderId });
        toast.success("Pedido e pagamento PIX cancelados.");
        queryClient.invalidateQueries({ queryKey: ["orders", user!.id] });
      } catch {
        toast.error("Erro ao cancelar pedido.");
      } finally {
        setCancellingOrderId(null);
      }
      return;
    }

    // For all other statuses, show the cancel modal with fee info
    setShowCancelModal(order);
  };

  if (!authLoading && !user) {
    return (
       <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
          <h1 className="font-bold text-foreground">Meus Pedidos</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">Faça login</h2>
          <p className="text-sm text-muted-foreground">Entre para ver seus pedidos.</p>
          <button
            onClick={() => navigate("/auth")}
            className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl"
          >
            Entrar
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Lojista view: show store orders with panel access
  if (isLojista && ownStore) {
    return (
      <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center justify-between h-14 px-4">
          <h1 className="font-bold text-foreground">Pedidos — {ownStore.name}</h1>
          <button
            onClick={() => navigate("/admin")}
            className="bg-primary text-primary-foreground font-bold px-4 py-1.5 rounded-full text-xs"
          >
            Acessar Painel
          </button>
        </header>

        <div className="px-4 py-4 space-y-3">
           {storeOrders && storeOrders.length > 0 ? (
            storeOrders.map((order: any) => {
              const config = statusConfig[order.status] || statusConfig.pendente;
              const StatusIcon = config.icon;
              return (
                <div key={order.id} className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-foreground">
                      #{order.id.substring(0, 6).toUpperCase()}
                    </h3>
                    <div className={`flex items-center gap-1 text-xs font-bold ${config.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {config.label}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {order.order_items?.map((item: any) => (
                      <div key={item.id}>
                        {item.quantity}x {getOrderItemDisplayName(item)} — {formatBRL((item.unit_price * item.quantity))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")} {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-bold text-sm text-foreground">
                      {formatBRL(Number(order.total_price))}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-lg font-bold text-foreground mb-1">Nenhum pedido</h2>
              <p className="text-sm text-muted-foreground">Sua loja ainda não recebeu pedidos.</p>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // Separate active and completed orders
  const activeOrders = orders?.filter((o: any) => !["entregue", "finalizado", "cancelado"].includes(o.status)) || [];
  const completedOrders = orders?.filter((o: any) => ["entregue", "finalizado", "cancelado"].includes(o.status)) || [];

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <SimulationBanner />

      {/* New order notification prompt */}
      {showNewOrderNotifPrompt && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-card border border-primary/30 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-4">
          <button onClick={() => setShowNewOrderNotifPrompt(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground">🔔 Ative as notificações!</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Receba avisos quando seu pedido estiver pronto ou a caminho.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => {
                try {
                  if (Capacitor.isNativePlatform()) {
                    const { registerCapacitorPush } = await import("@/lib/capacitorNative");
                    await registerCapacitorPush();
                  } else {
                    const { requestPushPermissionAndRegister } = await import("@/lib/firebase");
                    const token = await requestPushPermissionAndRegister();
                    if (!token) return;
                  }
                  toast.success("Notificações ativadas! 🎉");
                } catch (error) {
                  console.error("New order notification enable error:", error);
                  toast.error("Erro ao ativar notificações.");
                } finally {
                  setShowNewOrderNotifPrompt(false);
                }
              }}
              className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
            >
              Ativar agora
            </button>
            <button
              onClick={() => setShowNewOrderNotifPrompt(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80"
            >
              Depois
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="font-black text-foreground">Meus Pedidos</h1>
          </div>
          {hasCompletedOrders && (
            <button
              onClick={clearHistory}
              disabled={clearingHistory}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 bg-muted/50 px-3 py-1.5 rounded-full"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar histórico
            </button>
          )}
          <button
            onClick={runDiagnostic}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            title="Diagnosticar pedidos sumidos"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Diag
          </button>
        </div>
      </header>

      {diagnosticOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setDiagnosticOpen(false)}>
          <div className="bg-card rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-foreground">🔍 Diagnóstico de Pedidos</h3>
              <button onClick={() => setDiagnosticOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {diagnosticLoading ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : diagnosticData?.error ? (
              <div className="text-destructive text-sm">{diagnosticData.error}</div>
            ) : diagnosticData ? (
              <>
                <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1 font-mono">
                  <div><b>Email:</b> {diagnosticData.email}</div>
                  <div><b>User ID:</b> {diagnosticData.userId}</div>
                  <div><b>Total pedidos (últimos 20):</b> {diagnosticData.total}</div>
                  <div><b>Ocultos (visible=false):</b> {diagnosticData.hidden}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Se o pedido que você procura <b>não aparece nesta lista</b>, ele foi criado com <b>outra conta</b> (login diferente no checkout). Se aparecer com 🔒 oculto, clique em "Restaurar".
                </div>
                <div className="space-y-2">
                  {diagnosticData.list.map((o: any) => (
                    <div key={o.id} className={`border rounded-lg p-2.5 text-xs ${o.visible_to_client ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10" : "border-amber-300 bg-amber-50 dark:bg-amber-900/10"}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold">#{o.id.slice(0, 8).toUpperCase()} {o.visible_to_client ? "✅" : "🔒 oculto"}</div>
                          <div className="text-muted-foreground">{o.stores?.name || "—"} · {o.status} · {formatBRL(o.total_price)}</div>
                          <div className="text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</div>
                        </div>
                        {!o.visible_to_client && (
                          <button onClick={() => restoreOrderVisibility(o.id)} className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-1 rounded shrink-0">Restaurar</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {diagnosticData.list.length === 0 && (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Nenhum pedido encontrado para esta conta.<br/>
                      Provavelmente você fez o pedido logado em outra conta.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Wallet Banner */}
        <WalletBanner />
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-5 border border-border animate-pulse space-y-3">
                <div className="flex justify-between">
                  <div className="h-5 bg-muted rounded-full w-32" />
                  <div className="h-5 bg-muted rounded-full w-24" />
                </div>
                <div className="h-8 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          <>
            {/* Active orders section */}
            {activeOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Pedidos em andamento ({activeOrders.length})
                </h2>
                {activeOrders.map((order: any, orderIdx: number) => {
                  const config = statusConfig[order.status] || statusConfig.pendente;
                  const StatusIcon = config.icon;
                  const isWaitingPayment = order.status === "aguardando_pagamento";
                  const isPaid = !["aguardando_pagamento", "cancelado"].includes(order.status);
                  const isOwnDeliveryStore = order.stores?.delivery_mode === "own";
                  const showPin = order.delivery_pin && isPaid && !["entregue", "finalizado"].includes(order.status);

                  return (
                     <div key={order.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                       {/* Status bar top */}
                       <div className="px-3 py-2 flex items-center justify-between gap-2 bg-card border-b border-border">
                         <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${config.border} ${config.bg}`}>
                           <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
                           <span className={`text-[11px] font-bold leading-none ${config.color}`}>
                             {order.neighborhood === "RETIRADA" && order.status === "pronto_para_entrega" ? "Pronto p/ Retirada" : config.label}
                           </span>
                         </div>
                         <div className="flex items-center gap-2 min-w-0">
                           <DeliveryTimeEstimate status={order.status} createdAt={order.created_at} confirmedAt={order.confirmed_at} />
                           <span className="text-[10px] text-muted-foreground font-mono tabular-nums truncate">
                             #{order.id.substring(0, 6).toUpperCase()}
                           </span>
                         </div>
                       </div>

                      <div className="p-4 space-y-3">
                        {/* Store name */}
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground text-sm">{order.stores?.name || "Loja"}</h3>
                          <span className="text-sm font-black text-primary">
                            {formatBRL(Number(order.total_price))}
                          </span>
                        </div>

                        {/* Timeline */}
                        {!isWaitingPayment && <StatusTimeline status={order.status} isPickup={order.neighborhood === "RETIRADA"} />}

                        {/* Waiting Payment (background changed to white) */}
                        {isWaitingPayment && (() => {
                          const hasSavedPix = savedPixData[order.id];
                          return (
                            <div className="bg-white dark:bg-card border border-amber-200 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                                  <span className="text-xs font-semibold text-amber-600">Aguardando Pagamento</span>
                                </div>
                                <button
                                  onClick={() => cancelOrder(order.id)}
                                  disabled={cancellingOrderId === order.id}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>

                              {hasSavedPix && (hasSavedPix.qrCode || hasSavedPix.qrCodeBase64) && (
                                <div className="space-y-3 mb-3">
                                  {hasSavedPix.qrCodeBase64 && (
                                    <div className="flex justify-center">
                                      <img
                                        src={hasSavedPix.qrCodeBase64.startsWith("data:") ? hasSavedPix.qrCodeBase64 : `data:image/png;base64,${hasSavedPix.qrCodeBase64}`}
                                        alt="QR Code PIX"
                                        className="w-48 h-48 rounded-xl border border-border"
                                      />
                                    </div>
                                  )}
                                  {hasSavedPix.qrCode && (
                                    <button
                                      onClick={() => copyPixCode(hasSavedPix.qrCode!)}
                                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                      Copiar Código PIX
                                    </button>
                                  )}
                                  <div className="bg-card rounded-lg p-2 text-center">
                                    <p className="text-[10px] text-muted-foreground">
                                      📱 Escaneie o QR Code ou cole o código no app do seu banco.
                                    </p>
                                    <p className="text-[10px] text-primary font-bold mt-1">
                                      ✅ Após pagar, seu pedido será liberado automaticamente!
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => generatePix(order)}
                                    disabled={payingOrderId === order.id || isPixBlocked}
                                    className="w-full flex items-center justify-center gap-2 text-muted-foreground font-medium py-1.5 text-[10px] hover:text-foreground transition-colors"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    Gerar novo QR Code
                                  </button>
                                </div>
                              )}

                              {!hasSavedPix && (
                                <>
                                  {safetyModeMs > 0 && (
                                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 mb-2 flex items-start gap-2">
                                      <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                      <p className="text-[10px] text-amber-600">
                                        Manutenção temporária. Voltará em {formatCooldownTime(safetyModeMs)}.
                                      </p>
                                    </div>
                                  )}
                                  {!safetyModeMs && pixCooldownMs > 0 && (
                                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 mb-2 flex items-start gap-2">
                                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                      <p className="text-[10px] text-amber-600">
                                        Muitas tentativas. Aguarde {formatCooldownTime(pixCooldownMs)}.
                                      </p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => generatePix(order)}
                                    disabled={payingOrderId === order.id || isPixBlocked}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                                  >
                                    {isPixBlocked ? (
                                      <>
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        Aguarde...
                                      </>
                                    ) : (
                                      <>
                                        <QrCode className="h-3.5 w-3.5" />
                                        {payingOrderId === order.id ? "Gerando..." : "Pagar com PIX"}
                                      </>
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()}

                        {/* Pickup badge (background changed to white) */}
                        {order.neighborhood === "RETIRADA" && order.status === "pronto_para_entrega" && (
                          <div className="bg-white dark:bg-card border border-primary/20 rounded-xl p-3 flex items-center gap-2">
                            <span className="text-lg">🏪</span>
                            <div>
                              <span className="text-xs font-bold text-primary">Pronto para retirada!</span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Dirija-se à loja para retirar seu pedido.</p>
                            </div>
                          </div>
                        )}

                        {/* Delivery PIN (not for pickup) (background changed to white) */}
                        {order.neighborhood !== "RETIRADA" && showPin && (
                          <div className="bg-white dark:bg-card border border-primary/20 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Lock className="h-4 w-4 text-primary" />
                              <span className="text-xs font-bold text-primary">Código de Entrega</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-black text-foreground tracking-[0.3em]">
                                {order.delivery_pin}
                              </span>
                              <button
                                onClick={() => copyPin(order.delivery_pin)}
                                className="flex items-center gap-1 text-xs text-primary font-bold px-3 py-1.5 rounded-lg bg-primary/10"
                              >
                                <Copy className="h-3 w-3" />
                                Copiar
                              </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Informe ao motoboy apenas quando receber seu pedido.
                            </p>
                          </div>
                        )}

                        {/* Live Tracking Map - not for pickup orders */}
                        {order.neighborhood !== "RETIRADA" && (["saiu_entrega", "em_transito"].includes(order.status) || (order.status === "pronto_para_entrega" && order.driver_id)) && (
                          <LiveTrackingMap
                            orderId={order.id}
                            driverId={order.driver_id}
                            storeId={order.store_id}
                            clientAddress={order.address_details || ""}
                            clientLat={(order as any).client_lat}
                            clientLng={(order as any).client_lng}
                          />
                        )}

                        {/* Confirm Delivery (not for pickup orders) (background changed to white) */}
                        {order.neighborhood !== "RETIRADA" && ["saiu_entrega", "em_transito"].includes(order.status) && !(order as any).delivery_confirmed_by_client && (
                          <div className="bg-white dark:bg-card border border-emerald-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-bold text-emerald-600">Recebeu seu pedido?</span>
                            </div>
                            <button
                              onClick={() => handleConfirmDelivery(order.id)}
                              disabled={confirmingDelivery === order.id}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50 transition-colors"
                            >
                              {confirmingDelivery === order.id ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Confirmando...
                                </span>
                              ) : (
                                "✅ Sim, recebi meu pedido!"
                              )}
                            </button>
                          </div>
                        )}

                        {/* Items + financial breakdown (background changed to white) */}
                        <div className="bg-white dark:bg-card border border-border/40 rounded-xl p-3 space-y-2">
                          <div className="text-xs text-foreground/80 space-y-1">
                            {order.order_items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between">
                                <span>{item.quantity}x {getOrderItemDisplayName(item)}</span>
                                <span className="font-medium text-foreground">{formatBRL((item.unit_price * item.quantity))}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-border/60 pt-2 space-y-1 text-[11px]">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span>
                              <span>{formatBRL(Number(order.subtotal))}</span>
                            </div>
                            {Number(order.delivery_fee) > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Taxa de entrega</span>
                                <span>{formatBRL(Number(order.delivery_fee))}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-foreground pt-1">
                              <span>Total</span>
                              <span className="text-primary">{formatBRL(Number(order.total_price))}</span>
                            </div>
                          </div>
                        </div>

                        {/* Footer: date + cancel as subtle link */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          {["pendente", "preparando", "pronto_para_entrega"].includes(order.status) && (
                            <button
                              onClick={() => cancelOrder(order.id)}
                              className="text-[10px] font-semibold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                            >
                              <X className="h-3 w-3" />
                              Cancelar pedido
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed orders */}
            {completedOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mt-2">
                  Anteriores ({completedOrders.length})
                </h2>
                {completedOrders.map((order: any) => {
                  const config = statusConfig[order.status] || statusConfig.pendente;
                  const StatusIcon = config.icon;
                  const isCancelled = order.status === "cancelado";

                  return (
                    <div key={order.id} className={`bg-white dark:bg-card rounded-2xl border overflow-hidden ${isCancelled ? "border-red-200 opacity-60" : "border-border"}`}>
                      {isCancelled && order.cancel_reason && (
                        <div className="px-4 py-2 bg-red-500/8 border-b border-red-200 dark:border-red-900/40 flex items-center gap-2">
                          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                          <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">
                            {{
                              out_of_stock:   "Produto esgotado no estoque",
                              client_request: "Cancelado a pedido do cliente",
                              out_of_area:    "Fora da área de entrega",
                              closed:         "Loja fechada / sem entregador",
                              other:          "Cancelado pela loja",
                            }[order.cancel_reason as string] || order.cancel_reason}
                          </p>
                        </div>
                      )}
                      {/* Compact header — clickable to open details */}
                      <button
                        type="button"
                        onClick={() => setDetailsOrder(order)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bg}`}>
                            <StatusIcon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground">{order.stores?.name || "Loja"}</h3>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "2-digit",
                              })} · {config.label}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {formatBRL(Number(order.total_price))}
                        </span>
                      </button>

                       {/* Items summary — also clickable */}
                       <button
                         type="button"
                         onClick={() => setDetailsOrder(order)}
                         className="w-full px-4 pb-2 text-left"
                       >
                         <p className="text-xs text-muted-foreground truncate">
                           {order.order_items?.map((item: any) => `${item.quantity}x ${getOrderItemDisplayName(item)}`).join(", ")}
                         </p>
                       </button>

                       {/* Show details CTA */}
                       <div className="px-4 pb-2">
                         <button
                           type="button"
                           onClick={() => setDetailsOrder(order)}
                           className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary-foreground bg-primary px-3 py-2 rounded-full hover:opacity-90 active:scale-[0.98] transition"
                         >
                           Mostrar detalhes do pedido →
                         </button>
                       </div>

                      {/* Actions */}
                      <div className="px-4 pb-3 flex items-center gap-2">
                        {["entregue", "finalizado"].includes(order.status) && (
                          <button
                            onClick={() => {
                              navigate(order.stores?.slug ? `/${order.stores.slug}` : `/loja/${order.store_id}`);
                              toast.info("Adicione os mesmos itens ao carrinho!");
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Pedir novamente
                          </button>
                        )}
                        {["entregue", "finalizado"].includes(order.status) && (
                          <button
                            onClick={() => setShowRefundModal(order)}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Reembolso
                          </button>
                        )}
                      </div>

                      {/* Rating */}
                      {["entregue", "finalizado"].includes(order.status) && user && !existingRatings?.has(order.id) && (
                        <div className="px-4 pb-4 border-t border-border pt-3">
                          <OrderRating
                            orderId={order.id}
                            storeId={order.store_id}
                            storeName={order.stores?.name || "Loja"}
                            userId={user.id}
                            onRated={() => refetchRatings()}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ClipboardList className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Nenhum pedido ainda</h2>
            <p className="text-sm text-muted-foreground mb-6">Explore as lojas e faça seu primeiro pedido!</p>
             <button
               onClick={() => navigate("/lojas")}
               className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl text-sm shadow-lg active:scale-95 transition-transform"
             >
               Ver Restaurantes
             </button>
             <div className="mt-8 pt-8 border-t border-border w-full">
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-4">Recomendado para você</p>
               <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center gap-4 text-left" onClick={() => navigate("/lojas")}>
                 <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                   <Zap className="h-6 w-6 text-primary-foreground" />
                 </div>
                 <div>
                   <h4 className="text-sm font-bold text-foreground">Primeira fome do dia?</h4>
                   <p className="text-[11px] text-muted-foreground">Confira as lojas abertas agora em Itatinga.</p>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* PIX QR Code Modal */}
      {pixModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPixModal(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <QrCode className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">Pagamento PIX</h3>
              </div>
              <button onClick={() => setPixModal(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {pixModal.loading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pixModal.qrCodeBase64 && (
                  <div className="flex justify-center">
                    <img
                      src={pixModal.qrCodeBase64.startsWith("data:") ? pixModal.qrCodeBase64 : `data:image/png;base64,${pixModal.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-56 h-56 rounded-xl border border-border"
                    />
                  </div>
                )}

                {pixModal.qrCode && (
                  <button
                    onClick={() => copyPixCode(pixModal.qrCode!)}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm shadow-lg"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar Código PIX
                  </button>
                )}

                {SIMULATION_MODE && (
                  <button
                    onClick={handleSimulateOrderPayment}
                    disabled={simulatingPayment}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                  >
                    {simulatingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "🧪 Simular Pagamento (Ambiente de Teste)"
                    )}
                  </button>
                )}

                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {SIMULATION_MODE
                      ? "⚠️ Modo de simulação ativo. Use o botão acima para simular o pagamento."
                      : "📱 Abra o app do seu banco, escolha Pagar com PIX e escaneie o QR Code ou cole o código copiado."}
                  </p>
                  <p className="text-xs text-primary font-bold mt-2">
                    ✅ Após pagar, seu pedido será liberado automaticamente!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <CancelOrderModal
          order={showCancelModal}
          onClose={() => setShowCancelModal(null)}
          onCancelled={() => {
            setShowCancelModal(null);
            queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["user-wallet", user?.id] });
          }}
        />
      )}

      {/* Refund Request Modal */}
      {showRefundModal && (
        <RefundRequestModal
          order={showRefundModal}
          onClose={() => setShowRefundModal(null)}
          onSubmitted={() => {
            setShowRefundModal(null);
          }}
        />
      )}

      {/* Order Details Modal */}
      {detailsOrder && (() => {
        const o = detailsOrder;
        const cfg = statusConfig[o.status] || statusConfig.pendente;
        const StatusIcon = cfg.icon;
        const created = new Date(o.created_at);
        const confirmed = o.confirmed_at ? new Date(o.confirmed_at) : null;
        const elapsedMin = confirmed
          ? Math.max(1, Math.round((confirmed.getTime() - created.getTime()) / 60000))
          : null;
        const paymentLabels: Record<string, string> = {
          pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro",
          credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito",
          cartao_credito: "Cartão de Crédito", cartao_debito: "Cartão de Débito",
        };
        const fmtDateTime = (d: Date) => d.toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "2-digit",
          hour: "2-digit", minute: "2-digit",
        });
        return (
          <div
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setDetailsOrder(null)}
          >
            <div
              className="bg-card w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cfg.bg} shrink-0`}>
                    <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate">{o.stores?.name || "Loja"}</h3>
                    <p className="text-[10px] text-muted-foreground">#{String(o.id).slice(0, 8).toUpperCase()} · {cfg.label}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailsOrder(null)}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Tempos */}
                <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Tempos</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Pedido feito</span>
                    <span className="font-medium text-foreground">{fmtDateTime(created)}</span>
                  </div>
                  {confirmed && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Concluído</span>
                      <span className="font-medium text-foreground">{fmtDateTime(confirmed)}</span>
                    </div>
                  )}
                  {elapsedMin !== null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Duração total</span>
                      <span className="font-bold text-primary">{elapsedMin} min</span>
                    </div>
                  )}
                </div>

                {/* Itens */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Itens do pedido</p>
                  <div className="space-y-2">
                    {o.order_items?.map((item: any) => {
                      let raw = item.addons;
                      if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = []; } }
                      const addons = Array.isArray(raw) ? raw : [];
                      const extras = addons.filter((a: any) => !(typeof a?.name === "string" && a.name.startsWith("½ ")));
                      return (
                        <div key={item.id} className="bg-muted/30 rounded-xl p-3">
                          <div className="flex justify-between items-baseline gap-2">
                            <span className="text-sm font-medium text-foreground">
                              <span className="text-primary font-black mr-1.5">{item.quantity}x</span>
                              {getOrderItemDisplayName(item)}
                            </span>
                            <span className="text-xs font-bold text-foreground whitespace-nowrap">
                              {formatBRL(Number(item.unit_price) * item.quantity)}
                            </span>
                          </div>
                          {extras.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {extras.map((a: any, idx: number) => (
                                <li key={idx} className="text-[11px] text-muted-foreground">
                                  + {a.name}{a.price ? ` (${formatBRL(Number(a.price))})` : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                          {item.observations && (
                            <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                              Obs: {item.observations}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pagamento e valores */}
                <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Pagamento</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Forma</span>
                    <span className="font-bold text-foreground">{paymentLabels[o.payment_method] || o.payment_method || "—"}</span>
                  </div>
                  {o.needs_change && o.change_for && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Troco para</span>
                      <span className="font-medium text-foreground">{formatBRL(Number(o.change_for))}</span>
                    </div>
                  )}
                  {o.subtotal != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium text-foreground">{formatBRL(Number(o.subtotal))}</span>
                    </div>
                  )}
                  {Number(o.delivery_fee) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Taxa de entrega</span>
                      <span className="font-medium text-foreground">{formatBRL(Number(o.delivery_fee))}</span>
                    </div>
                  )}
                  {Number(o.app_fee) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Taxa de serviço</span>
                      <span className="font-medium text-foreground">{formatBRL(Number(o.app_fee))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-1.5 border-t border-border">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-black text-primary">{formatBRL(Number(o.total_price))}</span>
                  </div>
                </div>

                {/* Endereço */}
                {o.neighborhood && (
                  <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {o.neighborhood === "RETIRADA" ? "Retirada na loja" : "Entrega"}
                    </p>
                    {o.neighborhood !== "RETIRADA" && (
                      <>
                        <p className="text-xs text-foreground font-medium">{o.neighborhood}</p>
                        {o.address_details && (
                          <p className="text-[11px] text-muted-foreground">{o.address_details}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Avaliação */}
                {["entregue", "finalizado"].includes(o.status) && user && (
                  existingRatings?.has(o.id) ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-primary">⭐ Você já avaliou este pedido</p>
                    </div>
                  ) : (
                    <OrderRating
                      orderId={o.id}
                      storeId={o.store_id}
                      storeName={o.stores?.name || "Loja"}
                      userId={user.id}
                      onRated={() => refetchRatings()}
                    />
                  )
                )}
              </div>

              {/* Footer fixo com botão Fechar */}
              <div className="bg-card border-t border-border px-4 py-3 shrink-0" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
                <button
                  onClick={() => setDetailsOrder(null)}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-full hover:opacity-90 transition-opacity"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav />
    </div>
  );
};

import { useIsReseller as _useIsReseller } from "@/hooks/useIsReseller";
import ResellerIndicacoes from "./revendedor/ResellerIndicacoes";

const PedidosPageSwitch = () => {
  const { isReseller, loading } = _useIsReseller();
  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (isReseller) return <ResellerIndicacoes />;
  return <PedidosPage />;
};

export default PedidosPageSwitch;
