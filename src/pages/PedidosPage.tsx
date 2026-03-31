import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { ClipboardList, Clock, ChefHat, Truck, CheckCircle2, Lock, Copy, QrCode, XCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { notifyOrderPreparing, notifyOrderOnTheWay, notifyOrderDelivered } from "@/lib/notifications";

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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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
  const [pixModal, setPixModal] = useState<{
    orderId: string;
    qrCode: string | null;
    qrCodeBase64: string | null;
    loading: boolean;
  } | null>(null);

  const generatePix = async (order: any) => {
    if (!user) return;
    setPayingOrderId(order.id);
    setPixModal({ orderId: order.id, qrCode: null, qrCodeBase64: null, loading: true });

    try {
      // Get user profile for payer name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const nameParts = (profile?.full_name || "Cliente ItaFood").split(" ");
      const firstName = nameParts[0] || "Cliente";
      const lastName = nameParts.slice(1).join(" ") || "ItaFood";

      const { data: pixData, error: pixError } = await supabase.functions.invoke(
        "create-pix-payment",
        {
          body: {
            order_id: order.id,
            amount: Number(order.total_price),
            description: `Pedido #${order.id.substring(0, 6).toUpperCase()} - ${order.stores?.name || "ItaFood"}`,
            payer_first_name: firstName,
            payer_last_name: lastName,
          },
        }
      );

      if (pixError) throw pixError;

      if (pixData?.qr_code || pixData?.qr_code_base64) {
        setPixModal({
          orderId: order.id,
          qrCode: pixData.qr_code,
          qrCodeBase64: pixData.qr_code_base64,
          loading: false,
        });
      } else {
        throw new Error("QR Code não retornado");
      }
    } catch (err: any) {
      console.error("PIX generation error:", err);
      const errorMsg = err?.message?.includes("Chave") 
        ? err.message 
        : "Erro ao gerar PIX. Tente novamente.";
      toast.error(errorMsg);
      setPixModal(null);
    } finally {
      setPayingOrderId(null);
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
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
        <h1 className="font-bold text-foreground">Meus Pedidos</h1>
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
            const showPin = order.delivery_pin && !["entregue", "finalizado", "aguardando_pagamento", "cancelado"].includes(order.status);
            return (
              <div key={order.id} className={`bg-card rounded-2xl p-4 border ${isCancelled ? "border-red-500/30 opacity-60" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-foreground">
                    {order.stores?.name || "Loja"}
                  </h3>
                  <div className={`flex items-center gap-1 text-xs font-bold ${config.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {config.label}
                  </div>
                </div>

                {/* Waiting Payment Banner */}
                {isWaitingPayment && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                      <span className="text-xs font-bold text-amber-500">Aguardando Pagamento PIX</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">
                      Seu pedido será enviado à loja assim que o pagamento for confirmado.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => generatePix(order)}
                        disabled={payingOrderId === order.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                      >
                        <QrCode className="h-4 w-4" />
                        {payingOrderId === order.id ? "Gerando PIX..." : "Pagar com PIX agora"}
                      </button>
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={cancellingOrderId === order.id}
                        className="flex items-center justify-center gap-1 bg-red-500/10 text-red-400 font-bold px-3 py-2.5 rounded-xl text-xs border border-red-500/30 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {cancellingOrderId === order.id ? "..." : "Cancelar"}
                      </button>
                    </div>
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
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">Nenhum pedido ainda</h2>
            <p className="text-sm text-muted-foreground">Seus pedidos aparecerão aqui.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default PedidosPage;
