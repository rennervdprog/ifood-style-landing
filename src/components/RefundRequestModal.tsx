import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, AlertTriangle, Loader2, Send, Landmark } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  canOpenPixDiretoRefundCase,
  isPixDiretoPayment,
  physicalPaymentExplanation,
  REFUND_WINDOW_EXPIRED_MESSAGE,
} from "@/lib/refundEligibility";

const REASONS = [
  { value: "wrong_product", label: "Produto errado" },
  { value: "missing_items", label: "Itens faltando" },
  { value: "damaged", label: "Produto danificado" },
  { value: "late_delivery", label: "Atraso na entrega" },
  { value: "poor_quality", label: "Qualidade ruim" },
  { value: "other", label: "Outro motivo" },
] as const;

interface Props {
  order: {
    id: string;
    store_id: string;
    total_price: number;
    payment_method?: string;
    status?: string;
    refund_request_expires_at?: string | null;
    stores?: { name?: string };
  };
  onClose: () => void;
  onSubmitted: () => void;
}

/**
 * Abre exclusivamente um caso de devolução de PIX Direto confirmado.
 * O dinheiro foi recebido diretamente pela loja; esta tela nunca gera saldo
 * em carteira e nem promete estorno automático por gateway.
 */
const RefundRequestModal = ({ order, onClose, onSubmitted }: Props) => {
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"] | "">("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const isPixDireto = isPixDiretoPayment(order.payment_method);
  const eligible = canOpenPixDiretoRefundCase(
    order.payment_method,
    order.status,
    order.refund_request_expires_at,
  );
  const ineligibilityMessage = isPixDireto ? REFUND_WINDOW_EXPIRED_MESSAGE : physicalPaymentExplanation;

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Selecione o motivo da solicitação.");
      return;
    }
    if (!eligible) {
      toast.error(ineligibilityMessage);
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("create_pix_direto_refund_case", {
        p_order_id: order.id,
        p_reason: reason,
        p_description: description.trim() || null,
        p_evidence_urls: [],
      });
      if (error) throw error;

      toast.success("Solicitação enviada. A loja será chamada para registrar a devolução do PIX.");
      onSubmitted();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border border-border" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Solicitar análise de reembolso</h2>
              <p className="text-[11px] text-muted-foreground">Somente PIX Direto confirmado</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-muted/30 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Pedido #{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm font-bold text-foreground">{order.stores?.name || "Loja"}</p>
            <p className="text-xs text-muted-foreground">Pagamento: PIX Direto · {formatBRL(Number(order.total_price))}</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex gap-2">
            <Landmark className="h-4 w-4 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              O PIX foi transferido diretamente para a loja. O ItaSuper abrirá um caso para que a loja registre a devolução e o comprovante. Nenhum saldo é adicionado automaticamente à sua carteira.
            </p>
          </div>

          {!eligible ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
              <p className="text-xs text-destructive">
                {ineligibilityMessage}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-foreground mb-2 block">Motivo *</label>
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setReason(item.value)}
                      className={`text-xs font-medium px-3 py-2.5 rounded-xl border-2 transition-all ${
                        reason === item.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-transparent bg-muted/50 text-foreground hover:bg-muted"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Descreva o que aconteceu</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Conte o que aconteceu..."
                  maxLength={500}
                  rows={3}
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !reason || !eligible}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Abrir solicitação</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundRequestModal;
