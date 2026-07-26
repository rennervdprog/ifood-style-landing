import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Layers } from "lucide-react";
import type { Product } from "@/pages/pdv/types";
import SnackBarComboBuilderDialog from "./SnackBarComboBuilderDialog";

interface Combo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  slots: any;
  active: boolean;
  sort_order: number;
}

interface Props {
  storeId?: string;
  addItem: (p: Product) => void;
}

/**
 * Barra de combos do modo Lanches. Fica no topo do catálogo.
 * Clicar num combo adiciona um item "combo" no carrinho pelo preço fechado.
 * (MVP: sem builder de slots — próxima iteração abre modal de escolha.)
 */
export default function SnackBarCombosBar({ storeId, addItem }: Props) {
  const [active, setActive] = useState<Combo | null>(null);
  const { data: combos } = useQuery({
    queryKey: ["snackbar-combos", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("combo_definitions")
        .select("id,name,description,price,image_url,slots,active,sort_order")
        .eq("store_id", storeId)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as Combo[]) ?? [];
    },
  });

  if (!combos || combos.length === 0) return null;

  const handleClick = (c: Combo) => {
    const slots = Array.isArray(c.slots) ? c.slots : [];
    if (slots.length === 0) {
      addItem({
        id: `combo:${c.id}:${Date.now()}`,
        name: c.name,
        price: Number(c.price),
        image_url: c.image_url ?? undefined,
        is_available: true,
        section_id: null,
        metadata: { combo_id: c.id },
      } as any);
      return;
    }
    setActive(c);
  };

  return (
    <div className="border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Combos
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {combos.map((c) => (
          <button
            key={c.id}
            onClick={() => handleClick(c)}
            className="snap-start shrink-0 w-40 rounded-xl border border-primary/30 bg-card p-2 text-left hover:border-primary hover:shadow-md transition-all"
          >
            {c.image_url ? (
              <img
                src={c.image_url}
                alt={c.name}
                loading="lazy"
                className="w-full h-20 rounded-lg object-cover mb-1.5"
              />
            ) : (
              <div className="w-full h-20 rounded-lg bg-primary/10 flex items-center justify-center mb-1.5">
                <Layers className="h-6 w-6 text-primary/40" />
              </div>
            )}
            <p className="text-xs font-bold text-foreground line-clamp-1">{c.name}</p>
            {c.description && (
              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                {c.description}
              </p>
            )}
            <p className="text-sm font-black text-primary mt-1">{formatBRL(Number(c.price))}</p>
          </button>
        ))}
      </div>
      {active && storeId && (
        <SnackBarComboBuilderDialog
          combo={active as any}
          storeId={storeId}
          onClose={() => setActive(null)}
          onConfirm={(item) => { addItem(item); setActive(null); }}
        />
      )}
    </div>
  );
}