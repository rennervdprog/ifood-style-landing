import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, Clock, Repeat, ShoppingBag, Store as StoreIcon, MapPin, Bell, MessageCircle,
  ChevronDown, ChevronRight, SlidersHorizontal, Star, Heart, Sparkles,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";
import SupportTicketModal from "@/components/SupportTicketModal";
import { useUserLocation } from "@/hooks/useUserLocation";
import { formatBRL } from "@/lib/utils";
import { mapStoresWithHours } from "../utils/mapStores";
import CategoryChips, { normalizeCategory } from "./CategoryChips";
import PromoBanners from "@/components/PromoBanners";

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const ROTATING_PLACEHOLDERS = [
  "Buscar pizza...",
  "Buscar mercado...",
  "Buscar marmita...",
  "Buscar hambúrguer...",
  "Buscar açaí...",
];

const PUBLIC_STORE_SELECT = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings";

const normalizeCity = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const loadPublicStores = async ({
  city,
  query,
  fallbackToAll,
  includeTest,
}: {
  city?: string | null;
  query?: string;
  fallbackToAll: boolean;
  includeTest: boolean;
}) => {
  const cityNorm = normalizeCity(city);
  const table = includeTest ? "stores" : "stores_public";
  let dbQuery = (supabase as any)
    .from(table)
    .select(PUBLIC_STORE_SELECT)
    .eq("status", "ativo")
    .limit(50);

  if (query?.trim()) dbQuery = dbQuery.ilike("name", `%${query.trim()}%`);

  const { data, error } = await dbQuery;
  if (error) {
    const { data: functionData, error: functionError } = await supabase.functions.invoke("public-store-catalog", {
      body: {
        city,
        query,
        limit: 50,
        fallback_to_all: fallbackToAll,
        include_test: includeTest,
      },
    });
    if (functionError) throw functionError;
    return Array.isArray(functionData?.stores) ? functionData.stores : [];
  }

  let stores = Array.isArray(data) ? data : [];
  if (cityNorm) {
    const filtered = stores.filter((store: any) => normalizeCity(store.address_city) === cityNorm);
    stores = filtered.length > 0 || !fallbackToAll ? filtered : stores;
  }

  return stores;
};

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
      const rows = await loadPublicStores({
        city: effectiveCity,
        fallbackToAll: false,
        includeTest: !!user?.email?.endsWith("@itasuper.test"),
      });
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
      const stores = await loadPublicStores({
        query: searchQuery,
        fallbackToAll: true,
        includeTest: !!user?.email?.endsWith("@itasuper.test"),
      });
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

  const sponsoredStores = useMemo(() => {
    return (visibleStores || [])
      .filter((s: any) => !!s.image_url && s.realIsOpen)
      .slice(0, 8);
  }, [visibleStores]);

  const openStoreIds = useMemo(
    () => (suggestedStores || []).filter((s: any) => s.realIsOpen).map((s: any) => s.id),
    [suggestedStores]
  );
  const openStoresMap = useMemo(() => {
    const map = new Map<string, any>();
    (suggestedStores || []).forEach((s: any) => map.set(s.id, s));
    return map;
  }, [suggestedStores]);

  const { data: discoverProducts } = useQuery({
    queryKey: ["discover-products", openStoreIds.slice(0, 30).join(",")],
    queryFn: async () => {
      if (openStoreIds.length === 0) return [];
      const ids = shuffle(openStoreIds).slice(0, 30);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, store_id, is_available")
        .in("store_id", ids)
        .eq("is_available", true)
        .not("image_url", "is", null)
        .limit(80);
      if (error) throw error;
      return shuffle(data || []).slice(0, 12);
    },
    enabled: openStoreIds.length > 0 && !searchQuery && !activeCategory,
    staleTime: 1000 * 60 * 3,
  });

  const sponsoredIds = useMemo(() => new Set(sponsoredStores.map((s: any) => s.id)), [sponsoredStores]);
  const listStores = useMemo(
    () => (visibleStores || []).filter((s: any) => !sponsoredIds.has(s.id)),
    [visibleStores, sponsoredIds]
  );

  const formatDistance = (km?: number | null) =>
    typeof km === "number" ? (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`) : null;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <SupportTicketModal open={showSupport} onClose={() => setShowSupport(false)} userRole="cliente" />

      {/* Sticky header — marketplace style */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
          <button
            onClick={userLocation.refresh}
            className="flex flex-col text-left min-w-0 active:opacity-70"
            aria-label="Atualizar localização"
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Entregar em
            </span>
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold text-foreground truncate max-w-[220px]">
                {locationLabel}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </span>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => navigate("/pedidos")}
              className="relative p-2 bg-muted rounded-xl hover:bg-muted/70 transition-colors"
              aria-label="Meus pedidos"
            >
              <Bell className="w-5 h-5 text-foreground" />
              <span className="absolute top-1.5 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
            </button>
            <button
              onClick={() => setShowSupport(true)}
              className="p-2 bg-muted rounded-xl hover:bg-muted/70 transition-colors"
              aria-label="Suporte"
            >
              <MessageCircle className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 pt-1 flex gap-2" data-tour="search">
          <div className="flex-1 bg-muted rounded-xl flex items-center px-3 gap-2 border border-transparent focus-within:border-primary transition-colors">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
              aria-label="Pesquisar lojas"
              className="bg-transparent w-full py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <button
            className="bg-primary p-3 rounded-xl text-primary-foreground shadow-md shadow-primary/20 active:scale-95 transition-transform"
            aria-label="Filtros"
            onClick={() => toast("Filtros em breve.")}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 pt-3 space-y-6">
        {/* Promo banners */}
        {!searchQuery && (
          <div className="-mx-4">
            <PromoBanners />
          </div>
        )}

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

        {/* Patrocinados — horizontal cards */}
        {!searchQuery && !activeCategory && sponsoredStores.length > 0 && (
          <section aria-labelledby="patrocinados-h">
            <div className="flex justify-between items-center mb-3">
              <span
                id="patrocinados-h"
                className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wide"
              >
                <Sparkles className="w-3 h-3" /> Destaques
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {sponsoredStores.map((store: any) => (
                <button
                  key={store.id}
                  onClick={() => goToStore(store)}
                  className="min-w-[150px] max-w-[150px] bg-card rounded-2xl overflow-hidden border border-border shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  <div className="h-24 bg-muted relative">
                    {store.image_url ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={store.image_url}
                        alt={store.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <StoreIcon className="w-8 h-8 text-primary/60" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-background/80 p-1.5 rounded-full backdrop-blur-sm">
                      <Heart className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-xs font-bold text-foreground truncate">{store.name}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {store.rating ? Number(store.rating).toFixed(1) : "Novo"}
                      </span>
                      {formatDistance(store.distanceKm) && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistance(store.distanceKm)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Restaurantes perto de você — rich vertical list */}
        {!searchQuery && !activeCategory && discoverProducts && discoverProducts.length > 0 && (
          <section aria-labelledby="descubra-h">
            <div className="flex justify-between items-center mb-3">
              <h2 id="descubra-h" className="text-base font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Descubra
              </h2>
              <span className="text-[11px] font-bold text-muted-foreground">Aleatório</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {discoverProducts.map((p: any) => {
                const store = openStoresMap.get(p.store_id);
                return (
                  <button
                    key={p.id}
                    onClick={() => store && goToStore(store)}
                    className="bg-card border border-border rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="aspect-square bg-muted relative">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                      {store && (
                        <p className="text-[10px] text-muted-foreground truncate">{store.name}</p>
                      )}
                      <p className="text-sm font-extrabold text-primary mt-1">{formatBRL(Number(p.price))}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="stores-h">
          <div className="flex items-end justify-between mb-3 gap-2">
            <h2 id="stores-h" className="text-base font-bold text-foreground min-w-0 truncate">
              {searchQuery.length >= 2
                ? `Resultados para "${searchQuery}"`
                : activeCategory
                ? "Filtrado"
                : effectiveCity
                ? `Restaurantes em ${effectiveCity}`
                : "Restaurantes perto de você"}
            </h2>
            <span className="text-[11px] font-bold text-muted-foreground shrink-0">
              {visibleStores.length} {visibleStores.length === 1 ? "loja" : "lojas"}
            </span>
          </div>

          {loadingStores ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                    <div className="h-2.5 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : listStores.length === 0 && sponsoredStores.length === 0 ? (
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
            <ul className="space-y-5">
              {listStores.map((store: any) => {
                const isOpen = !!store.realIsOpen;
                const dist = formatDistance(store.distanceKm);
                return (
                  <li key={store.id}>
                    <button
                      onClick={() => goToStore(store)}
                      className="group w-full flex items-start gap-3 text-left active:opacity-80"
                    >
                      <div
                        className={`w-16 h-16 rounded-full overflow-hidden shrink-0 shadow-sm border-2 ${
                          isOpen ? "border-primary/20" : "border-border"
                        }`}
                      >
                        {store.image_url ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={store.image_url}
                            alt={store.name}
                            className={`w-full h-full object-cover ${isOpen ? "" : "grayscale"}`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10">
                            <StoreIcon className="w-6 h-6 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-foreground truncate">{store.name}</h3>
                          <ChevronRight
                            className={`w-5 h-5 shrink-0 mt-0.5 transition-colors ${
                              isOpen ? "text-muted-foreground group-hover:text-primary" : "text-muted-foreground/40"
                            }`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {(store.category || "Loja").replace(/_/g, " ")}
                          {dist ? ` • ${dist}` : ""}
                          {store.rating ? ` • ★ ${Number(store.rating).toFixed(1)}` : ""}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                              isOpen
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isOpen ? "Aberto" : "Fechado"}
                          </span>
                          {!isOpen && store.statusReason && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {store.statusReason}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente_home" />
    </div>
  );
};

export default ClientHomeContent;