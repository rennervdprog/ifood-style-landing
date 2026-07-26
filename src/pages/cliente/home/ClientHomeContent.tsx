import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, Clock, Repeat, ShoppingBag, Store as StoreIcon, MapPin, Bell, MessageCircle,
  ChevronDown, ChevronRight, SlidersHorizontal, Sparkles, Star,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";
import SupportTicketModal from "@/components/SupportTicketModal";
import { useUserLocation } from "@/hooks/useUserLocation";
import { formatBRL } from "@/lib/utils";
import { mapStoresWithHours } from "../utils/mapStores";
import CategoryChips, { normalizeCategory } from "./CategoryChips";
import BentoHero from "./BentoHero";
import HighlightsBento from "./HighlightsBento";
import DiscoverGrid from "./DiscoverGrid";

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

const PUBLIC_STORE_SELECT = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, delivery_fee_type, delivery_fee_base, delivery_fee_per_km, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings";

// Taxa operacional da plataforma somada à entrega (fonte única: deliveryFee.ts).
const PLATFORM_FEE = 0.99;

const formatFeeLabel = (store: any): { label: string; free: boolean; prefix?: string } => {
  if (store.delivery_mode === "pickup") return { label: "Retirada", free: false };
  const type = store.delivery_fee_type || "fixed";
  if (type === "km") {
    const base = Number(store.delivery_fee_base || 0) + PLATFORM_FEE;
    if (!base) return { label: "Grátis", free: true };
    return { label: formatBRL(base), free: false, prefix: "A partir de" };
  }
  const total = Number(store.own_delivery_fee || 0) + PLATFORM_FEE;
  if (!Number(store.own_delivery_fee || 0)) return { label: "Grátis", free: true };
  return { label: formatBRL(total), free: false };
};

const formatDeliveryTime = (store: any): string => {
  const min = Number(store?.settings?.delivery_time_min);
  const max = Number(store?.settings?.delivery_time_max);
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
    return `${min}-${max} min`;
  }
  const km = typeof store.distanceKm === "number" ? store.distanceKm : null;
  if (km === null) return "30-45 min";
  const base = 20 + Math.round(km * 4);
  return `${base}-${base + 15} min`;
};

type HeroFilter = "no_fee" | "direct_delivery" | null;

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
  const [heroFilter, setHeroFilter] = useState<HeroFilter>(null);
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
    const categoryFiltered = activeCategory
      ? base.filter((s: any) => normalizeCategory(s.category) === activeCategory)
      : base;

    if (heroFilter === "direct_delivery") {
      return categoryFiltered.filter((s: any) => s.delivery_mode === "own");
    }

    return categoryFiltered;
  }, [searchQuery, searchResults, suggestedStores, activeCategory, heroFilter]);

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

  const handleStoreKeyDown = (event: KeyboardEvent<HTMLDivElement>, store: any) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    goToStore(store);
  };

  const scrollToStores = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("stores-h")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim()) setHeroFilter(null);
  }, []);

  const handleCategoryChange = useCallback((category: string | null) => {
    setActiveCategory(category);
    setHeroFilter(null);
  }, []);

  const handleExploreStores = useCallback(() => {
    setSearchQuery("");
    setActiveCategory(null);
    setHeroFilter(null);
    scrollToStores();
  }, [scrollToStores]);

  const handleSelectNoFee = useCallback(() => {
    setSearchQuery("");
    setActiveCategory(null);
    setHeroFilter("no_fee");
    scrollToStores();
  }, [scrollToStores]);

  const handleSelectDirectDelivery = useCallback(() => {
    setSearchQuery("");
    setActiveCategory(null);
    setHeroFilter("direct_delivery");
    scrollToStores();
  }, [scrollToStores]);

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
      .slice(0, 3);
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
    queryKey: ["discover-products", openStoreIds.length],
    queryFn: async () => {
      if (openStoreIds.length === 0) return [];
      const ids = shuffle(openStoreIds).slice(0, 60);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, store_id, is_available, created_at")
        .in("store_id", ids)
        .eq("is_available", true)
        .not("image_url", "is", null)
        .limit(200);
      if (error) throw error;
      // Diversify: no more than 2 items per loja, then embaralha de novo
      const perStore = new Map<string, number>();
      const diversified = shuffle(data || []).filter((p: any) => {
        const n = perStore.get(p.store_id) || 0;
        if (n >= 2) return false;
        perStore.set(p.store_id, n + 1);
        return true;
      });
      return shuffle(diversified).slice(0, 10);
    },
    enabled: openStoreIds.length > 0 && !searchQuery && !activeCategory,
    staleTime: 0,
    gcTime: 1000 * 30,
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
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
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
              <span className="font-display text-sm font-bold text-foreground truncate max-w-[220px]">
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
              onChange={(e) => handleSearchChange(e.target.value)}
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
        {/* Bento hero */}
        {!searchQuery && (
          <BentoHero
            activeAction={heroFilter}
            onExploreStores={handleExploreStores}
            onSelectNoFee={handleSelectNoFee}
            onSelectDirectDelivery={handleSelectDirectDelivery}
          />
        )}

        {/* Category chips */}
        {!searchQuery && suggestedStores && suggestedStores.length > 0 && (
          <CategoryChips
            stores={suggestedStores}
            active={activeCategory}
            onChange={handleCategoryChange}
          />
        )}

        {/* Last order highlight */}
        {!searchQuery && lastOrder && (
          <section aria-labelledby="last-order-h">
            <h2 id="last-order-h" className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Último pedido
            </h2>
            <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-3xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {lastOrder.stores?.image_url ? (
                  <img loading="lazy" decoding="async" src={lastOrder.stores.image_url}
                    className="w-12 h-12 rounded-2xl object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-foreground truncate">{lastOrder.stores?.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(lastOrder.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                    {" · "}
                    {lastOrder.order_items?.length || 0} itens
                  </p>
                </div>
                <span className="font-display text-sm font-extrabold text-primary">{formatBRL(Number(lastOrder.total_price))}</span>
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
            <h2 id="suas-lojas-h" className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <StoreIcon className="h-3.5 w-3.5" /> Suas lojas
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {lastStores.map((store: any) => (
                <div
                  key={store.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToStore(store)}
                  onKeyDown={(event) => handleStoreKeyDown(event, store)}
                  data-native-scroll-pan
                  className="shrink-0 w-20 flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  {store.image_url ? (
                    <img loading="lazy" decoding="async" src={store.image_url}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20 ring-offset-2 ring-offset-background" alt={store.name} />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 ring-2 ring-primary/20 ring-offset-2 ring-offset-background flex items-center justify-center">
                      <StoreIcon className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <p className="font-display text-[10px] font-semibold text-foreground text-center truncate w-full leading-tight">
                    {store.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Destaques — bento 2x2 */}
        {!searchQuery && !activeCategory && sponsoredStores.length > 0 && (
          <section aria-labelledby="patrocinados-h">
            <div className="flex justify-between items-center mb-3">
              <h2 id="patrocinados-h" className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Destaques da região
              </h2>
            </div>
            <HighlightsBento stores={sponsoredStores} onSelect={goToStore} />
          </section>
        )}

        {/* Restaurantes perto de você — rich vertical list */}
        {!searchQuery && !activeCategory && discoverProducts && discoverProducts.length > 0 && (
          <section aria-labelledby="descubra-h">
            <div className="flex justify-between items-center mb-3">
              <h2 id="descubra-h" className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Descubra
              </h2>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Selecionado pra você</span>
            </div>
            <DiscoverGrid products={discoverProducts} storesMap={openStoresMap} onSelect={goToStore} />
          </section>
        )}

        <section aria-labelledby="stores-h">
          <div className="flex items-end justify-between mb-3 gap-2">
            <h2 id="stores-h" className="font-display text-base font-bold text-foreground min-w-0 truncate">
              {searchQuery.length >= 2
                ? `Resultados para "${searchQuery}"`
                : heroFilter === "direct_delivery"
                ? "Lojas com entrega direta"
                : heroFilter === "no_fee"
                ? "Lojas sem taxa de serviço"
                : activeCategory
                ? "Filtrado"
                : effectiveCity
                ? `Todas as lojas em ${effectiveCity}`
                : "Todas as lojas"}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold text-muted-foreground">
                {visibleStores.length} {visibleStores.length === 1 ? "loja" : "lojas"}
              </span>
              {heroFilter && (
                <button
                  type="button"
                  onClick={() => setHeroFilter(null)}
                  className="text-[11px] font-bold text-primary"
                >
                  Limpar
                </button>
              )}
            </div>
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
                  : heroFilter === "direct_delivery"
                  ? "Nenhuma loja com entrega direta no momento."
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
            <ul className="divide-y divide-border/50" data-native-scroll-pan>
              {listStores.map((store: any) => {
                const isOpen = !!store.realIsOpen;
                const dist = formatDistance(store.distanceKm);
                const rating =
                  typeof store.rating === "number" && store.rating > 0
                    ? Number(store.rating)
                    : null;
                const fee = formatFeeLabel(store);
                const timeLabel = formatDeliveryTime(store);
                const categoryLabel = (store.category || "Loja").replace(/_/g, " ");
                return (
                  <li key={store.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => goToStore(store)}
                      onKeyDown={(event) => handleStoreKeyDown(event, store)}
                      data-native-scroll-pan
                      className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-opacity cursor-pointer"
                    >
                      {store.image_url ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={store.image_url}
                          alt={store.name}
                          className={`w-[68px] h-[68px] rounded-2xl object-cover border border-border/50 shrink-0 ${
                            isOpen ? "" : "grayscale opacity-60"
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-[68px] h-[68px] rounded-2xl bg-muted flex items-center justify-center shrink-0 ${
                            isOpen ? "" : "opacity-60"
                          }`}
                        >
                          <StoreIcon className="h-7 w-7 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[15px] font-bold text-foreground truncate leading-tight">
                            {store.name}
                          </p>
                          {rating !== null && (
                            <span className="flex items-center gap-0.5 text-[12px] font-bold text-amber-600 shrink-0 mt-0.5">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              {rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground truncate capitalize mt-0.5">
                          {categoryLabel}
                          {dist ? ` • ${dist}` : ""}
                          {rating === null ? " • Novo" : ""}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[12px]">
                          <span className="text-muted-foreground">{timeLabel}</span>
                          <span className="text-muted-foreground/50">•</span>
                          {fee.prefix && (
                            <span className="text-muted-foreground">{fee.prefix}</span>
                          )}
                          <span
                            className={
                              fee.free
                                ? "font-bold text-emerald-600"
                                : "font-semibold text-foreground"
                            }
                          >
                            {fee.label}
                          </span>
                        </div>
                        {!isOpen && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider rounded bg-rose-100 text-rose-700">
                              FECHADA
                            </span>
                            {store.statusReason && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {store.statusReason}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          isOpen ? "text-muted-foreground" : "text-muted-foreground/40"
                        }`}
                      />
                    </div>
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