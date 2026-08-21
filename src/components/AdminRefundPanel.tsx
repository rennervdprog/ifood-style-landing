import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, Clock, Landmark, FileCheck2, Send, ExternalLink } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  wrong_product: "Produto errado",
  missing_items: "Itens faltando",
  damaged: "Produto danificado",
  late_delivery: "Atraso na entrega",
  poor_quality: "Qualidade ruim",
  other: "Outro motivo",
  cancelled_order: "Pedido cancelado",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  opened: { label: "Aguardando loja", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/30" },
  under_review: { label: "Em análise", color: "text-foreground", bg: "bg-muted" },
  refund_due_by_store: { label: "Aguardando devolução", color: "text-primary", bg: "bg-primary/10" },
  proof_submitted: { label: "Comprovante enviado", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/30" },
  completed: { label: "Concluído", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  rejected: { label: "Recusado", color: "text-destructive", bg: "bg-destructive/10" },
  disputed: { label: "Contestado", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-950/30" },
  withdrawn: { label: "Encerrado", color: "text-muted-foreground", bg: "bg-muted" },
};

interface Props {
  storeId?: string;
}

const AdminRefundPanel = ({ storeId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [refundReferences, setRefundReferences] = useState<Record<string, string>>({});
  const [refundProofUrls, setRefundProofUrls] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: cases, isLoading } = useQuery({
    queryKey: ["pix-direto-refund-cases", storeId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("pix_direto_refund_cases")
        .select("id, order_id, requester_id, payment_confirmed_at, eligible_amount, requested_amount, reason, description, evidence_urls, status, store_response, store_responded_at, refund_amount, refund_reference, refund_proof_url, refund_submitted_at, created_at")
        .order("created_at", { ascending: false });
      if (storeId) query = query.eq("store_id", storeId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const list = cases || [];
    return statusFilter === "all" ? list : list.filter((item) => item.status === statusFilter);
  }, [cases, statusFilter]);

  const counts = useMemo(() => {
    const list = cases || [];
    return {
      all: list.length,
      pending: list.filter((item) => ["opened", "under_review", "disputed"].includes(item.status)).length,
      due: list.filter((item) => item.status === "refund_due_by_store").length,
      proof: list.filter((item) => item.status === "proof_submitted").length,
      completed: list.filter((item) => item.status === "completed").length,
    };
  }, [cases]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pix-direto-refund-cases"] });

  const respond = async (caseId: string, approve: boolean) => {
    setProcessing(caseId);
    try {
      const { error } = await (supabase as any).rpc("respond_pix_direto_refund_case", {
        p_case_id: caseId,
        p_approve: approve,
        p_response: responses[caseId] || null,
      });
      if (error) throw error;
      toast.success(approve
        ? "Caso encaminhado para devolução direta do PIX pela loja."
        : "Caso recusado com a justificativa registrada.");
      refresh();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível responder ao caso.");
    } finally {
      setProcessing(null);
    }
  };

  const submitProof = async (item: any) => {
    const amount = Number(refundAmounts[item.id] || item.eligible_amount || 0);
    setProcessing(item.id);
    try {
      const { error } = await (supabase as any).rpc("submit_pix_direto_refund_proof", {
        p_case_id: item.id,
        p_refund_amount: amount,
        p_reference: refundReferences[item.id] || null,
        p_proof_url: refundProofUrls[item.id] || null,
      });
      if (error) throw error;
      toast.success("Devolução registrada. O cliente poderá confirmar o recebimento.");
      refresh();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível registrar a devolução.");
    } finally {
      setProcessing(null);
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="bg-card rounded-2xl border border-border p-4 animate-pulse h-28" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex gap-2">
        <Landmark className="h-4 w-4 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Esta fila contém somente casos de PIX Direto confirmado. A devolução é feita pela loja ao cliente; o ItaSuper registra a decisão e o comprovante, sem gerar crédito automático em carteira.
        </p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
        {[
          { key: "all", label: "Todos", count: counts.all },
          { key: "opened", label: "Aguardando", count: counts.pending },
          { key: "refund_due_by_store", label: "Devolver PIX", count: counts.due },
          { key: "proof_submitted", label: "Comprovados", count: counts.proof },
          { key: "completed", label: "Concluídos", count: counts.completed },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border ${statusFilter === filter.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}
          >
            {filter.label} <span className="opacity-70">({filter.count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum caso de PIX Direto neste filtro.</p>
        </div>
      )}

      {filtered.map((item) => {
        const status = STATUS_LABELS[item.status] || STATUS_LABELS.opened;
        const canRespond = ["opened", "under_review", "disputed"].includes(item.status);
        const canSubmitProof = item.status === "refund_due_by_store";

        return (
          <article key={item.id} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className={`px-4 py-2.5 flex items-center justify-between ${status.bg} border-b border-border/30`}>
              <div className="flex items-center gap-2">
                {item.status === "completed" ? <CheckCircle2 className={`h-4 w-4 ${status.color}`} /> : item.status === "rejected" ? <XCircle className={`h-4 w-4 ${status.color}`} /> : <Clock className={`h-4 w-4 ${status.color}`} />}
                <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Pedido #{item.order_id.slice(0, 8).toUpperCase()} · PIX Direto</p>
                  <p className="text-sm font-bold text-foreground">{REASON_LABELS[item.reason] || item.reason}</p>
                  <p className="text-xs text-muted-foreground">Pagamento confirmado em {new Date(item.payment_confirmed_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="text-sm font-black text-primary">{formatBRL(Number(item.eligible_amount))}</span>
              </div>

              {item.description && <div className="bg-muted/30 rounded-xl p-3 text-xs text-foreground">{item.description}</div>}
              {item.store_response && <div className="bg-muted rounded-xl p-3 text-xs text-foreground"><strong>Resposta registrada:</strong> {item.store_response}</div>}
              {item.refund_amount != null && <div className="bg-primary/10 rounded-xl p-3 text-xs text-foreground">Devolução informada: <strong>{formatBRL(Number(item.refund_amount))}</strong>{item.refund_reference ? ` · Referência: ${item.refund_reference}` : ""}</div>}
              {item.refund_proof_url && /^https?:\/\//.test(item.refund_proof_url) && <a className="text-xs text-primary font-bold inline-flex items-center gap-1" href={item.refund_proof_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Abrir comprovante</a>}

              {canRespond && (
                <div className="space-y-2 pt-1">
                  <textarea
                    placeholder="Resposta para o cliente (obrigatória ao recusar)"
                    value={responses[item.id] || ""}
                    onChange={(event) => setResponses((previous) => ({ ...previous, [item.id]: event.target.value }))}
                    rows={2}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => respond(item.id, true)} disabled={processing === item.id} className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs disabled:opacity-50">
                      {processing === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Solicitar devolução"}
                    </button>
                    <button onClick={() => respond(item.id, false)} disabled={processing === item.id || !responses[item.id]?.trim()} className="flex-1 bg-destructive text-destructive-foreground font-bold py-2.5 rounded-xl text-xs disabled:opacity-50">
                      Recusar
                    </button>
                  </div>
                </div>
              )}

              {canSubmitProof && (
                <div className="space-y-2 pt-1 border-t border-border/60 pt-3">
                  <p className="text-xs font-bold text-foreground">Registrar devolução feita pela loja</p>
                  <input type="number" min="0.01" max={item.eligible_amount} step="0.01" placeholder="Valor devolvido" value={refundAmounts[item.id] ?? String(item.eligible_amount)} onChange={(event) => setRefundAmounts((previous) => ({ ...previous, [item.id]: event.target.value }))} className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground" />
                  <input placeholder="Identificador, E2E ou referência da transferência" value={refundReferences[item.id] || ""} onChange={(event) => setRefundReferences((previous) => ({ ...previous, [item.id]: event.target.value }))} className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground" />
                  <input placeholder="URL do comprovante (opcional se houver referência)" value={refundProofUrls[item.id] || ""} onChange={(event) => setRefundProofUrls((previous) => ({ ...previous, [item.id]: event.target.value }))} className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground" />
                  <button onClick={() => submitProof(item)} disabled={processing === item.id} className="w-full bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {processing === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><FileCheck2 className="h-3.5 w-3.5" /> Registrar devolução</>}
                  </button>
                </div>
              )}

              {item.status === "proof_submitted" && <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1"><Send className="h-3.5 w-3.5" /> Aguardando confirmação de recebimento pelo cliente.</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default AdminRefundPanel;
