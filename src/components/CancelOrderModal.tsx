import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, AlertTriangle, Loader2, Banknote, Landmark } from "lucide-react";

interface Props {
  order: {
    id: string;
    status: string;
    payment_method: string;
    confirmed_at?: string | null;
    stores?: { name?: string };
  };
  onClose: () => void;
  onCancelled: () => void;
}

/**
 * O cancelamento nunca adiciona saldo à carteira. Quando o PIX Direto já foi
 * confirmado, o backend cria um caso de devolução direta pela loja.
 */
const CancelOrderModal = ({ order, onClose, onCancelled }: Props) => {
  const [loading, setLoading] = useState(false);
  const isPixDireto = order.payment_method === "pix_direto";
  const pixDiretoConfirmed = isPixDireto && Boolean(order.confirmed_at);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("apply_cancellation_policy", {
        _order_id: order.id,
        _reason: "Cancelado pelo cliente",
      });
      if (error) throw error;

      const result = data as { requires_store_refund?: boolean } | null;
      if (result?.requires_store_refund) {
        toast.success("Pedido cancelado. A loja foi chamada para registrar a devolução do PIX Direto.");
      } else {
        toast.success("Pedido cancelado com sucesso.");
      }
      onCancelled();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar pedido.");
    } finally {
      setLoading(false);
    }
  };

  const paymentExplanation = pixDiretoConfirmed
    ? {
        icon: Landmark,
        title: "PIX Direto confirmado",
        description: "O valor foi transferido diretamente para a loja. Ao cancelar, o ItaSuper abrirá um caso para que a loja registre a devolução e o comprovante. Nenhum crédito será adicionado automaticamente à sua carteira.",
        className: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
      }
    : isPixDireto
      ? {
          icon: Landmark,
          title: "PIX Direto aguardando comprovante",
          description: "Como a loja ainda não confirmou o pagamento, o pedido será cancelado sem criar caso de devolução.",
          className: "bg-primary/10 border-primary/30 text-foreground",
        }
      : {
          icon: Banknote,
          title: "Pagamento físico",
          description: "Cartão, dinheiro e pagamentos em maquininha são tratados presencialmente. O ItaSuper não processa reembolso financeiro para esta modalidade.",
          className: "bg-primary/10 border-primary/30 text-foreground",
        };
  const PaymentIcon = paymentExplanation.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full max-w-md border border-border" onClick={(event) => event.stopPropagation()}>
        <div className="px-4 py-4 flex items-center gap-3 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-foreground">Cancelar pedido</h2>
            <p className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()} · {order.stores?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className={`border rounded-xl p-3 flex items-start gap-2 ${paymentExplanation.className}`}>
            <PaymentIcon className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{paymentExplanation.title}</p>
              <p className="text-xs mt-0.5 opacity-85">{paymentExplanation.description}</p>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">
              O cancelamento encerra a preparação do pedido. Para PIX Direto confirmado, a devolução deve ser realizada pela loja ao cliente e acompanhada no caso aberto pelo sistema.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-muted text-foreground font-bold py-3 rounded-2xl text-sm">
              Voltar
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Cancelando...</> : "Confirmar cancelamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
