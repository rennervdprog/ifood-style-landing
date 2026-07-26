import { memo } from "react";
import { formatBRL } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Star } from "lucide-react";

const PopularProducts = memo(() => {
  const navigate = useNavigate();

  const { data: topProducts } = useQuery({
    queryKey: ["popular-products"],
    queryFn: async () => {
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("product_id, quantity, products(id, name, price, image_url, store_id, is_available, stores:store_id(name, id, slug))")
        .limit(60);
      if (error) throw error;

      const productMap = new Map<string, { product: any; totalQty: number }>();
      (orderItems || []).forEach((item: any) => {
        if (!item.products || !item.products.is_available) return;
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.totalQty += item.quantity;
        } else {
          productMap.set(item.product_id, { product: item.products, totalQty: item.quantity });
        }
      });

      return Array.from(productMap.values())
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 8);
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!topProducts || topProducts.length === 0) return null;

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Mais Pedidos</h2>
      </div>
      <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
        {topProducts.map(({ product, totalQty }) => (
          <div
            key={product.id}
            onClick={() => navigate(product.stores?.slug ? `/${product.stores.slug}` : `/loja/${product.store_id}`)}
            className="flex-shrink-0 w-32 bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                className="w-full h-20 object-cover"
                alt={product.name}
                loading="lazy"
                decoding="async"
                width={128}
                height={80}
              />
            ) : (
              <div className="w-full h-20 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <Star className="h-6 w-6 text-primary/40" />
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-bold text-foreground truncate">{product.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{(product as any).stores?.name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-black text-primary">{formatBRL(Number(product.price))}</span>
                <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{totalQty}x</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

PopularProducts.displayName = "PopularProducts";

export default PopularProducts;
