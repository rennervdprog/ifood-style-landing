import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { UtensilsCrossed } from "lucide-react";
import type { Product } from "@/pages/pdv/types";

interface DailyMenu {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  sort_order: number;
}

interface Props {
  storeId?: string;
  addItem: (p: Product) => void;
}

/**
 * Barra "Prato do Dia" — só aparece quando store_type='restaurant' e há marmitex
 * cadastrado para hoje. Clicar adiciona linha fechada no carrinho.
 */
export default function RestaurantDailyMenuBar({ storeId, addItem }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: menus } = useQuery({
    queryKey: ["daily-menus", storeId, today],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("daily_menus")
        .select("id,name,description,price,image_url,sort_order")
        .eq("store_id", storeId)
        .eq("active", true)
        .eq("menu_date", today)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as DailyMenu[]) ?? [];
    },
  });

  if (!menus || menus.length === 0) return null;

  return (
    <div className="border-b border-border bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-2">
        <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Prato do Dia
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {menus.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              addItem({
                id: `menu:${m.id}:${Date.now()}`,
                name: m.name,
                price: Number(m.price),
                image_url: m.image_url ?? undefined,
                is_available: true,
                section_id: null,
                metadata: { daily_menu_id: m.id },
              } as any)
            }
            className="snap-start shrink-0 w-40 rounded-xl border border-emerald-500/30 bg-card p-2 text-left hover:border-emerald-500 hover:shadow-md transition-all"
          >
            {m.image_url ? (
              <img src={m.image_url} alt={m.name} loading="lazy" className="w-full h-20 rounded-lg object-cover mb-1.5" />
            ) : (
              <div className="w-full h-20 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-1.5">
                <UtensilsCrossed className="h-6 w-6 text-emerald-500/40" />
              </div>
            )}
            <p className="text-xs font-bold text-foreground line-clamp-1">{m.name}</p>
            {m.description && (
              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{m.description}</p>
            )}
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {formatBRL(Number(m.price))}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}