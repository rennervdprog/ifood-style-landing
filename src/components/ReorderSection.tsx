import { formatBRL } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { Repeat, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const ReorderSection = () => {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const { data: recentOrders } = useQuery({
    queryKey: ["recent-orders-reorder", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores(id, name, image_url, is_open), order_items(*, products(id, name, price, is_available, image_url, store_id))")
        .eq("client_id", user!.id)
        .in("status", ["entregue", "finalizado"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (!user || !recentOrders || recentOrders.length === 0) return null;

  const handleReorder = (order: any) => {
    const availableItems = order.order_items?.filter((item: any) => item.products?.is_available) || [];
    if (availableItems.length === 0) {
      toast.error("Nenhum item deste pedido está disponível no momento.");
      return;
    }
    
    availableItems.forEach((item: any) => {
      if (item.products) {
        addItem({
          id: item.products.id,
          name: item.products.name,
          price: item.products.price,
          basePrice: item.products.price,
          store_id: item.products.store_id,
          store_name: order.stores?.name || "",
          image_url: item.products.image_url,
        }, item.quantity);
      }
    });

    toast.success(`${availableItems.length} itens adicionados ao carrinho!`);
    navigate("/carrinho");
  };

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Repeat className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Pedir de Novo</h2>
      </div>
      <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
        {recentOrders.slice(0, 5).map((order: any) => (
          <div
            key={order.id}
            className="flex-shrink-0 w-44 bg-card border border-border rounded-2xl p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              {order.stores?.image_url ? (
                <img loading="lazy" decoding="async" src={order.stores.image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{order.stores?.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </div>
            </div>
            <div className="space-y-0.5">
              {order.order_items?.slice(0, 3).map((item: any) => (
                <p key={item.id} className="text-[10px] text-muted-foreground truncate">
                  {item.quantity}x {item.products?.name || "Item"}
                </p>
              ))}
              {(order.order_items?.length || 0) > 3 && (
                <p className="text-[10px] text-muted-foreground">+{order.order_items.length - 3} itens</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{formatBRL(Number(order.total_price))}</span>
              <button
                onClick={() => handleReorder(order)}
                className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
              >
                <Repeat className="h-3 w-3" /> Pedir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReorderSection;
