import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, Copy, Info } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  storeId: string;
  storeName: string;
}

const statusMeta: Record<string, { label: string; icon: any; cls: string }> = {
  paid: { label: "Pago", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  settled: { label: "Pago", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  pending: { label: "Pendente", icon: Clock, cls: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  failed: { label: "Falhou", icon: XCircle, cls: "text-red-600 bg-red-500/10 border-red-500/20" },
  cancelled: { label: "Cancelada", icon: XCircle, cls: "text-muted-foreground bg-muted border-border" },
};

const FixedPlanBillingHistory = ({ storeId, storeName }: Props) => {
  const [open, setOpen] = useState(false);

  const { data: charges, isLoading } = useQuery({
    queryKey: ["fixed-plan-billing-history", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, reference_code, amount, status, created_at, settled_at, pix_copy_paste, metadata")
        .eq("store_id", storeId)
        .eq("transaction_kind", "commission_charge")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const total = (charges || []).length;

  const totalPaid = (charges || [])
    .filter((ch: any) => ['paid', 'settled'].includes(ch.status))
    .reduce((s: number, ch: any) => s + Number(ch.amount || 0), 0);

  const pendingCount = (charges || []).filter((ch: any) => ch.status === 'pending').length;
  const pendingAmount = (charges || [])
    .filter((ch: any) => ch.status === 'pending')
    .reduce((s: number, ch: any) => s + Number(ch.amount || 0), 0);
  const paidCount = (charges || []).filter((c: any) => c.status === "paid" || c.status === "settled").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Histórico de cobranças</span>
          {open && total > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {paidCount} pagas · {pendingCount} pendentes
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-2 max-h-80 overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando…</p>}
          {!isLoading && (charges?.length || 0) === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma cobrança registrada ainda para {storeName}.
            </p>
          )}
          {!isLoading &&
            (charges || []).map((c: any) => {
              const meta = statusMeta[c.status] || statusMeta.pending;
              const Icon = meta.icon;
              const date = new Date(c.created_at);
              return (
                <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className={`p-1.5 rounded-lg border ${meta.cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">
                        {c.metadata?.description
                          ? String(c.metadata.description).split("—")[1]?.trim() || "Repasse físico"
                          : "Dinheiro / Cartão / PIX Maquininha"}
                      </span>
                      <span className="text-sm font-black">{formatBRL(Number(c.amount))}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {date.toLocaleDateString("pt-BR")} · {meta.label}
                      </span>
                      {c.pix_copy_paste && c.status === "pending" && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.pix_copy_paste);
                            toast.success("PIX copiado");
                          }}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> Pagar PIX
                        </button>
                      )}
                    </div>
                    {c.metadata?.repasse_pendente > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Taxa entrega: {formatBRL(Number(c.metadata.repasse_pendente))}
                        {c.metadata?.comissao_pendente > 0 &&
                          ` · Comissão: ${formatBRL(Number(c.metadata.comissao_pendente))}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default FixedPlanBillingHistory;
