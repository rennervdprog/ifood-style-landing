import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Copy, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";

interface Props {
  storeId: string;
}

const statusStyle: Record<string, { label: string; cls: string; Icon: any }> = {
  pending: { label: "Aguardando pagamento", cls: "bg-amber-500/10 text-amber-600", Icon: Clock },
  paid: { label: "Pago", cls: "bg-emerald-500/10 text-emerald-600", Icon: CheckCircle2 },
  completed: { label: "Pago", cls: "bg-emerald-500/10 text-emerald-600", Icon: CheckCircle2 },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground", Icon: XCircle },
  failed: { label: "Falhou", cls: "bg-red-500/10 text-red-600", Icon: XCircle },
};

export default function RepassePendingCharges({ storeId }: Props) {
  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["repasse-charges", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_transactions")
        .select("id, amount, status, reference_code, pix_copy_paste, pix_qr_code_base64, created_at, metadata")
        .eq("store_id", storeId)
        .eq("transaction_kind", "commission_charge")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  if (isLoading || charges.length === 0) return null;

  const pending = charges.find((c: any) => c.status === "pending");
  const history = charges.filter((c: any) => c.id !== pending?.id);

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Código PIX copiado!");
  };

  return (
    <div className="space-y-4">
      {pending && (
        <div className="rounded-3xl border-2 border-primary/40 bg-card shadow-xl shadow-primary/10 overflow-hidden">
          {/* Status header */}
          <div className="px-5 pt-5 pb-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
                  Aguardando Pagamento
                </span>
              </div>
              {pending.reference_code && (
                <div className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase">
                  {pending.reference_code}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                  Cobrança PIX gerada
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-tight pl-7">
                {(pending.metadata as any)?.description || "Repasse da plataforma"}
              </p>
            </div>

            <div className="mt-5 mb-6">
              <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-1">
                Valor total a pagar
              </p>
              <div className="text-4xl font-black text-primary tracking-tight">
                {formatBRL(Number(pending.amount))}
              </div>
            </div>
          </div>

          {/* QR focal area */}
          {pending.pix_qr_code_base64 && (
            <div className="px-5">
              <div className="relative bg-muted/40 border border-border rounded-2xl p-6 flex flex-col items-center justify-center">
                <div className="bg-white p-3 rounded-xl shadow-sm">
                  <img
                    src={`data:image/png;base64,${pending.pix_qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-40 h-40 rounded-sm"
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-primary">
                  <QrCode className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Escaneie o código acima
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions & deadline */}
          <div className="p-5 space-y-3">
            {pending.pix_copy_paste && (
              <Button
                className="w-full h-14 rounded-xl text-base font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                onClick={() => copy(pending.pix_copy_paste)}
              >
                <Copy className="h-5 w-5 mr-2" /> Copiar código PIX
              </Button>
            )}

            {(pending.metadata as any)?.due_date && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-500" />
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400">
                  Vencimento:{" "}
                  <span className="underline decoration-amber-400">
                    {new Date((pending.metadata as any).due_date).toLocaleDateString("pt-BR")}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-2xl border p-5 space-y-3">
          <h3 className="font-black text-foreground">Histórico de cobranças</h3>
          <div className="divide-y">
            {history.map((c: any) => {
              const s = statusStyle[c.status] || statusStyle.pending;
              const Icon = s.Icon;
              return (
                <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{formatBRL(Number(c.amount))}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")} · {c.reference_code}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${s.cls}`}>
                    <Icon className="h-3 w-3" /> {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}