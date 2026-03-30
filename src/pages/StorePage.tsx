import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Star, Plus } from "lucide-react";
import { toast } from "sonner";
import CartFAB from "@/components/CartFAB";
import BottomNav from "@/components/BottomNav";

const StorePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const { data: store } = useQuery({
    queryKey: ["store", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", id!)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleAdd = (product: NonNullable<typeof products>[0]) => {
    addItem({
      id: product.id,
      store_id: product.store_id,
      store_name: store?.name || "",
      name: product.name,
      price: product.price,
      image_url: product.image_url,
    });
    toast.success("Item adicionado ao carrinho!");
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Store header */}
      <div className="relative h-48 bg-muted">
        {store?.image_url ? (
          <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <span className="text-5xl">🍽️</span>
          </div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 bg-card/80 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Store info */}
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-xl font-black text-foreground">{store?.name}</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-muted-foreground capitalize">{store?.category}</span>
          {store?.rating && (
            <div className="flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              <span className="text-sm font-bold">{store.rating}</span>
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-foreground mb-4">Cardápio</h2>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
                <div className="w-20 h-20 bg-muted rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {products?.map((product) => (
              <div
                key={product.id}
                className="flex gap-3 bg-card rounded-2xl p-3 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-foreground">{product.name}</h3>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  <span className="text-sm font-black text-primary mt-2 block">
                    R$ {product.price.toFixed(2)}
                  </span>
                </div>
                <div className="relative flex-shrink-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-20 h-20 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                      <span className="text-2xl">🍴</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleAdd(product)}
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform"
                  >
                    <Plus className="h-5 w-5" strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CartFAB />
      <BottomNav />
    </div>
  );
};

export default StorePage;
