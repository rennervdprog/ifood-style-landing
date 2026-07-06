import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Copy, Clock, CheckCircle2, XCircle } from "lucide-react";
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
        <div className="rounded-2xl border-2 border-blue-500/30 p-5 bg-blue-500/5 space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <h3 className="font-black text-foreground">Cobrança PIX gerada</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {(pending.metadata as any)?.description || "Repasse da plataforma"}
          </p>
          <div className="text-2xl font-black text-blue-600">{formatBRL(Number(pending.amount))}</div>
          {pending.pix_qr_code_base64 && (
            <img
              src={`data:image/png;base64,${pending.pix_qr_code_base64}`}
              alt="QR Code PIX"
              className="w-48 h-48 mx-auto rounded-lg border bg-white"
            />
          )}
          {pending.pix_copy_paste && (
            <Button variant="outline" className="w-full" onClick={() => copy(pending.pix_copy_paste)}>
              <Copy className="h-4 w-4 mr-2" /> Copiar PIX copia-e-cola
            </Button>
          )}
          {(pending.metadata as any)?.due_date && (
            <p className="text-xs text-muted-foreground text-center">
              Vence em {new Date((pending.metadata as any).due_date).toLocaleDateString("pt-BR")}
            </p>
          )}
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