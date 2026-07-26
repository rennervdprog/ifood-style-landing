import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { X, AlertTriangle, Loader2, Wallet, Clock, CheckCircle2, Banknote } from "lucide-react";

const FEE_TABLE: Record<string, { percent: number; label: string }> = {
  aguardando_pagamento: { percent: 0, label: "Sem taxa" },
  pendente: { percent: 0, label: "Sem taxa" },
  preparando: { percent: 20, label: "20% de taxa (já em preparo)" },
  pronto_para_entrega: { percent: 40, label: "40% de taxa (pedido pronto)" },
  saiu_entrega: { percent: 60, label: "60% de taxa (em rota)" },
  em_transito: { percent: 60, label: "60% de taxa (em rota)" },
};

const TIME_LIMIT_MINUTES = 20;

interface Props {
  order: {
    id: string;
    status: string;
    subtotal: number;
    total_price: number;
    payment_method: string;
    confirmed_at?: string | null;
    created_at?: string;
    stores?: { name?: string };
  };
  onClose: () => void;
  onCancelled: () => void;
}

const CancelOrderModal = ({ order, onClose, onCancelled }: Props) => {
  const [loading, setLoading] = useState(false);

  const feeInfo = FEE_TABLE[order.status];
  const isPrepaid = ["pix", "wallet", "saldo"].includes(order.payment_method || "");
  // PIX em "aguardando_pagamento" nunca foi pago — não há reembolso a fazer.
  const paymentSettled = order.status !== "aguardando_pagamento" && !!order.confirmed_at;
  const hasRefund = isPrepaid && paymentSettled;

  const { isTimeOverride, minutesElapsed, effectiveFeePercent } = useMemo(() => {
    if (!feeInfo) return { isTimeOverride: false, minutesElapsed: 0, effectiveFeePercent: 0 };
    const referenceTime = order.confirmed_at || order.created_at;
    if (!referenceTime) return { isTimeOverride: false, minutesElapsed: 0, effectiveFeePercent: feeInfo.percent };

    const elapsed = (Date.now() - new Date(referenceTime).getTime()) / 60000;
    const hasTimePassed = elapsed >= TIME_LIMIT_MINUTES;
    const statusesWithTimeOverride = ["preparando", "pronto_para_entrega", "saiu_entrega", "em_transito"];
    const override = hasTimePassed && statusesWithTimeOverride.includes(order.status);

    return {
      isTimeOverride: override,
      minutesElapsed: Math.floor(elapsed),
      effectiveFeePercent: override ? 0 : feeInfo.percent,
    };
  }, [order.confirmed_at, order.created_at, order.status, feeInfo?.percent]);

  if (!feeInfo) return null;

  const subtotal = Number(order.subtotal) || 0;
  const feeAmount = Math.round(subtotal * (effectiveFeePercent / 100) * 100) / 100;
  const refundAmount = Math.max(0, subtotal - feeAmount);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("apply_cancellation_policy", {
        _order_id: order.id,
        _reason: "Cancelado pelo cliente",
      });

      if (error) throw error;

      const result = data as any;
      if (result?.refund_amount > 0) {
        toast.success(`Pedido cancelado! ${formatBRL(result.refund_amount)} creditado na sua carteira.`);
      } else if (result?.is_prepaid === false) {
        toast.success("Pedido cancelado com sucesso!");
      } else {
        toast.success("Pedido cancelado.");
      }
      onCancelled();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar pedido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-md border border-border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-foreground">Cancelar Pedido</h2>
            <p className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()} · {order.stores?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Sem reembolso: dinheiro/cartão na entrega OU PIX ainda não pago */}
          {!hasRefund && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-start gap-2">
              <Banknote className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isPrepaid ? "PIX ainda não pago" : "Pagamento na entrega"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPrepaid
                    ? "Como o PIX ainda não foi confirmado, nenhum valor foi cobrado. O pedido será cancelado sem reembolso."
                    : `Como o pagamento é em ${order.payment_method === "cartao" ? "cartão" : "dinheiro"} na entrega, você ainda não pagou. O pedido será cancelado sem cobrança.`}
                </p>
              </div>
            </div>
          )}

          {/* PIX/wallet PAGO: mostra detalhes do reembolso */}
          {hasRefund && (
            <>
              {/* Time override banner */}
              {isTimeOverride && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Reembolso total garantido!
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O pedido está neste status há {minutesElapsed} minutos (limite de {TIME_LIMIT_MINUTES} min excedido). Você tem direito a 100% de reembolso sem taxa.
                    </p>
                  </div>
                </div>
              )}

              {/* Fee breakdown */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal do pedido</span>
                  <span className="font-semibold text-foreground">{formatBRL(subtotal)}</span>
                </div>

                {!isTimeOverride && effectiveFeePercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-destructive">{feeInfo.label}</span>
                    <span className="font-semibold text-destructive">-{formatBRL(feeAmount)}</span>
                  </div>
                )}

                {isTimeOverride && feeInfo.percent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground line-through">{feeInfo.label}</span>
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Isento (tempo excedido)
                    </span>
                  </div>
                )}

                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-primary" />
                    Crédito na carteira
                  </span>
                  <span className="text-lg font-black text-primary">{formatBRL(refundAmount)}</span>
                </div>
              </div>

              {effectiveFeePercent === 0 && !isTimeOverride && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3">
                  <p className="text-xs text-foreground">
                    ✅ Cancelamento sem custo! O valor total será creditado na sua carteira.
                  </p>
                </div>
              )}

              {effectiveFeePercent > 0 && (
                <div className="bg-accent border border-border rounded-xl p-3">
                  <p className="text-xs text-foreground">
                    ⚠️ Como o pedido já está em {order.status === "preparando" ? "preparo" : order.status === "pronto_para_entrega" ? "estado pronto" : "rota de entrega"}, será cobrada uma taxa de {effectiveFeePercent}%. Após {TIME_LIMIT_MINUTES} minutos sem entrega, a taxa é removida.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-muted text-foreground font-bold py-3 rounded-2xl text-sm"
            >
              Voltar
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
