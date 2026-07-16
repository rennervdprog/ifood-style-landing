import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import type { Product } from "@/pages/pdv/types";

interface Props {
  storeId?: string | null;
  products: Product[];
  addItem: (p: Product) => void;
  getQty: (id: string) => number;
}

/**
 * Grade rápida de favoritos — top 20 produtos mais vendidos da loja nos
 * últimos 30 dias. Cada tecla mostra um código curto (01..20) para
 * memorização e um clique único adiciona ao carrinho. Renderiza acima do
 * catálogo, dentro do topSlot do PdvCatalogSection.
 */
export const PdvFavoritesBar = ({ storeId, products, addItem, getQty }: Props) => {
  const productMap = new Map(products.map((p) => [p.id, p]));

  const { data: favIds = [] } = useQuery({
    queryKey: ["pdv-favorites", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("store_id", storeId!)
        .gte("created_at", since.toISOString())
        .neq("status", "cancelado")
        .limit(500);
      const ids = (orders || []).map((o: any) => o.id);
      if (!ids.length) return [] as string[];
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .in("order_id", ids);
      const counts = new Map<string, number>();
      (items || []).forEach((it: any) => {
        if (!it.product_id) return;
        counts.set(it.product_id, (counts.get(it.product_id) || 0) + Number(it.quantity || 0));
      });
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id);
    },
  });

  const favs = favIds
    .map((id) => productMap.get(id))
    .filter((p): p is Product => !!p);

  if (favs.length === 0) return null;

  return (
    <div className="px-3 pt-2.5 shrink-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Favoritos do turno
        </span>
        <span className="text-[9px] text-muted-foreground/70">
          · toque para adicionar
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {favs.map((p, i) => {
          const qty = getQty(p.id);
          const code = String(i + 1).padStart(2, "0");
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => addItem(p)}
              className={`relative shrink-0 w-[104px] rounded-xl border px-2 py-1.5 text-left transition-all active:scale-[0.97] ${
                qty > 0
                  ? "bg-primary/10 border-primary/40 shadow-sm"
                  : "bg-card border-border/70 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="pdv-mono text-[9px] font-black text-muted-foreground bg-muted/60 rounded px-1 py-0.5">
                  {code}
                </span>
                {qty > 0 && (
                  <span className="pdv-mono text-[10px] font-black text-primary">
                    {qty}x
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 min-h-[26px]">
                {p.name}
              </p>
              <p className={`text-[11px] font-black pdv-mono mt-0.5 ${qty > 0 ? "text-primary" : "text-foreground/70"}`}>
                {formatBRL(Number(p.price))}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};