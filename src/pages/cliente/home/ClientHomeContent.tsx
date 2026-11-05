import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, ShoppingBag, Store as StoreIcon, MapPin,
  ChevronDown, ChevronRight, Star, Pencil, Tag, ArrowUpDown, Check,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useBatchStoreDistances } from "@/hooks/useBatchStoreDistances";
import { formatBRL } from "@/lib/utils";
import { describeStoreFee } from "@/lib/deliveryFeeDisplay";
import { formatDistanceKm } from "@/lib/formatDistance";
import { previewStoreAccess } from "@/lib/fraudCheck";
import { mapStoresWithHours } from "../utils/mapStores";
import { filterStoresWithOnlineDrivers } from "@/lib/storeVisibility";
import { normalizeCategory } from "./CategoryChips";

// Full select (para tabela `stores` — inclui colunas que só existem na tabela base).
const FULL_STORE_SELECT = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, delivery_fee, delivery_fee_type, delivery_fee_base, delivery_fee_per_km, estimated_delivery_time, minimum_order_value, free_delivery_threshold, max_delivery_km, delivery_radius, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings, platform_fee_split";
// Select da view de vitrine: não inclui plano, comissão ou outros dados comerciais internos.
const PUBLIC_VIEW_SELECT = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, delivery_fee, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, estimated_delivery_time, minimum_order_value, free_delivery_threshold, max_delivery_km, delivery_radius, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings, platform_fee_split, network_id, is_matriz, is_visible, platform_split_effective";

// Fonte única de verdade — helper espelha RPC compute_store_delivery_fee.
const formatFeeLabel = (store: any): { label: string; free: boolean; prefix?: string } => {
  const d = describeStoreFee(store);
  return { label: d.label, free: d.free, prefix: d.prefix };
};

const formatDeliveryTime = (store: any): string => {
  const raw = (store?.estimated_delivery_time || "").toString().trim();
  if (raw) return raw.includes("min") ? raw : `${raw} min`;
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
type SortMode = "padrao" | "taxa" | "avaliacao" | "abertas";

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
    .select(includeTest ? FULL_STORE_SELECT : PUBLIC_VIEW_SELECT)
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

  // Regra vitrine: esconde pdv_only e lojas sem entregador vinculado online.
  return await filterStoresWithOnlineDrivers(stores);
};

const getStoreAccessPreview = (store: any, coords: { lat: number; lng: number } | null, city?: string | null) => previewStoreAccess(store, coords, city);

// ── Categorias da home (mesmas do app KMP): baldes fixos com ícone 3D próprio.
// `keys` = valores normalizados de stores.category que caem em cada balde.
const CATEGORY_BUCKETS: { id: string; label: string; icon: string; keys: string[] }[] = [
  { id: "lanches", label: "Lanches", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_lanches_3d.webp", keys: ["lanches", "lanchonete", "hamburgueria", "hamburguer"] },
  { id: "pizzaria", label: "Pizzaria", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_pizzaria_3d.webp", keys: ["pizzas", "pizzaria", "pizza"] },
  { id: "marmita", label: "Marmita", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_marmita_3d.webp", keys: ["restaurante", "marmitaria", "marmita"] },
  { id: "pastel", label: "Pastel", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_pastel_3d.webp", keys: ["pasteis", "pastel"] },
  { id: "acai", label: "Açaí", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_acai_3d.webp", keys: ["acai"] },
  { id: "bebidas", label: "Bebidas", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_bebidas_3d.webp", keys: ["adegas", "adega", "bebidas"] },
  { id: "mercado", label: "Mercado", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_mercado_3d.webp", keys: ["mercado", "supermercado", "mercados"] },
  { id: "farmacias", label: "Farmácias", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_farmacia_3d.webp", keys: ["farmacias", "farmacia"] },
  { id: "churrasco", label: "Churrasco", icon: "https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_churrasco_3d.webp", keys: ["churrascaria", "churrasco"] },
];

const bucketOfCategoryKey = (key?: string | null): string | null => {
  if (!key) return null;
  const k = normalizeCategory(key);
  return CATEGORY_BUCKETS.find((b) => b.keys.includes(k))?.id || null;
};

const bucketOfStore = (store: any): string | null => bucketOfCategoryKey(store?.category);

// ── Faixas de horário (espelham o app): título, subtítulo e categorias da faixa.
type Daypart = { id: string; titulo: string; subtitulo: string; cats: string[] };
const DAYPARTS: Record<string, Daypart> = {
  madrugada: { id: "madrugada", titulo: "Aberto de madrugada", subtitulo: "Quem ainda está atendendo agora", cats: ["lanches", "bebidas", "farmacias"] },
  manha: { id: "manha", titulo: "Bom dia", subtitulo: "Para resolver o começo do dia", cats: ["mercado", "pastel", "farmacias"] },
  almoco: { id: "almoco", titulo: "O que pedir no almoço", subtitulo: "Pratos prontos perto de você", cats: ["marmita", "churrasco", "pastel"] },
  tarde: { id: "tarde", titulo: "Lanche da tarde", subtitulo: "Um docinho ou um salgado", cats: ["acai", "pastel", "lanches"] },
  noite: { id: "noite", titulo: "O que pedir hoje à noite", subtitulo: "Pratos prontos perto de você", cats: ["pizzaria", "lanches", "bebidas"] },
};

const currentDaypart = (): Daypart => {
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  if (minuteOfDay < 6 * 60) return DAYPARTS.madrugada;
  if (minuteOfDay < 10 * 60 + 30) return DAYPARTS.manha;
  if (minuteOfDay < 15 * 60) return DAYPARTS.almoco;
  if (minuteOfDay < 18 * 60) return DAYPARTS.tarde;
  return DAYPARTS.noite;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const effectivePrice = (p: any): number =>
  p?.promo_active && p?.promo_price != null ? Number(p.promo_price) : Number(p?.price || 0);

// Fora da seção "Preço acessível": bebidas não entram (mesma regra do app —
// lá o filtro é pela seção do produto; aqui somamos nome e categoria da loja).
const DRINK_NAME_RE = /coca|guaran|pepsi|fanta|suco|\bágua\b|agua mineral|cerveja|heineken|red bull|monster|energ[eé]tic|refrigerante|t[oô]nica|h2o|h2-o|matte|caldo de cana|tuba[ií]na|mineirinho|long neck|lata\b|vinho|whisky|vodka|cachaça|skol|brahma|ant[aá]rtica|imperio|império/i;
const DRINK_SECTION_RE = /bebida|refrigerante|cerveja|vinho|destilad|adega/i;

const isDrinkProduct = (p: any, storeBucket: string | null): boolean => {
  if (storeBucket === "bebidas") return true;
  if (p?.sectionName && DRINK_SECTION_RE.test(p.sectionName)) return true;
  return DRINK_NAME_RE.test(p?.name || "");
};

// Card de produto das faixas horizontais (horário, preço acessível, peça de novo).
const HomeProductCard = ({
  product,
  storeName,
  wide,
  onSelect,
}: {
  product: any;
  storeName: string;
  wide?: boolean;
  onSelect: () => void;
}) => {
  const promo = product.promo_active && product.promo_price != null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${wide ? "w-full" : "w-[138px] shrink-0"} text-left bg-card border border-border/60 rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform`}
    >
      {product.image_url ? (
        <img loading="lazy" decoding="async" src={product.image_url} alt="" className="w-full h-24 object-cover" />
      ) : (
        <div className="w-full h-24 bg-muted flex items-center justify-center">
          <StoreIcon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <div className="p-2.5">
        <p className="text-[13px] font-bold text-foreground leading-tight line-clamp-2 min-h-[32px]">{product.name}</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{storeName}</p>
        <p className="mt-1.5 text-[13px]">
          {promo && <span className="text-[11px] text-muted-foreground line-through mr-1">{formatBRL(Number(product.price))}</span>}
          <span className="font-extrabold text-primary">{formatBRL(effectivePrice(product))}</span>
        </p>
      </div>
    </button>
  );
};

const SectionHeader = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon,
  id,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  id?: string;
}) => (
  <div className="mb-3">
    <div className="flex items-center gap-2">
      {icon}
      <h2 id={id} className="font-display text-[19px] font-extrabold text-foreground tracking-tight min-w-0 truncate">
        {title}
      </h2>
      {subtitle && <span className="text-xs text-muted-foreground truncate hidden min-[420px]:inline">{subtitle}</span>}
      {actionLabel && (
        <button type="button" onClick={onAction} className="ml-auto shrink-0 text-[13px] font-bold text-primary">
          {actionLabel}
        </button>
      )}
    </div>
    {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5 min-[420px]:hidden">{subtitle}</p>}
  </div>
);

const ClientHomeContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const userLocation = useUserLocation();
  const [locationMode, setLocationMode] = useState<"saved" | "current">(() => {
    try {
      return localStorage.getItem("client:location_mode") === "current" ? "current" : "saved";
    } catch {
      return "saved";
    }
  });
  const [showLocationChooser, setShowLocationChooser] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [heroFilter, setHeroFilter] = useState<HeroFilter>(null);
  const [sortMode, setSortMode] = useState<SortMode>("padrao");
  const [sortOpen, setSortOpen] = useState(false);
  const [affordableExpanded, setAffordableExpanded] = useState(false);
  const [repeatExpanded, setRepeatExpanded] = useState(false);
  const [numberOverride, setNumberOverride] = useState<string | null>(() => {
    try { return localStorage.getItem("client:addr_number") || null; } catch { return null; }
  });
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberInput, setNumberInput] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("full_name, street, number, neighborhood, city, state, cep")
        .eq("user_id", user!.id)
        .maybeSingle();
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

  const activeCoords = locationMode === "current" ? userLocation.coords : null;
  const effectiveCity = locationMode === "current"
    ? userLocation.city?.trim() || null
    : profile?.city?.trim() || null;

  const { data: suggestedStores, isLoading: loadingStores } = useQuery({
    queryKey: ["available-stores", effectiveCity || "all", activeCoords?.lat, activeCoords?.lng, locationMode],
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
      const { data: allHolidays } = await (supabase as any)
        .from("store_holidays")
        .select("store_id, date, reason")
        .in("store_id", storeIds);
      return mapStoresWithHours(rows, allHours, activeCoords, effectiveCity, allHolidays);
    },
    enabled: true,
    // Vitrine depende de entregador online: cache curto + refetch ao voltar à tela.
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const { data: searchResults, isLoading: loadingSearchResults } = useQuery({
    queryKey: ["client-store-search", searchQuery, activeCoords?.lat, activeCoords?.lng, locationMode],
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
      const { data: allHolidays } = await (supabase as any)
        .from("store_holidays")
        .select("store_id, date, reason")
        .in("store_id", storeIds);
      return mapStoresWithHours(stores, allHours, activeCoords, effectiveCity, allHolidays);
    },
    enabled: searchQuery.length >= 2,
    staleTime: 1000 * 60,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const isStoresLoading = searchQuery.length >= 2 ? loadingSearchResults : loadingStores;
  const suggestedStoresEnriched = useBatchStoreDistances(suggestedStores || [], activeCoords);
  const searchResultsEnriched = useBatchStoreDistances(searchResults || [], activeCoords);

  const visibleStores = useMemo(() => {
    const base = searchQuery.length >= 2 ? searchResultsEnriched || [] : suggestedStoresEnriched || [];
    const categoryFiltered = activeCategory
      ? base.filter((s: any) => bucketOfStore(s) === activeCategory)
      : base;

    if (heroFilter === "direct_delivery") {
      return categoryFiltered.filter((s: any) => s.delivery_mode === "own");
    }
    if (heroFilter === "no_fee") {
      return categoryFiltered.filter((s: any) => formatFeeLabel(s).free);
    }

    return categoryFiltered;
  }, [searchQuery, searchResultsEnriched, suggestedStoresEnriched, activeCategory, heroFilter]);

  const lastStores = useMemo(() => {
    if (!recentOrders) return [];
    return Array.from(new Map(recentOrders.map((o: any) => [o.stores?.id, o.stores])).values())
      .filter(Boolean)
      .slice(0, 6);
  }, [recentOrders]);

  // "Peça de novo": produtos distintos dos pedidos concluídos, revalidados
  // no cardápio atual (só os ainda disponíveis) — mesma regra do app.
  const repeatProducts = useMemo(() => {
    if (!recentOrders) return [];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const order of recentOrders) {
      for (const item of order.order_items || []) {
        const p = item.products;
        if (!p || !p.is_available || seen.has(p.id)) continue;
        seen.add(p.id);
        out.push({
          ...p,
          storeName: order.stores?.name || "",
          storeSlug: order.stores?.slug || null,
        });
        if (out.length >= 12) return out;
      }
    }
    return out;
  }, [recentOrders]);

  const goToStore = (store: any, enforceArea = true) => {
    if (!store) return;
    if (enforceArea) {
      const preview = getStoreAccessPreview(store, activeCoords, effectiveCity);
      if (!preview.allowed) {
        if (preview.reason === "city") {
          toast.warning(`A entrega desta loja atende ${store.address_city || "outra cidade"}. Você ainda pode consultar o cardápio e verificar retirada.`);
        } else if (preview.distanceKm !== null) {
          toast.warning(`A entrega desta loja está fora do raio para o endereço selecionado (${preview.distanceKm.toFixed(1)} km). Você ainda pode consultar retirada.`);
        } else {
          toast.warning("A entrega desta loja pode não atender o endereço selecionado. Você ainda pode consultar retirada.");
        }
      }
    }
    if (store.slug) navigate(`/${store.slug}`);
    else if (store.id) navigate(`/loja/${store.id}`);
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

  const firstName = profile?.full_name?.split(" ")[0] || "Cliente";
  const hasSavedAddress = Boolean(profile?.street && profile?.number && profile?.neighborhood);
  const locationLabel = (() => {
    if (locationMode === "saved") {
      const street = profile?.street?.trim();
      const number = profile?.number?.trim() || "";
      if (street) return number ? `${street}, ${number}` : street;
      if (profile?.neighborhood) return profile.neighborhood;
      return profile?.city || "Cadastre um endereço";
    }
    const street = userLocation.street?.trim();
    const number = (numberOverride?.trim() || userLocation.number?.trim() || "");
    if (street) return number ? `${street}, ${number}` : street;
    if (userLocation.neighborhood) return userLocation.neighborhood;
    return userLocation.city || "Localização atual";
  })();

  const openNumberEditor = () => {
    setNumberInput(numberOverride || userLocation.number || "");
    setEditingNumber(true);
  };
  const chooseSavedAddress = () => {
    setLocationMode("saved");
    try { localStorage.setItem("client:location_mode", "saved"); } catch {}
    setShowLocationChooser(false);
    toast.success("Endereço salvo selecionado para a entrega.");
  };

  const chooseCurrentLocation = () => {
    setLocationMode("current");
    try { localStorage.setItem("client:location_mode", "current"); } catch {}
    setShowLocationChooser(false);
    userLocation.refresh();
  };

  const saveNumberOverride = () => {
    const clean = numberInput.trim().slice(0, 10);
    setNumberOverride(clean || null);
    try {
      if (clean) localStorage.setItem("client:addr_number", clean);
      else localStorage.removeItem("client:addr_number");
    } catch {}
    setEditingNumber(false);
    toast.success(clean ? `Número ajustado para ${clean}` : "Número removido");
  };

  const openStoreIds = useMemo(
    () => (suggestedStores || []).filter((s: any) => s.realIsOpen).map((s: any) => s.id),
    [suggestedStores]
  );
  const openStoresMap = useMemo(() => {
    const map = new Map<string, any>();
    (suggestedStores || []).forEach((s: any) => map.set(s.id, s));
    return map;
  }, [suggestedStores]);

  // Produtos das lojas ABERTAS da região: base das faixas do horário e do
  // preço acessível (mesma fonte, duas leituras — como no app).
  const { data: homeProducts } = useQuery({
    queryKey: ["home-products", openStoreIds.join(",")],
    queryFn: async () => {
      if (openStoreIds.length === 0) return [];
      const baseSelect = "id, name, price, promo_active, promo_price, image_url, store_id, is_available, is_bestseller";
      const withSection = await supabase
        .from("products")
        .select(`${baseSelect}, menu_sections(name)`)
        .in("store_id", openStoreIds)
        .eq("is_available", true)
        .not("image_url", "is", null)
        .limit(300);
      const rows = withSection.error
        ? (await supabase
            .from("products")
            .select(baseSelect)
            .in("store_id", openStoreIds)
            .eq("is_available", true)
            .not("image_url", "is", null)
            .limit(300)).data
        : withSection.data;
      return (rows || []).map((p: any) => ({
        ...p,
        sectionName: p.menu_sections?.name || null,
      }));
    },
    enabled: openStoreIds.length > 0 && !searchQuery,
    staleTime: 1000 * 60,
  });

  const daypart = useMemo(() => currentDaypart(), []);

  const daypartProducts = useMemo(() => {
    if (!homeProducts) return [];
    const inDaypart = homeProducts.filter((p: any) => {
      const store = openStoresMap.get(p.store_id);
      return store && daypart.cats.includes(bucketOfStore(store) || "");
    });
    // Best-sellers primeiro (regra do app); no máximo 3 por loja.
    const sorted = [...inDaypart].sort((a: any, b: any) => Number(b.is_bestseller || false) - Number(a.is_bestseller || false));
    const perStore = new Map<string, number>();
    const out: any[] = [];
    for (const p of sorted) {
      const n = perStore.get(p.store_id) || 0;
      if (n >= 3) continue;
      perStore.set(p.store_id, n + 1);
      out.push(p);
      if (out.length >= 10) break;
    }
    return out;
  }, [homeProducts, openStoresMap, daypart]);

  const affordableProducts = useMemo(() => {
    if (!homeProducts) return [];
    return homeProducts
      .filter((p: any) => {
        const store = openStoresMap.get(p.store_id);
        return store && !isDrinkProduct(p, bucketOfStore(store));
      })
      .sort((a: any, b: any) => effectivePrice(a) - effectivePrice(b))
      .slice(0, 16);
  }, [homeProducts, openStoresMap]);

  // Lojas com cupom ativo (mesma RPC pública do app).
  const { data: couponStores } = useQuery({
    queryKey: ["stores-with-coupons"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_stores_with_coupons");
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const exploreBuckets = useMemo(() => {
    const present = new Set<string>();
    (suggestedStores || []).forEach((s: any) => {
      const b = bucketOfStore(s);
      if (b) present.add(b);
    });
    return CATEGORY_BUCKETS.filter((b) => present.has(b.id));
  }, [suggestedStores]);

  const listStores = useMemo(() => {
    const all = [...(visibleStores || [])];
    if (sortMode === "taxa") {
      all.sort((a: any, b: any) => describeStoreFee(a).customerTotal - describeStoreFee(b).customerTotal);
    } else if (sortMode === "avaliacao") {
      all.sort((a: any, b: any) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sortMode === "abertas") {
      all.sort((a: any, b: any) => Number(b.realIsOpen || false) - Number(a.realIsOpen || false));
    }
    return all;
  }, [visibleStores, sortMode]);

  const formatDistance = (km?: number | null) => formatDistanceKm(km ?? null);

  const goToProductStore = (product: any) => {
    const store = openStoresMap.get(product.store_id);
    if (store) goToStore(store);
    else if (product.storeSlug) navigate(`/${product.storeSlug}`);
    else if (product.store_id) navigate(`/loja/${product.store_id}`);
  };

  const scrollToCoupons = useCallback(() => {
    const el = document.getElementById("cupons-h");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else toast("Nenhum cupom disponível no momento.");
  }, []);

  const couponValueLabel = (c: any): string => {
    const value = Number(c.discount_value) || 0;
    if (c.discount_type === "percentage") return `-${value}%`;
    if (c.discount_type === "free_delivery") return "Frete grátis";
    return `-${formatBRL(value)}`;
  };

  const activeBucketLabel = activeCategory
    ? CATEGORY_BUCKETS.find((b) => b.id === activeCategory)?.label
    : null;

  const SORT_OPTIONS: { id: SortMode; label: string }[] = [
    { id: "padrao", label: "Relevância" },
    { id: "abertas", label: "Abertas primeiro" },
    { id: "taxa", label: "Menor taxa" },
    { id: "avaliacao", label: "Melhor avaliadas" },
  ];

  return (
    <div className="min-h-dvh bg-background pb-24">
      {showLocationChooser && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="location-chooser-title">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="location-chooser-title" className="text-lg font-black text-foreground">Onde você quer receber?</h2>
                <p className="mt-1 text-xs text-muted-foreground">Escolha o endereço usado para encontrar lojas e calcular a entrega.</p>
              </div>
              <button onClick={() => setShowLocationChooser(false)} className="rounded-full px-2 py-1 text-xl leading-none text-muted-foreground hover:bg-muted" aria-label="Fechar seleção de endereço">×</button>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                onClick={chooseSavedAddress}
                disabled={!hasSavedAddress}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-black text-foreground">Usar endereço salvo</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{hasSavedAddress ? `${profile.street}, ${profile.number} — ${profile.city || "cidade não informada"}` : "Cadastre um endereço completo no seu perfil"}</span>
                </span>
              </button>

              <button
                onClick={chooseCurrentLocation}
                className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-black text-foreground">Usar localização atual</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Usaremos o GPS agora. Confira o endereço antes de confirmar o pedido.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho — mesmo formato do app: saudação, endereço e ações redondas */}
      <header className="px-4 pt-4 pb-1">
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-muted-foreground">{greeting()}, {firstName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <button
                onClick={() => setShowLocationChooser(true)}
                className="flex items-center gap-1 min-w-0 text-left active:opacity-70"
                aria-label="Selecionar endereço de entrega"
              >
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="font-display text-[15px] font-bold text-foreground truncate">
                  {locationLabel}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {userLocation.street && (
                <button
                  onClick={openNumberEditor}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Editar número do endereço"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={scrollToCoupons}
              className="w-[38px] h-[38px] rounded-full border border-border bg-card flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Meus cupons"
            >
              <Tag className="w-[18px] h-[18px] text-primary fill-primary" />
            </button>
            <button
              onClick={() => navigate("/carrinho")}
              className="relative w-[38px] h-[38px] rounded-full border border-border bg-card flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Abrir sacola"
            >
              <ShoppingBag className="w-[18px] h-[18px] text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center justify-center border-2 border-background">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 bg-muted rounded-2xl flex items-center px-3.5 gap-2 border border-transparent focus-within:border-primary transition-colors" data-tour="search">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={`Buscar em ${effectiveCity || "sua cidade"}`}
            aria-label="Pesquisar lojas"
            className="bg-transparent w-full py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </header>

      <main className="px-4 pt-2 space-y-7">
        {editingNumber && (
          <div
            className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center"
            onClick={() => setEditingNumber(false)}
          >
            <div
              className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="font-display text-base font-bold text-foreground">Número do endereço</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {userLocation.street}
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveNumberOverride(); }}
                placeholder={userLocation.number || "Ex: 345"}
                className="w-full px-3 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                O GPS nem sempre acerta o número exato. Ajuste aqui para os entregadores encontrarem você.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingNumber(false)}
                  className="flex-1 h-11 rounded-xl border border-border bg-background text-foreground text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveNumberOverride}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-primary/30"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Explorar — categorias com os ícones 3D do app */}
        {!searchQuery && suggestedStores && suggestedStores.length > 0 && exploreBuckets.length > 0 && (
          <section aria-labelledby="explorar-h">
            <h2 id="explorar-h" className="font-display text-[15px] font-extrabold text-foreground">
              Explorar
            </h2>
            <div className="w-[34px] h-[3px] rounded-full bg-primary mt-2" />
            <div className="flex overflow-x-auto gap-2.5 no-scrollbar -mx-4 px-4 mt-4" data-native-scroll-pan>
              <button
                type="button"
                onClick={() => { handleCategoryChange(null); scrollToStores(); }}
                className="w-[60px] shrink-0 flex flex-col items-center gap-[7px]"
                aria-pressed={activeCategory === null}
              >
                <span className={`w-[50px] h-[50px] rounded-full overflow-hidden bg-[#FFF8F3] ${activeCategory === null ? "border-[1.5px] border-primary" : "border border-border"}`}>
                  <img src="https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/store-assets/categorias/ic_cat_todos_3d.webp" alt="" className="w-full h-full object-cover" />
                </span>
                <span className={`text-xs ${activeCategory === null ? "text-primary font-semibold" : "text-foreground/80 font-medium"}`}>Todos</span>
              </button>
              {exploreBuckets.map((bucket) => {
                const selected = activeCategory === bucket.id;
                return (
                  <button
                    key={bucket.id}
                    type="button"
                    onClick={() => { handleCategoryChange(selected ? null : bucket.id); scrollToStores(); }}
                    className="w-[60px] shrink-0 flex flex-col items-center gap-[7px]"
                    aria-pressed={selected}
                  >
                    <span className={`w-[50px] h-[50px] rounded-full overflow-hidden bg-[#FFF8F3] ${selected ? "border-[1.5px] border-primary" : "border border-border"}`}>
                      <img loading="lazy" decoding="async" src={bucket.icon} alt="" className="w-full h-full object-cover" />
                    </span>
                    <span className={`text-xs ${selected ? "text-primary font-semibold" : "text-foreground/80 font-medium"}`}>{bucket.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Faixa do horário — pratos de lojas abertas, best-sellers primeiro */}
        {!searchQuery && daypartProducts.length >= 3 && (
          <section aria-labelledby="daypart-h">
            <SectionHeader
              id="daypart-h"
              title={daypart.titulo}
              subtitle={daypart.subtitulo}
              icon={<StoreIcon className="h-5 w-5 text-foreground shrink-0" />}
              actionLabel="Ver todas"
              onAction={() => { handleCategoryChange(daypart.cats[0]); scrollToStores(); }}
            />
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-4 px-4 pb-1" data-native-scroll-pan>
              {daypartProducts.map((p: any) => (
                <HomeProductCard
                  key={p.id}
                  product={p}
                  storeName={openStoresMap.get(p.store_id)?.name || ""}
                  onSelect={() => goToProductStore(p)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Suas lojas */}
        {!searchQuery && lastStores.length > 0 && (
          <section aria-labelledby="suas-lojas-h">
            <SectionHeader id="suas-lojas-h" title="Suas lojas" subtitle="compradas recentemente" />
            <div className="flex overflow-x-auto gap-3.5 no-scrollbar -mx-4 px-4 pb-1" data-native-scroll-pan>
              {lastStores.map((store: any) => (
                <div
                  key={store.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToStore(store)}
                  onKeyDown={(event) => handleStoreKeyDown(event, store)}
                  className="shrink-0 w-16 flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  {store.image_url ? (
                    <img loading="lazy" decoding="async" src={store.image_url}
                      className="w-14 h-14 rounded-full object-cover border border-border/60" alt={store.name} />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 border border-border/60 flex items-center justify-center">
                      <span className="font-display text-lg font-extrabold text-primary">{(store.name || "L").charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <p className="text-[11px] font-medium text-foreground/80 text-center truncate w-full leading-tight">
                    {store.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lojas com Cupom — banner sólido na cor da marca, como no app */}
        {!searchQuery && couponStores && couponStores.length > 0 && (
          <section aria-labelledby="cupons-h">
            <SectionHeader id="cupons-h" title="Lojas com Cupom" subtitle="Descontos exclusivos pra você" />
            <div className="space-y-3">
              {couponStores.map((c: any) => {
                const store = openStoresMap.get(c.store_id) || (suggestedStores || []).find((s: any) => s.id === c.store_id);
                return (
                  <button
                    key={`${c.store_id}-${c.coupon_code}`}
                    type="button"
                    onClick={() => (store ? goToStore(store) : navigate(`/loja/${c.store_id}`))}
                    className="w-full bg-primary rounded-3xl p-5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform shadow-lg shadow-primary/25"
                  >
                    <span className="min-w-0">
                      <span className="inline-block bg-white/25 text-white text-[10px] font-extrabold tracking-[0.14em] rounded-full px-2.5 py-1">
                        CUPOM
                      </span>
                      <span className="block text-white font-display text-[28px] leading-none font-black mt-2.5">
                        {couponValueLabel(c)}
                      </span>
                      <span className="block text-white font-bold text-[15px] mt-1 truncate">
                        {c.store_name}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 bg-white rounded-xl px-3.5 py-2.5 text-center">
                      <span className="block text-[9px] font-bold tracking-[0.12em] text-muted-foreground">USE O CUPOM</span>
                      <span className="block text-primary font-black text-[17px] leading-tight">{c.coupon_code}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Preço acessível — só comida, do menor preço pra cima */}
        {!searchQuery && affordableProducts.length >= 3 && (
          <section aria-labelledby="acessivel-h">
            <SectionHeader
              id="acessivel-h"
              title="Preço acessível"
              actionLabel={affordableProducts.length > 8 ? (affordableExpanded ? "Ver menos" : "Ver mais") : undefined}
              onAction={() => setAffordableExpanded((v) => !v)}
            />
            {affordableExpanded ? (
              <div className="grid grid-cols-2 gap-3">
                {affordableProducts.map((p: any) => (
                  <HomeProductCard
                    key={p.id}
                    product={p}
                    storeName={openStoresMap.get(p.store_id)?.name || ""}
                    wide
                    onSelect={() => goToProductStore(p)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-4 px-4 pb-1" data-native-scroll-pan>
                {affordableProducts.slice(0, 8).map((p: any) => (
                  <HomeProductCard
                    key={p.id}
                    product={p}
                    storeName={openStoresMap.get(p.store_id)?.name || ""}
                    onSelect={() => goToProductStore(p)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Peça de novo */}
        {!searchQuery && repeatProducts.length > 0 && (
          <section aria-labelledby="repete-h">
            <SectionHeader
              id="repete-h"
              title="Peça de novo"
              subtitle="produtos que você já pediu"
              actionLabel={repeatProducts.length > 8 ? (repeatExpanded ? "Ver menos" : "Ver mais") : undefined}
              onAction={() => setRepeatExpanded((v) => !v)}
            />
            {repeatExpanded ? (
              <div className="grid grid-cols-2 gap-3">
                {repeatProducts.map((p: any) => (
                  <HomeProductCard
                    key={p.id}
                    product={p}
                    storeName={p.storeName}
                    wide
                    onSelect={() => goToProductStore(p)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-4 px-4 pb-1" data-native-scroll-pan>
                {repeatProducts.slice(0, 8).map((p: any) => (
                  <HomeProductCard
                    key={p.id}
                    product={p}
                    storeName={p.storeName}
                    onSelect={() => goToProductStore(p)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Lista de lojas */}
        <section aria-labelledby="stores-h">
          <SectionHeader
            id="stores-h"
            title={
              searchQuery.length >= 2
                ? `Resultados para "${searchQuery}"`
                : heroFilter === "direct_delivery"
                ? "Lojas com entrega direta"
                : heroFilter === "no_fee"
                ? "Lojas sem taxa de serviço"
                : activeBucketLabel
                ? activeBucketLabel
                : effectiveCity
                ? `Lojas em ${effectiveCity}`
                : "Todas as lojas"
            }
            subtitle={`${visibleStores.length} ${visibleStores.length === 1 ? "loja" : "lojas"}`}
          />

          {!searchQuery && (
            <div className="flex items-center gap-2 mb-2 -mt-1">
              <button
                type="button"
                onClick={() => setHeroFilter(null)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-bold border transition-all ${heroFilter === null ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setHeroFilter(heroFilter === "no_fee" ? null : "no_fee")}
                className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-bold border transition-all ${heroFilter === "no_fee" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"}`}
              >
                Taxa grátis
              </button>
              <button
                type="button"
                onClick={() => setHeroFilter(heroFilter === "direct_delivery" ? null : "direct_delivery")}
                className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-bold border transition-all ${heroFilter === "direct_delivery" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"}`}
              >
                Entrega direta
              </button>
              <div className="relative ml-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setSortOpen((v) => !v)}
                  className="h-9 px-3.5 rounded-full text-xs font-bold border border-border bg-card text-foreground inline-flex items-center gap-1.5"
                  aria-expanded={sortOpen}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
                </button>
                {sortOpen && (
                  <>
                    <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setSortOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-2xl border border-border bg-card shadow-xl p-1.5">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { setSortMode(opt.id); setSortOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-foreground hover:bg-muted/60 text-left"
                        >
                          <span className="flex-1">{opt.label}</span>
                          {sortMode === opt.id && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {isStoresLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                    <div className="h-2.5 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : listStores.length === 0 ? (
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
                  : heroFilter === "no_fee"
                  ? "Nenhuma loja sem taxa de serviço no momento."
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
                            <span className="flex items-center gap-0.5 text-[12px] font-bold text-primary shrink-0 mt-0.5">
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              {rating.toFixed(1).replace(".", ",")}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground truncate capitalize mt-0.5">
                          {categoryLabel}
                          {dist ? ` • ${dist}` : ""}
                          {rating === null ? " • Novo" : ""}
                        </p>
                        {!getStoreAccessPreview(store, activeCoords, effectiveCity).allowed && (
                          <p className="mt-1 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                            Escolha um endereço compatível para pedir
                          </p>
                        )}
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
