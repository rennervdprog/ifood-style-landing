import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Recycle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

interface OrderItemLite { product_id: string; quantity: number; }

interface Props {
  open: boolean;
  orderId: string;
  storeId: string;
  items: OrderItemLite[];
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Pergunta ao entregador/operador quantas casquinhas o cliente devolveu
 * para cada item retornável do pedido e credita o saldo via RPC.
 */
const EmptiesReturnDialog = ({ open, orderId, storeId, items, onClose, onDone }: Props) => {
  const productIds = useMemo(() => items.map(i => i.product_id), [items]);

  // Busca produtos + grupos retornáveis
  const { data: returnable } = useQuery({
    queryKey: ["empties-return-dialog", storeId, productIds.join(",")],
    enabled: open && productIds.length > 0,
    queryFn: async () => {
      const { data: prods } = await (supabase as any)
        .from("products")
        .select("id, name, metadata")
        .in("id", productIds);
      const eligible = (prods || []).filter((p: any) => {
        const md = p.metadata || {};
        return md.returnable_bottle && md.returnable_group;
      });
      if (eligible.length === 0) return [];

      const groupNames = Array.from(new Set(eligible.map((p: any) => String(p.metadata.returnable_group).trim().toLowerCase())));
      const { data: groups } = await (supabase as any)
        .from("returnable_groups")
        .select("id, name")
        .eq("store_id", storeId)
        .in("name", groupNames);

      return eligible.map((p: any) => {
        const grpName = String(p.metadata.returnable_group).trim().toLowerCase();
        const grp = (groups || []).find((g: any) => String(g.name).toLowerCase() === grpName);
        const qtyOrdered = items.filter(i => i.product_id === p.id).reduce((s, i) => s + i.quantity, 0);
        return {
          product_id: p.id,
          product_name: p.name,
          group_name: grpName,
          returnable_group_id: grp?.id || null,
          qty_ordered: qtyOrdered,
        };
      }).filter((r: any) => r.returnable_group_id);
    },
  });

  const [returns, setReturns] = useState<Record<string, number>>({});
  useEffect(() => { setReturns({}); }, [orderId, open]);

  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Agrupa por returnable_group_id
      const byGroup = new Map<string, number>();
      for (const r of returnable || []) {
        const qty = returns[r.product_id] || 0;
        if (qty <= 0) continue;
        byGroup.set(r.returnable_group_id, (byGroup.get(r.returnable_group_id) || 0) + qty);
      }
      const payload = Array.from(byGroup.entries()).map(([returnable_group_id, qty]) => ({ returnable_group_id, qty }));

      if (payload.length > 0) {
        const { error } = await (supabase as any).rpc("register_empties_return", {
          _order_id: orderId,
          _returns: payload,
        });
        if (error) throw error;
      }

      // Sempre debita o que foi usado no checkout (idempotente)
      await (supabase as any).rpc("apply_order_empties_debit", { _order_id: orderId });

      if (payload.length > 0) toast.success("♻️ Casquinhas registradas no saldo do cliente!");
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar devolução.");
    } finally {
      setSaving(false);
    }
  };

  // Se não há itens retornáveis, só aplica o débito e fecha
  useEffect(() => {
    if (!open) return;
    if (returnable && returnable.length === 0) {
      (async () => {
        try { await (supabase as any).rpc("apply_order_empties_debit", { _order_id: orderId }); } catch {}
        onDone?.();
        onClose();
      })();
    }
  }, [open, returnable, orderId, onClose, onDone]);

  if (!returnable || returnable.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5 text-emerald-600" />
            Cliente devolveu casquinhas?
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Informe quantas garrafas vazias o cliente entregou. Vai virar saldo na conta dele para próximas compras.
        </p>
        <div className="space-y-2 py-2">
          {returnable.map((r: any) => {
            const cur = returns[r.product_id] || 0;
            return (
              <div key={r.product_id} className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.group_name} • pedido: {r.qty_ordered}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setReturns(p => ({ ...p, [r.product_id]: Math.max(0, cur - 1) }))}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm font-bold">{cur}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setReturns(p => ({ ...p, [r.product_id]: Math.min(r.qty_ordered, cur + 1) }))}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleConfirm} disabled={saving}>Nenhuma</Button>
          <Button onClick={handleConfirm} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Salvando..." : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmptiesReturnDialog;