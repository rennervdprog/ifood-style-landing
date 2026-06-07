import { formatBRL } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { getOrderItemDisplayName } from "@/lib/orderItemName";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
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
   aguardando_pagamento: { label: "Aguardando Pagamento", icon: Clock, color: "text-amber-700 dark:text-amber-400", bg: "bg-white dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800" },
   pendente: { label: "Pedido Recebido", icon: Clock, color: "text-blue-700 dark:text-blue-400", bg: "bg-white dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-900/50" },
   preparando: { label: "Preparando", icon: ChefHat, color: "text-orange-700 dark:text-orange-400", bg: "bg-white dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-900/50" },
   pronto_para_entrega: { label: "Pronto p/ Entrega", icon: CheckCircle2, color: "text-indigo-700 dark:text-indigo-400", bg: "bg-white dark:bg-indigo-950/20", border: "border-indigo-200 dark:border-indigo-900/50" },
    saiu_entrega: { label: "Saiu p/ Entrega", icon: Truck, color: "text-[#6A3B1F] dark:text-[#8B5E3C]", bg: "bg-white dark:bg-[#6A3B1F]/10", border: "border-[#6A3B1F]/20 dark:border-[#6A3B1F]/30" },
    em_transito: { label: "Em Trânsito", icon: Truck, color: "text-[#6A3B1F] dark:text-[#8B5E3C]", bg: "bg-white dark:bg-[#6A3B1F]/10", border: "border-[#6A3B1F]/20 dark:border-[#6A3B1F]/30" },
   entregue: { label: "Entregue", icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-white dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
   finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-white dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
   cancelado: { label: "Cancelado", icon: XCircle, color: "text-red-700 dark:text-red-400", bg: "bg-white dark:bg-red-950/20", border: "border-red-200 dark:border-red-900/50" },
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
  });
