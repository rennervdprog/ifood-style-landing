import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, Clock, Repeat, ShoppingBag, Store as StoreIcon, MapPin, RefreshCw, Bell, MessageCircle,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";
import SupportTicketModal from "@/components/SupportTicketModal";
import { useUserLocation } from "@/hooks/useUserLocation";
import { formatBRL } from "@/lib/utils";
import { mapStoresWithHours } from "../utils/mapStores";
import CategoryChips, { normalizeCategory } from "./CategoryChips";
import StoreCard from "./StoreCard";

const ROTATING_PLACEHOLDERS = [
  "Buscar pizza...",
  "Buscar mercado...",
  "Buscar marmita...",
  "Buscar hambúrguer...",
  "Buscar açaí...",
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const ClientHomeContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const userLocation = useUserLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    if (searchQuery) return;
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % ROTATING_PLACEHOLDERS.length), 2800);
    return () => clearInterval(t);
  }, [searchQuery]);

  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, city").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

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

  const effectiveCity = userLocation.city?.trim() || profile?.city?.trim() || null;

  const { data: suggestedStores, isLoading: loadingStores } = useQuery({
    queryKey: ["available-stores", effectiveCity || "all", userLocation.coords?.lat, userLocation.coords?.lng],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("public-store-catalog", {
        body: {
          city: effectiveCity,
          limit: 50,
          fallback_to_all: false,
          include_test: !!user?.email?.endsWith("@itasuper.test"),
        },
      });
      if (error) throw error;
      const rows = Array.isArray(data?.stores) ? data.stores : [];
      const storeIds = rows.map((s: any) => s.id);
      if (storeIds.length === 0) return [];
      const { data: allHours } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", storeIds);
      return mapStoresWithHours(rows, allHours, userLocation.coords, userLocation.city);
    },
    enabled: true,
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const { data: searchResults } = useQuery({
    queryKey: ["client-store-search", searchQuery, userLocation.coords?.lat, userLocation.coords?.lng],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("public-store-catalog", {
        body: {
          query: searchQuery,
          limit: 50,
          fallback_to_all: true,
          include_test: !!user?.email?.endsWith("@itasuper.test"),
        },
      });
      if (error) throw error;
      const stores = Array.isArray(data?.stores) ? data.stores : [];
      if (stores.length === 0) return [];
      const storeIds = stores.map((s: any) => s.id);
      const { data: allHours } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", storeIds);
      return mapStoresWithHours(stores, allHours, userLocation.coords, userLocation.city);
    },
    enabled: searchQuery.length >= 2,
    staleTime: 1000 * 60,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  const visibleStores = useMemo(() => {
    const base = searchQuery.length >= 2 ? searchResults || [] : suggestedStores || [];
    if (!activeCategory) return base;
    return base.filter((s: any) => normalizeCategory(s.category) === activeCategory);
  }, [searchQuery, searchResults, suggestedStores, activeCategory]);

  const lastStores = useMemo(() => {
    if (!recentOrders) return [];
    return Array.from(new Map(recentOrders.map((o: any) => [o.stores?.id, o.stores])).values())
      .filter(Boolean)
      .slice(0, 6);
  }, [recentOrders]);

  const lastOrder = recentOrders?.[0];

  const goToStore = (store: any) => {
    if (store?.slug) navigate(`/${store.slug}`);
    else if (store?.id) navigate(`/loja/${store.id}`);
  };

  const handleReorder = (order: any) => {
    const availableItems = order.order_items?.filter((i: any) => i.products?.is_available) || [];
    if (availableItems.length === 0) { toast.error("Nenhum item disponível no momento."); return; }
    availableItems.forEach((item: any) => {
      if (item.products) {
        addItem({
          id: item.products.id, name: item.products.name, price: item.products.price,
          basePrice: item.products.price, store_id: item.products.store_id,
          store_name: order.stores?.name || "", image_url: item.products.image_url,
        }, item.quantity);
      }
    });
    toast.success(`${availableItems.length} itens adicionados ao carrinho!`);
    navigate("/carrinho");
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Cliente";
  const locationLabel = userLocation.city || effectiveCity || (userLocation.ready ? "Sem localização" : "Detectando...");

  return (
    <div className="min-h-dvh bg-background pb-24">
      <SupportTicketModal open={showSupport} onClose={() => setShowSupport(false)} userRole="cliente" />

      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground rounded-b-3xl shadow-sm">
        <div className="px-4 pt-9 pb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={userLocation.refresh}
              className="flex items-center gap-1.5 text-left min-w-0 active:opacity-80"
              aria-label="Atualizar localização"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold opacity-70 tracking-wider leading-none">
                  Entregar em
                </p>
                <p className="text-sm font-bold truncate flex items-center gap-1">
                  {locationLabel}
                  <RefreshCw className="h-3 w-3 opacity-60" />
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => navigate("/pedidos")}
                className="w-9 h-9 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
                aria-label="Meus pedidos"
                title="Meus pedidos"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowSupport(true)}
                className="w-9 h-9 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
                aria-label="Suporte"
                title="Suporte"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <h1 className="text-lg font-bold leading-tight">
            <span className="opacity-80 font-medium">{greeting()},</span> {firstName} 👋
          </h1>
          <p className="text-xs opacity-75 mt-0.5">O que você quer pedir hoje?</p>

          <div className="mt-3 relative" data-tour="search">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
              aria-label="Pesquisar lojas"
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-background text-foreground placeholder:text-muted-foreground text-sm font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
            />
          </div>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-6">
        {/* Category chips */}
        {!searchQuery && suggestedStores && suggestedStores.length > 0 && (
          <CategoryChips
            stores={suggestedStores}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        )}

        {/* Last order highlight */}
        {!searchQuery && lastOrder && (
          <section aria-labelledby="last-order-h">
            <h2 id="last-order-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Último pedido
            </h2>
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {lastOrder.stores?.image_url ? (
                  <img loading="lazy" decoding="async" src={lastOrder.stores.image_url}
                    className="w-11 h-11 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{lastOrder.stores?.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(lastOrder.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                    {" · "}
                    {lastOrder.order_items?.length || 0} itens
                  </p>
                </div>
                <span className="text-sm font-extrabold text-primary">{formatBRL(Number(lastOrder.total_price))}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => goToStore(lastOrder.stores)}
                  className="flex-1 h-10 bg-card text-foreground text-xs font-bold rounded-xl border border-border hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <StoreIcon className="h-3.5 w-3.5" /> Ver loja
                </button>
                <button
                  onClick={() => handleReorder(lastOrder)}
                  className="flex-1 h-10 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm shadow-primary/30 hover:brightness-105 transition-all flex items-center justify-center gap-1.5"
                >
                  <Repeat className="h-3.5 w-3.5" /> Pedir de novo
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Suas lojas (atalho rápido) */}
        {!searchQuery && lastStores.length > 0 && (
          <section aria-labelledby="suas-lojas-h">
            <h2 id="suas-lojas-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <StoreIcon className="h-3.5 w-3.5" /> Suas lojas
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {lastStores.map((store: any) => (
                <button
                  key={store.id}
                  onClick={() => goToStore(store)}
                  className="shrink-0 w-20 flex flex-col items-center gap-1.5"
                >
                  {store.image_url ? (
                    <img loading="lazy" decoding="async" src={store.image_url}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-border" alt={store.name} />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-border flex items-center justify-center">
                      <StoreIcon className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <p className="text-[10px] font-semibold text-foreground text-center truncate w-full leading-tight">
                    {store.name}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Reorder carousel */}
        {!searchQuery && recentOrders && recentOrders.length > 1 && (
          <section aria-labelledby="reorder-h">
            <h2 id="reorder-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" /> Pedir de novo
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {recentOrders.slice(1, 8).map((order: any) => (
                <div key={order.id} className="shrink-0 w-52 bg-card border border-border rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {order.stores?.image_url ? (
                      <img loading="lazy" decoding="async" src={order.stores.image_url}
                        className="w-9 h-9 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate">{order.stores?.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-0.5 min-h-[28px]">
                    {order.order_items?.slice(0, 2).map((item: any) => (
                      <p key={item.id} className="text-[10px] text-muted-foreground truncate">
                        {item.quantity}x {item.products?.name || "Item"}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <span className="text-xs font-extrabold text-foreground">{formatBRL(Number(order.total_price))}</span>
                    <button
                      onClick={() => handleReorder(order)}
                      className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 hover:brightness-105"
                    >
                      <Repeat className="h-3 w-3" /> Pedir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main store list */}
        <section aria-labelledby="stores-h">
          <div className="flex items-end justify-between mb-2 gap-2">
            <h2 id="stores-h" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 min-w-0">
              <StoreIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {searchQuery.length >= 2
                  ? `Resultados para "${searchQuery}"`
                  : activeCategory
                  ? "Filtrado"
                  : effectiveCity
                  ? `Lojas em ${effectiveCity}`
                  : "Lojas disponíveis"}
              </span>
            </h2>
            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
              {visibleStores.length} {visibleStores.length === 1 ? "loja" : "lojas"}
            </span>
          </div>

          {loadingStores ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : visibleStores.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                <StoreIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {searchQuery.length >= 2
                  ? `Nenhuma loja encontrada para "${searchQuery}"`
                  : activeCategory
                  ? "Nenhuma loja nesta categoria"
                  : effectiveCity
                  ? `Nenhuma loja disponível em ${effectiveCity}`
                  : "Nenhuma loja disponível no momento."}
              </p>
              {activeCategory && (
                <button onClick={() => setActiveCategory(null)} className="text-xs text-primary font-bold mt-2">
                  Ver todas as categorias
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleStores.map((store: any) => (
                <StoreCard key={store.id} store={store} onClick={() => goToStore(store)} />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente_home" />
    </div>
  );
};

export default ClientHomeContent;