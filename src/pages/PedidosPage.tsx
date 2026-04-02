import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { ClipboardList, Clock, ChefHat, Truck, CheckCircle2, Lock, Copy, QrCode, XCircle, X, Loader2, Trash2, ShieldAlert, AlertCircle, TimerReset, RefreshCw, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { notifyOrderPreparing, notifyOrderOnTheWay, notifyOrderDelivered } from "@/lib/notifications";
import OrderRating from "@/components/OrderRating";
import DeliveryTimeEstimate from "@/components/DeliveryTimeEstimate";
import OrderChat from "@/components/OrderChat";
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

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  aguardando_pagamento: { label: "Aguardando Pagamento", icon: Clock, color: "text-amber-500" },
  pendente: { label: "Pendente", icon: Clock, color: "text-yellow-500" },
  preparando: { label: "Preparando", icon: ChefHat, color: "text-orange-500" },
  pronto_para_entrega: { label: "Pronto p/ entrega", icon: CheckCircle2, color: "text-purple-500" },
  saiu_entrega: { label: "Saiu p/ entrega", icon: Truck, color: "text-blue-500" },
  em_transito: { label: "Em trânsito", icon: Truck, color: "text-cyan-500" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "text-green-500" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-green-500" },
  cancelado: { label: "Cancelado", icon: Clock, color: "text-red-500" },
};

const PedidosPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Handle Mercado Pago payment return
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
      // Clean up URL params
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(name), order_items(*, products(name))")
        .eq("client_id", user!.id)
        .eq("visible_to_client", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
  });

  const [clearingHistory, setClearingHistory] = useState(false);

  const clearHistory = async () => {
    if (!user) return;
    if (!confirm("Deseja ocultar todos os pedidos finalizados e cancelados da sua visualização?")) return;
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

  const hasCompletedOrders = orders?.some((o: any) =>
    ["entregue", "finalizado", "cancelado"].includes(o.status)
  );

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `client_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
          const newStatus = (payload.new as any).status;
          if (newStatus === "pendente" && (payload.old as any)?.status === "aguardando_pagamento") {
            toast.success("✅ Pagamento confirmado! Seu pedido foi enviado à loja.");
          }
          if (newStatus === "preparando") notifyOrderPreparing();
          if (newStatus === "em_transito" || newStatus === "saiu_entrega") notifyOrderOnTheWay();
          if (newStatus === "finalizado") notifyOrderDelivered();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const copyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    toast.success("Código copiado!");
  };

  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [pixModal, setPixModal] = useState<{
    orderId: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    loading: boolean;
  } | null>(null);

  const [pixCooldownMs, setPixCooldownMs] = useState(0);
  const [safetyModeMs, setSafetyModeMs] = useState(0);

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
        // --- SIMULATION MODE: bypass Mercado Pago ---
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

      const nameParts = (profile?.full_name || "Cliente FoodIta").split(" ");
      const firstName = nameParts[0] || "Cliente";
      const lastName = nameParts.slice(1).join(" ") || "FoodIta";
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
            description: `Pedido #${order.id.substring(0, 6).toUpperCase()} - ${order.stores?.name || "FoodIta"}`,
            payer_first_name: firstName,
            payer_last_name: lastName,
            payer_cpf: cpf,
          },
        }
      );

      if (pixError) throw pixError;

      if (pixData?.rate_limited) {
        activateSafetyMode();
        throw new Error("Sistema de pagamentos temporariamente indisponível. Tente novamente em alguns minutos.");
      }

      if (pixData?.error) {
        throw new Error(pixData.error);
      }

      // Standardized response: pix_code, qr_code_url (with fallback to legacy fields)
      const qrCode = pixData?.pix_code || pixData?.qr_code || null;
      const qrCodeBase64 = pixData?.qr_code_url || pixData?.qr_code_base64 || null;
      if (qrCode || qrCodeBase64) {
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
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;
    setCancellingOrderId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelado" as any })
        .eq("id", orderId)
        .eq("client_id", user!.id);
      if (error) throw error;
      toast.success("Pedido cancelado.");
      queryClient.invalidateQueries({ queryKey: ["orders", user!.id] });
    } catch (err) {
      toast.error("Erro ao cancelar pedido.");
    } finally {
      setCancellingOrderId(null);
    }
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

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <SimulationBanner />
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center justify-between h-14 px-4">
        <h1 className="font-bold text-foreground">Meus Pedidos</h1>
        {hasCompletedOrders && (
          <button
            onClick={clearHistory}
            disabled={clearingHistory}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Limpar
          </button>
        )}
      </header>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 border border-border animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          orders.map((order: any) => {
            const config = statusConfig[order.status] || statusConfig.pendente;
            const StatusIcon = config.icon;
            const isWaitingPayment = order.status === "aguardando_pagamento";
            const isCancelled = order.status === "cancelado";
                const isPaid = !["aguardando_pagamento", "cancelado"].includes(order.status);
                const showPin = order.delivery_pin && isPaid && !["entregue", "finalizado"].includes(order.status);
            return (
              <div key={order.id} className={`bg-card rounded-2xl p-4 border ${isCancelled ? "border-red-500/30 opacity-60" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-foreground">
                    {order.stores?.name || "Loja"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <DeliveryTimeEstimate status={order.status} createdAt={order.created_at} confirmedAt={order.confirmed_at} />
                    <div className={`flex items-center gap-1 text-xs font-bold ${config.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {config.label}
                    </div>
                  </div>
                </div>

                {/* Waiting Payment Banner */}
                {isWaitingPayment && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                        </div>
                        <span className="text-xs font-semibold text-amber-500">Aguardando Pagamento</span>
                      </div>
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={cancellingOrderId === order.id}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Safety mode / cooldown banners */}
                    {safetyModeMs > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 mb-2 flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-600">
                          Manutenção temporária no sistema de pagamentos. Voltará em {formatCooldownTime(safetyModeMs)}.
                        </p>
                      </div>
                    )}
                    {!safetyModeMs && pixCooldownMs > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 mb-2 flex items-start gap-2">
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
                  </div>
                )}

                {/* Delivery PIN Card */}
                {showPin && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3">
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
                        className="flex items-center gap-1 text-xs text-primary font-bold px-2 py-1 rounded-lg bg-primary/10"
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

                <div className="text-xs text-muted-foreground space-y-0.5">
                  {order.order_items?.map((item: any) => (
                    <p key={item.id}>
                      {item.quantity}x {item.products?.name || "Item"}
                    </p>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-sm font-black text-primary">
                    R$ {Number(order.total_price).toFixed(2)}
                  </span>
                </div>

                {/* Chat + Repeat buttons */}
                <div className="flex gap-2 mt-3">
                  {!["cancelado", "finalizado"].includes(order.status) && (
                    <OrderChat orderId={order.id} storeName={order.stores?.name || "Loja"} />
                  )}
                  {["entregue", "finalizado"].includes(order.status) && (
                    <button
                      onClick={() => {
                        navigate(`/loja/${order.store_id}`);
                        toast.info("Adicione os mesmos itens ao carrinho!");
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Pedir novamente
                    </button>
                  )}
                </div>

                {/* Rating section for delivered/finalized orders */}
                {["entregue", "finalizado"].includes(order.status) && user && !existingRatings?.has(order.id) && (
                  <div className="mt-3">
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
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="text-6xl mb-4">🍔</div>
            <h2 className="text-lg font-bold text-foreground mb-1">Tudo limpo por aqui!</h2>
            <p className="text-sm text-muted-foreground mb-6">Que tal pedir algo gostoso agora?</p>
            <button
              onClick={() => navigate("/")}
              className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl text-sm"
            >
              Ver Restaurantes
            </button>
          </div>
        )}
      </div>

      {/* PIX QR Code Modal */}
      {pixModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setPixModal(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground text-lg">Pagamento PIX</h3>
              <button onClick={() => setPixModal(null)} className="text-muted-foreground hover:text-foreground">
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
                {/* QR Code Image */}
                {pixModal.qrCodeBase64 && (
                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${pixModal.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-56 h-56 rounded-xl border border-border"
                    />
                  </div>
                )}

                {/* Copy Pix Code */}
                {pixModal.qrCode && (
                  <button
                    onClick={() => copyPixCode(pixModal.qrCode!)}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar Código PIX
                  </button>
                )}

                {/* Simulation: Simulate Payment Button */}
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

      <BottomNav />
    </div>
  );
};

export default PedidosPage;
