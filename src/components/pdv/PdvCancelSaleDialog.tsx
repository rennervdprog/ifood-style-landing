import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  orderId: string | null;
  orderTotal: number;
  onClose: () => void;
  onDone: () => void;
}

const REASONS = ["Erro do operador", "Cliente desistiu", "Produto em falta", "Pagamento recusado", "Outro"];

export function PdvCancelSaleDialog({ open, orderId, orderTotal, onClose, onDone }: Props) {
  const [reason, setReason] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open || !orderId) return null;

  const submit = async () => {
    const finalReason = reason === "Outro" ? custom.trim() : reason;
    if (finalReason.length < 3) { toast.error("Descreva o motivo"); return; }
    if (!/^[0-9]{4,8}$/.test(pin)) { toast.error("PIN de 4 a 8 dígitos"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("pdv_cancel_sale" as any, {
        _order_id: orderId, _pin: pin, _reason: finalReason,
      } as any);
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) {
        const map: Record<string, string> = {
          pin_mismatch: "PIN incorreto",
          already_canceled: "Venda já cancelada",
          reason_required: "Motivo obrigatório",
          forbidden: "Sem permissão",
          order_not_found: "Venda não encontrada",
        };
        toast.error(map[r?.error] || "Falha no cancelamento");
        return;
      }
      toast.success(`Cancelada por ${r.operator_name}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
        <div className="h-12 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-black">Cancelar venda</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs">
            <p className="font-bold text-red-600">Valor: R$ {orderTotal.toFixed(2).replace(".", ",")}</p>
            <p className="text-muted-foreground mt-1">Ação registrada no auditoria com operador e motivo.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-muted-foreground">Motivo</label>
            <div className="grid grid-cols-2 gap-1.5">
              {REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)} type="button"
                  className={`px-2 py-2 rounded-lg text-[11px] font-bold border ${reason === r ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 border-transparent"}`}>
                  {r}
                </button>
              ))}
            </div>
            {reason === "Outro" && (
              <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Descreva…"
                className="w-full px-3 py-2 mt-1 bg-muted/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-muted-foreground">PIN do operador</label>
            <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric" placeholder="••••"
              className="w-full px-3 py-3 bg-muted/40 rounded-xl text-center tracking-[0.5em] text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <button onClick={submit} disabled={busy}
            className="w-full h-12 bg-red-500 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}