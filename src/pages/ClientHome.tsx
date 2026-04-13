import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Search, Store, Repeat, ShoppingBag, Clock, ChevronRight, Zap, LogOut } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

const ClientHome = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState("");

  // Get user profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Get recent orders (last stores)
  const { data: recentOrders } = useQuery({
    queryKey: ["client-recent-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores!inner(id, name, image_url, slug, is_open), order_items(*, products(id, name, price, is_available, image_url, store_id))")
        .eq("client_id", user!.id)
        .in("status", ["entregue", "finalizado"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  // Search stores
  const { data: searchResults } = useQuery({
    queryKey: ["client-store-search", searchQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores_public")
        .select("id, name, image_url, slug, category, is_open")
        .eq("status", "ativo")
        .ilike("name", `%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
    staleTime: 1000 * 60,
  });

  // Unique last stores from orders
  const lastStores = recentOrders
    ? Array.from(
        new Map(
          recentOrders.map((o: any) => [o.stores?.id, o.stores])
        ).values()
      ).filter(Boolean).slice(0, 5)
    : [];

  const lastOrder = recentOrders?.[0];

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

  const goToStore = (store: any) => {
    if (store?.slug) {
      navigate(`/${store.slug}`);
    } else if (store?.id) {
      navigate(`/loja/${store.id}`);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Cliente";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary px-4 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-primary-foreground font-extrabold text-lg">ItaSuper</span>
          </div>
        </div>
        <h1 className="text-primary-foreground text-xl font-bold">
          Olá, {firstName}! 👋
        </h1>
        <p className="text-primary-foreground/70 text-sm mt-0.5">
          O que vai pedir hoje?
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="mt-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar loja pelo nome..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </form>
      </div>

      <div className="px-4 mt-5 space-y-6">
        {/* Search Results */}
        {searchQuery.length >= 2 && searchResults && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Search className="h-4 w-4 text-primary" />
              Resultados
            </h2>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma loja encontrada para "{searchQuery}"
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((store: any) => (
                  <button
                    key={store.id}
                    onClick={() => goToStore(store)}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors text-left"
                  >
                    {store.image_url ? (
                      <img src={store.image_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{store.category?.replace(/_/g, " ")}</p>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      store.is_open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}>
                      {store.is_open ? "Aberta" : "Fechada"}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Last Order - Quick Reorder */}
        {!searchQuery && lastOrder && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              Último pedido
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {lastOrder.stores?.image_url ? (
                  <img src={lastOrder.stores.image_url} className="w-10 h-10 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{lastOrder.stores?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastOrder.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "long", year: "numeric"
                    })}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary">{formatBRL(Number(lastOrder.total_price))}</span>
              </div>
              <div className="space-y-0.5 mb-3">
                {lastOrder.order_items?.slice(0, 3).map((item: any) => (
                  <p key={item.id} className="text-xs text-muted-foreground">
                    {item.quantity}x {item.products?.name || "Item"}
                  </p>
                ))}
                {(lastOrder.order_items?.length || 0) > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{lastOrder.order_items.length - 3} itens
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => goToStore(lastOrder.stores)}
                  className="flex-1 bg-muted text-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Store className="h-3.5 w-3.5" /> Ver loja
                </button>
                <button
                  onClick={() => handleReorder(lastOrder)}
                  className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Repeat className="h-3.5 w-3.5" /> Pedir de novo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Last Visited Stores */}
        {!searchQuery && lastStores.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Store className="h-4 w-4 text-primary" />
              Suas lojas
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {lastStores.map((store: any) => (
                <button
                  key={store.id}
                  onClick={() => goToStore(store)}
                  className="flex-shrink-0 w-28 flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-2xl hover:bg-muted/50 transition-colors"
                >
                  {store.image_url ? (
                    <img src={store.image_url} className="w-14 h-14 rounded-xl object-cover" alt="" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <p className="text-xs font-bold text-foreground text-center truncate w-full">{store.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Orders for Reorder */}
        {!searchQuery && recentOrders && recentOrders.length > 1 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-primary" />
              Pedir de novo
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {recentOrders.slice(1, 6).map((order: any) => (
                <div
                  key={order.id}
                  className="flex-shrink-0 w-44 bg-card border border-border rounded-2xl p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    {order.stores?.image_url ? (
                      <img src={order.stores.image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
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
                    {order.order_items?.slice(0, 2).map((item: any) => (
                      <p key={item.id} className="text-[10px] text-muted-foreground truncate">
                        {item.quantity}x {item.products?.name || "Item"}
                      </p>
                    ))}
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
        )}

        {/* Empty state - no orders yet */}
        {!searchQuery && (!recentOrders || recentOrders.length === 0) && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">Nenhum pedido ainda</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
              Pesquise uma loja pelo nome ou cole o link que o lojista compartilhou com você.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ClientHome;
