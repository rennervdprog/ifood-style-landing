import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle, Loader2, Clock, Eye } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  wrong_product: "Produto errado",
  missing_items: "Itens faltando",
  damaged: "Produto danificado",
  late_delivery: "Atraso na entrega",
  poor_quality: "Qualidade ruim",
  other: "Outro motivo",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendente", color: "text-foreground", bg: "bg-muted" },
  approved: { label: "Em análise", color: "text-foreground", bg: "bg-muted" },
  processed: { label: "Processado", color: "text-primary", bg: "bg-primary/10" },
  rejected: { label: "Rejeitado", color: "text-destructive", bg: "bg-destructive/10" },
};

interface Props {
  storeId?: string; // If provided, filter by store. Otherwise show all (admin).
}

const AdminRefundPanel = ({ storeId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, string>>({});

  const { data: requests, isLoading } = useQuery({
    queryKey: ["refund-requests", storeId],
    queryFn: async () => {
      let query = supabase
        .from("refund_requests")
        .select(`
          *,
          orders!refund_requests_order_id_fkey(
            payment_method, created_at, total_price
          ),
          profiles!refund_requests_requester_id_fkey(
            full_name, email
          )
        `)
        .order("created_at", { ascending: false });

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleProcess = async (refundId: string, approve: boolean) => {
    setProcessing(refundId);
    try {
      const req = requests?.find((r) => r.id === refundId);
      if (!req) throw new Error("Solicitação não encontrada.");

      const amount = approve
        ? Number(adjustedAmounts[refundId] || req.requested_amount)
        : 0;

      const { error } = await supabase.rpc("process_refund", {
        _refund_id: refundId,
        _approved_amount: amount,
        _admin_notes: adminNotes[refundId] || null,
      });

      if (error) throw error;
      toast.success(approve
        ? "✅ Reembolso aprovado! Crédito adicionado à carteira do cliente."
        : "❌ Solicitação rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["refund-requests"] });
      // TODO: enviar push notification ao cliente via edge function
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar.");
    } finally {
      setProcessing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!requests?.length) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma solicitação de reembolso.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const status = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
        const isPending = req.status === "pending";

        return (
          <div key={req.id} className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className={`px-4 py-2.5 flex items-center justify-between ${status.bg} border-b border-border/30`}>
              <div className="flex items-center gap-2">
                {isPending ? (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                ) : req.status === "processed" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(req.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {/* Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Pedido #{req.order_id.slice(0, 8).toUpperCase()}
                    {(req as any).orders?.payment_method && (
                      <span className="ml-1.5 bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {(req as any).orders.payment_method.toUpperCase()}
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {REASON_LABELS[req.reason] || req.reason}
                  </p>
                  {(req as any).profiles?.full_name && (
                    <p className="text-xs text-muted-foreground">
                      Cliente: {(req as any).profiles.full_name}
                    </p>
                  )}
                </div>
                <span className="text-sm font-black text-primary">
                  {formatBRL(Number(req.requested_amount))}
                </span>
              </div>

              {req.description && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-foreground">{req.description}</p>
                </div>
              )}

              {req.admin_notes && (
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-foreground">
                    <strong>Nota:</strong> {req.admin_notes}
                  </p>
                </div>
              )}

              {req.approved_amount != null && req.status === "processed" && (
                <div className="bg-primary/10 rounded-xl p-3">
                  <p className="text-xs text-foreground">
                    ✅ Creditado: <strong>{formatBRL(Number(req.approved_amount))}</strong> na carteira do cliente
                  </p>
                </div>
              )}

              {/* Actions for pending */}
              {isPending && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor (opcional)"
                      value={adjustedAmounts[req.id] || ""}
                      onChange={(e) => setAdjustedAmounts((p) => ({ ...p, [req.id]: e.target.value }))}
                      className="flex-1 bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <textarea
                    placeholder="Nota interna (opcional)"
                    value={adminNotes[req.id] || ""}
                    onChange={(e) => setAdminNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                    rows={2}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProcess(req.id, true)}
                      disabled={processing === req.id}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {processing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleProcess(req.id, false)}
                      disabled={processing === req.id}
                      className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {processing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Rejeitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminRefundPanel;
