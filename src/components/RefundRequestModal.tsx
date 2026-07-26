import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { X, AlertTriangle, Camera, Loader2, Send } from "lucide-react";
import { formatBRL } from "@/lib/utils";

const REASONS = [
  { value: "wrong_product", label: "Produto errado" },
  { value: "missing_items", label: "Itens faltando" },
  { value: "damaged", label: "Produto danificado" },
  { value: "late_delivery", label: "Atraso na entrega" },
  { value: "poor_quality", label: "Qualidade ruim" },
  { value: "other", label: "Outro motivo" },
];

interface Props {
  order: {
    id: string;
    store_id: string;
    subtotal: number;
    total_price: number;
    payment_method?: string;
    created_at?: string;
    stores?: { name?: string };
  };
  onClose: () => void;
  onSubmitted: () => void;
}

const RefundRequestModal = ({ order, onClose, onSubmitted }: Props) => {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const maxRefund = Number(order.subtotal) || 0;
  const requestedAmount = refundType === "full" ? maxRefund : Math.min(Number(partialAmount) || 0, maxRefund);

  // Verificar elegibilidade
  const cashOrder = ["dinheiro", "cartao_maquina"].includes(order.payment_method || "");
  const daysSinceOrder = order.created_at
    ? (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const expiredDeadline = daysSinceOrder > 7;

  const handleSubmit = async () => {
    if (!user || !reason) {
      toast.error("Selecione o motivo do reembolso.");
      return;
    }
    if (requestedAmount <= 0) {
      toast.error("Valor de reembolso inválido.");
      return;
    }
    if (cashOrder) {
      toast.error("Pedidos pagos em dinheiro ou maquininha não são elegíveis para reembolso na plataforma.");
      return;
    }
    if (expiredDeadline) {
      toast.error("O prazo para solicitar reembolso é de 7 dias após a entrega.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("refund_requests").insert({
        order_id: order.id,
        store_id: order.store_id,
        requester_id: user.id,
        reason: reason as any,
        description: description.trim() || null,
        refund_type: "wallet_credit" as any,
        requested_amount: requestedAmount,
      });

      if (error) throw error;
      toast.success("Solicitação de reembolso enviada!");
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border border-border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <h2 className="font-bold text-foreground">Solicitar Reembolso</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Order info */}
          <div className="bg-muted/30 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm font-bold text-foreground">{order.stores?.name || "Loja"}</p>
            <p className="text-xs text-muted-foreground">Valor: {formatBRL(Number(order.total_price))}</p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-bold text-foreground mb-2 block">Motivo *</label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`text-xs font-medium px-3 py-2.5 rounded-xl border-2 transition-all ${
                    reason === r.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">Descreva o problema</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conte o que aconteceu..."
              maxLength={500}
              rows={3}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Refund type */}
          <div>
            <label className="text-xs font-bold text-foreground mb-2 block">Tipo de reembolso</label>
            <div className="flex gap-2">
              <button
                onClick={() => setRefundType("full")}
                className={`flex-1 text-xs font-medium px-3 py-2.5 rounded-xl border-2 transition-all ${
                  refundType === "full"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent bg-muted/50 text-foreground"
                }`}
              >
                Total ({formatBRL(maxRefund)})
              </button>
              <button
                onClick={() => setRefundType("partial")}
                className={`flex-1 text-xs font-medium px-3 py-2.5 rounded-xl border-2 transition-all ${
                  refundType === "partial"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent bg-muted/50 text-foreground"
                }`}
              >
                Parcial
              </button>
            </div>
            {refundType === "partial" && (
              <div className="mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxRefund}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Valor desejado"
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>

          {/* Avisos de inelegibilidade */}
          {cashOrder && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-xs text-red-700 dark:text-red-300">
                ⚠️ Pedidos pagos em dinheiro ou maquininha não são elegíveis para reembolso na plataforma.
              </p>
            </div>
          )}
          {expiredDeadline && !cashOrder && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-xs text-red-700 dark:text-red-300">
                ⚠️ O prazo para solicitar reembolso (7 dias) já expirou.
              </p>
            </div>
          )}
          {/* Info sobre crédito */}
          {!cashOrder && !expiredDeadline && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💰 O reembolso aprovado será creditado como <strong>saldo na plataforma</strong>, disponível para usar em futuros pedidos. Prazo de análise: até 48h.
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !reason || requestedAmount <= 0 || cashOrder || expiredDeadline}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Solicitação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundRequestModal;
