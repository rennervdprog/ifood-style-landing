import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Loader2, X, Check } from "lucide-react";
import type { Product } from "@/pages/pdv/types";

interface Slot { name: string; product_ids: string[] }
interface Combo {
  id: string; name: string; description: string | null; price: number;
  image_url: string | null; slots: Slot[] | null;
}

/** Modal de montagem: pede uma escolha por etapa e devolve o combo pronto pro carrinho. */
export default function SnackBarComboBuilderDialog({ combo, storeId, onClose, onConfirm }: {
  combo: Combo; storeId: string; onClose: () => void;
  onConfirm: (item: Product, chosen: { slot: string; product: string }[]) => void;
}) {
  const slots = (combo.slots ?? []) as Slot[];
  const [choices, setChoices] = useState<Record<number, string>>({});
  const allIds = Array.from(new Set(slots.flatMap((s) => s.product_ids)));

  const { data: products, isLoading } = useQuery({
    queryKey: ["combo-products", storeId, combo.id, allIds.join(",")],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id,name,price,image_url")
        .in("id", allIds);
      if (error) throw error;
      return data as Array<{ id: string; name: string; price: number; image_url: string | null }>;
    },
  });
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const allChosen = slots.length > 0 && slots.every((_, i) => !!choices[i]);

  useEffect(() => {
    if (slots.length === 0) {
      onConfirm(
        { id: `combo:${combo.id}:${Date.now()}`, name: combo.name, price: Number(combo.price),
          image_url: combo.image_url ?? null, is_available: true, section_id: null,
          metadata: { combo_id: combo.id } } as any,
        [],
      );
    }
  // eslint-disable-next-line
  }, []);

  const confirm = () => {
    const chosen = slots.map((s, i) => {
      const p = byId.get(choices[i]);
      return { slot: s.name, product: p?.name ?? "" };
    });
    const desc = chosen.map((c) => `${c.slot}: ${c.product}`).join(" · ");
    onConfirm(
      {
        id: `combo:${combo.id}:${Date.now()}`,
        name: `${combo.name} (${chosen.map((c) => c.product).join(" + ")})`,
        price: Number(combo.price),
        image_url: combo.image_url ?? null,
        is_available: true,
        section_id: null,
        description: desc,
        metadata: { combo_id: combo.id, combo_choices: chosen },
      } as any,
      chosen,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-md sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black">{combo.name}</h3>
            <p className="text-[11px] text-primary font-bold">{formatBRL(Number(combo.price))}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />}
          {slots.map((s, i) => (
            <div key={i}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {s.name} <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {s.product_ids.map((pid) => {
                  const p = byId.get(pid);
                  if (!p) return null;
                  const sel = choices[i] === pid;
                  return (
                    <button key={pid} onClick={() => setChoices((c) => ({ ...c, [i]: pid }))}
                      className={`text-left rounded-lg border p-2 transition-all ${sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-bold line-clamp-2">{p.name}</p>
                        {sel && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border font-bold text-sm">Cancelar</button>
          <button onClick={confirm} disabled={!allChosen} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-40">
            Adicionar {formatBRL(Number(combo.price))}
          </button>
        </div>
      </div>
    </div>
  );
}