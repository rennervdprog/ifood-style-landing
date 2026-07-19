import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Undo2, Wallet, Banknote } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onDone?: () => void;
}

interface OrderItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  variant_id: string | null;
  products?: { name?: string | null } | null;
  product_variants?: { size?: string | null; color?: string | null } | null;
}

/**
 * Diálogo de troca/devolução do PDV Boutique.
 * Chama `apparel_return_item` por item selecionado — devolve ao estoque e,
 * quando modo=`credit`, gera vale-troca vinculado ao cliente do pedido.
 */
export const ApparelReturnDialog = ({ open, onClose, orderId, onDone }: Props) => {
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"credit" | "refund">("credit");

  useEffect(() => {
    if (!open || !orderId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("order_items")
        .select("id, quantity, unit_price, variant_id, products(name), product_variants(size,color)")
        .eq("order_id", orderId);
      setLoading(false);
      if (error) { toast.error("Erro ao carregar itens."); return; }
      const rows = (data || []) as OrderItemRow[];
      setItems(rows);
      const initial: Record<string, number> = {};
      rows.forEach((r) => { initial[r.id] = 0; });
      setQtyMap(initial);
    })();
  }, [open, orderId]);

  const totalReturn = items.reduce((s, it) => s + Number(it.unit_price || 0) * (qtyMap[it.id] || 0), 0);

  const submit = async () => {
    const selected = items.filter((it) => (qtyMap[it.id] || 0) > 0);
    if (selected.length === 0) { toast.error("Selecione ao menos 1 item."); return; }
    setSaving(true);
    try {
      for (const it of selected) {
        const qty = qtyMap[it.id];
        const { error } = await (supabase as any).rpc("apparel_return_item", {
          _order_item_id: it.id,
          _qty: qty,
          _mode: mode,
        });
        if (error) throw error;
      }
      toast.success(mode === "credit"
        ? `Vale-crédito de ${formatBRL(totalReturn)} gerado`
        : `Devolução registrada — reembolsar ${formatBRL(totalReturn)}`);
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha na devolução.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-primary" /> Trocar / Devolver
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {items.map((it) => {
                const label = it.products?.name || "Item";
                const variant = [it.product_variants?.size, it.product_variants?.color].filter(Boolean).join(" · ");
                const qty = qtyMap[it.id] || 0;
                return (
                  <div key={it.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {variant || "Sem variante"} · {formatBRL(Number(it.unit_price))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQtyMap((m) => ({ ...m, [it.id]: Math.max(0, (m[it.id] || 0) - 1) }))}
                        className="w-6 h-6 rounded bg-card border border-border text-sm font-bold"
                      >−</button>
                      <span className="w-6 text-center text-xs font-black tabular-nums">{qty}</span>
                      <button
                        onClick={() => setQtyMap((m) => ({ ...m, [it.id]: Math.min(it.quantity, (m[it.id] || 0) + 1) }))}
                        className="w-6 h-6 rounded bg-card border border-border text-sm font-bold"
                        disabled={qty >= it.quantity}
                      >+</button>
                      <span className="text-[9px] text-muted-foreground ml-1">/{it.quantity}</span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sem itens neste pedido.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("credit")}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition ${mode === "credit" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <Wallet className={`h-4 w-4 ${mode === "credit" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[11px] font-bold">Vale-crédito</span>
              </button>
              <button
                onClick={() => setMode("refund")}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition ${mode === "refund" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <Banknote className={`h-4 w-4 ${mode === "refund" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[11px] font-bold">Reembolso</span>
              </button>
            </div>

            <div className="flex items-center justify-between bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-muted-foreground">Total</span>
              <span className="text-base font-black text-emerald-500 tabular-nums">{formatBRL(totalReturn)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || totalReturn <= 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};