import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, X, Clock, Star, Store as StoreIcon, ChevronRight, Flame, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/hooks/useUserLocation";
import { mapStoresWithHours } from "../utils/mapStores";
import { filterStoresWithOnlineDrivers } from "@/lib/storeVisibility";
import { formatBRL } from "@/lib/utils";
import { describeStoreFee } from "@/lib/deliveryFeeDisplay";
import BottomNav from "@/components/BottomNav";

const PUBLIC_STORE_SELECT_FULL = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, delivery_fee, delivery_fee_type, delivery_fee_base, delivery_fee_per_km, estimated_delivery_time, minimum_order_value, free_delivery_threshold, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings, platform_fee_split, created_at";
const PUBLIC_STORE_SELECT_VIEW = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, delivery_fee, estimated_delivery_time, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings, platform_fee_split, plan_type, platform_delivery_split_override, autonomy_lifetime_free, created_at";

const norm = (v?: string | null) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/**
 * Categorias visíveis na home de busca. Cada uma agrupa 1+ chaves reais
 * de `stores.category` normalizadas.
 */
const CATEGORIES: Array<{
  key: string;
  label: string;
  match: string[];
  gradient: string; // classes tailwind
  emoji: string;
}> = [
  { key: "lanches", label: "Lanches", match: ["lanchonete", "hamburgueria", "lanches"], gradient: "from-orange-500 to-amber-500", emoji: "🍔" },
  { key: "pizzaria", label: "Pizzaria", match: ["pizzaria", "pizza"], gradient: "from-rose-500 to-red-600", emoji: "🍕" },
  { key: "marmita", label: "Marmita", match: ["marmitaria", "restaurante", "comida caseira"], gradient: "from-amber-600 to-yellow-500", emoji: "🍱" },
  { key: "acai", label: "Açaí & Sobremesas", match: ["acai", "sorveteria", "doceria", "confeitaria"], gradient: "from-violet-600 to-fuchsia-600", emoji: "🍨" },
  { key: "bebidas", label: "Bebidas", match: ["adega", "bebidas"], gradient: "from-red-500 to-orange-500", emoji: "🍹" },
  { key: "mercado", label: "Mercado", match: ["mercado", "supermercado", "hortifruti"], gradient: "from-emerald-600 to-green-700", emoji: "🛒" },
  { key: "pastel", label: "Pastel & Salgados", match: ["pastel", "pasteis", "salgados"], gradient: "from-yellow-500 to-amber-600", emoji: "🥟" },
  { key: "churrasco", label: "Churrasco", match: ["churrascaria", "carnes"], gradient: "from-stone-700 to-neutral-800", emoji: "🥩" },
];

const matchesCategory = (storeCategory: string | null | undefined, catKey: string) => {
  const cat = CATEGORIES.find((c) => c.key === catKey);
  if (!cat) return false;
  const n = norm(storeCategory).replace(/\s+/g, "_");
  return cat.match.some((m) => n === m || n.startsWith(m) || n.includes(m));
};

const formatFeeLabel = (store: any): { label: string; free: boolean; prefix?: string } => {
  const d = describeStoreFee(store);
  return { label: d.label, free: d.free, prefix: d.prefix };
};

const formatDeliveryTime = (store: any): string => {
  const raw = (store?.estimated_delivery_time || "").toString().trim();
  if (raw) return raw.includes("min") ? raw : `${raw} min`;
  const km = typeof store.distanceKm === "number" ? store.distanceKm : null;
  if (km === null) return "30-45 min";
  const base = 20 + Math.round(km * 4);
  return `${base}-${base + 15} min`;
};

const RECENT_KEY = "itasuper:busca:recent";
const loadRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5); } catch { return []; }
};
const saveRecent = (term: string) => {
  const t = term.trim();
  if (!t) return;
  const cur = loadRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
  const next = [t, ...cur].slice(0, 5);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* noop */ }
};

const useDebounced = (value: string, delay = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const StoreRow = ({ store, onClick, badge }: { store: any; onClick: () => void; badge?: string }) => {
  const isOpen = !!store.realIsOpen;
  const rating = typeof store.rating === "number" && store.rating > 0 ? Number(store.rating) : null;
  const fee = formatFeeLabel(store);
  const timeLabel = formatDeliveryTime(store);
  const categoryLabel = (store.category || "Loja").replace(/_/g, " ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-opacity"
    >
      {store.image_url ? (
        <img
          loading="lazy" decoding="async" src={store.image_url} alt={store.name}
          className={`w-16 h-16 rounded-2xl object-cover border border-border/50 shrink-0 ${isOpen ? "" : "grayscale opacity-60"}`}
        />
      ) : (
        <div className={`w-16 h-16 rounded-2xl bg-muted flex items-center justify-center shrink-0 ${isOpen ? "" : "opacity-60"}`}>
          <StoreIcon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {badge && (
          <span className="inline-block text-[10px] font-black tracking-wider uppercase text-primary mb-0.5">
            {badge}
          </span>
        )}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-bold text-foreground truncate leading-tight">{store.name}</p>
          {rating !== null && (
            <span className="flex items-center gap-0.5 text-[12px] font-bold text-amber-600 shrink-0 mt-0.5">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground truncate capitalize mt-0.5">
          {categoryLabel}{rating === null ? " • Novo" : ""}
        </p>
        <div className="flex items-center gap-1.5 mt-1 text-[12px]">
          <span className="text-muted-foreground">{timeLabel}</span>
          <span className="text-muted-foreground/50">•</span>
          {fee.prefix && <span className="text-muted-foreground">{fee.prefix}</span>}
          <span className={fee.free ? "font-bold text-emerald-600" : "font-semibold text-foreground"}>
            {fee.label}
          </span>
        </div>
        {!isOpen && (
          <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-black tracking-wider rounded bg-rose-100 text-rose-700">
            FECHADA
          </span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
    </button>
  );
};

const ClientBuscaPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const userLocation = useUserLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const initialCat = searchParams.get("cat") || null;
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCat);
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebounced(term, 250);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());

  useEffect(() => {
    if (activeCategory) setSearchParams({ cat: activeCategory }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [activeCategory, setSearchParams]);

  const { data: allStores, isLoading } = useQuery({
    queryKey: ["busca-all-stores", userLocation.coords?.lat, userLocation.coords?.lng],
    queryFn: async () => {
      const includeTest = !!user?.email?.endsWith("@itasuper.test");
      const table = includeTest ? "stores" : "stores_public";
      const select = includeTest ? PUBLIC_STORE_SELECT_FULL : PUBLIC_STORE_SELECT_VIEW;
      const { data, error } = await (supabase as any)
        .from(table)
        .select(select)
        .eq("status", "ativo")
        .limit(100);
      if (error) throw error;
      const rows = await filterStoresWithOnlineDrivers(Array.isArray(data) ? data : []);
      if (rows.length === 0) return [];
      const storeIds = rows.map((s: any) => s.id);
      const { data: allHours } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", storeIds);
      return mapStoresWithHours(rows, allHours, userLocation.coords, userLocation.city);
    },
    staleTime: 1000 * 60,
  });

  const stores = allStores || [];

  const searchMode = debouncedTerm.trim().length >= 2;

  const searchResults = useMemo(() => {
    if (!searchMode) return [];
    const q = norm(debouncedTerm);
    return stores.filter((s: any) => {
      const n = norm(s.name);
      const c = norm(s.category);
      return n.includes(q) || c.includes(q);
    });
  }, [stores, debouncedTerm, searchMode]);

  const categoryStores = useMemo(() => {
    if (!activeCategory) return [];
    return stores.filter((s: any) => matchesCategory(s.category, activeCategory));
  }, [stores, activeCategory]);

  const emAlta = useMemo(() => {
    return [...stores]
      .filter((s: any) => s.realIsOpen && s.image_url)
      .sort((a: any, b: any) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 8);
  }, [stores]);

  const novidades = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return stores
      .filter((s: any) => s.created_at && new Date(s.created_at).getTime() > cutoff)
      .slice(0, 8);
  }, [stores]);

  const activeCategoryMeta = CATEGORIES.find((c) => c.key === activeCategory);

  const goToStore = useCallback((store: any) => {
    if (store?.slug) navigate(`/${store.slug}`);
    else if (store?.id) navigate(`/loja/${store.id}`);
  }, [navigate]);

  const handleSubmitSearch = () => {
    if (term.trim()) {
      saveRecent(term);
      setRecent(loadRecent());
    }
  };

  const showResultsMode = searchMode || !!activeCategory;
  const resultList = searchMode ? searchResults : categoryStores;

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-3 py-2.5 flex items-center gap-2">
          {(activeCategory || searchMode) && (
            <button
              type="button"
              onClick={() => { setActiveCategory(null); setTerm(""); }}
              className="p-2 -ml-1 rounded-xl hover:bg-muted/60 active:scale-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          <div className="flex-1 bg-muted rounded-xl flex items-center px-3 gap-2 border border-transparent focus-within:border-primary transition-colors">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmitSearch(); }}
              placeholder={activeCategoryMeta ? `Buscar em ${activeCategoryMeta.label}...` : "Buscar loja, prato ou categoria..."}
              className="bg-transparent w-full py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label="Buscar"
            />
            {term && (
              <button type="button" onClick={() => setTerm("")} className="p-1 -mr-1" aria-label="Limpar">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        {activeCategoryMeta && !searchMode && (
          <div className="px-4 pb-2 -mt-1">
            <h1 className="font-display text-lg font-bold text-foreground capitalize">
              {activeCategoryMeta.emoji} {activeCategoryMeta.label}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {categoryStores.length} {categoryStores.length === 1 ? "loja" : "lojas"} na sua região
            </p>
          </div>
        )}
      </header>

      <main className="px-4 pt-4 space-y-6">
        {/* Modo lista (categoria ou busca) */}
        {showResultsMode ? (
          <section>
            {isLoading ? (
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
            ) : resultList.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <StoreIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {searchMode
                    ? `Nada encontrado para "${debouncedTerm}"`
                    : "Nenhuma loja nesta categoria por aqui."}
                </p>
                <button
                  type="button"
                  onClick={() => { setActiveCategory(null); setTerm(""); }}
                  className="text-xs font-bold text-primary mt-3"
                >
                  Ver todas as categorias
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {resultList.map((s: any, i: number) => (
                  <li key={s.id}>
                    <StoreRow
                      store={s}
                      badge={!searchMode && i < 3 ? "Mais pedido" : undefined}
                      onClick={() => goToStore(s)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            {/* Buscas recentes */}
            {recent.length > 0 && (
              <section>
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Recentes
                </h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setTerm(r); inputRef.current?.focus(); }}
                      className="h-8 px-3 rounded-full bg-muted text-xs font-semibold text-foreground border border-border/60 active:scale-95"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Categorias */}
            <section>
              <h2 className="font-display text-base font-bold text-foreground mb-3">Categorias</h2>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setActiveCategory(c.key)}
                    className={`relative overflow-hidden rounded-2xl h-24 p-3 text-left bg-gradient-to-br ${c.gradient} text-white shadow-md active:scale-[0.97] transition-transform`}
                  >
                    <span className="font-display font-bold text-sm leading-tight relative z-10 drop-shadow-sm">
                      {c.label}
                    </span>
                    <span className="absolute -right-1 -bottom-2 text-5xl opacity-80 select-none">
                      {c.emoji}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Em alta */}
            {emAlta.length > 0 && (
              <section>
                <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-primary" /> Em alta {userLocation.city ? `em ${userLocation.city}` : ""}
                </h2>
                <div className="-mx-4 px-4 flex overflow-x-auto gap-3 no-scrollbar pb-1" data-native-scroll-pan>
                  {emAlta.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToStore(s)}
                      className="shrink-0 w-32 text-left active:opacity-70"
                    >
                      {s.image_url ? (
                        <img
                          loading="lazy" decoding="async" src={s.image_url} alt={s.name}
                          className="w-32 h-32 rounded-2xl object-cover border border-border/50"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-2xl bg-muted flex items-center justify-center">
                          <StoreIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="mt-2 text-[13px] font-bold text-foreground truncate">{s.name}</p>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {typeof s.rating === "number" && s.rating > 0 ? (
                          <>
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            <span className="font-semibold text-amber-600">{Number(s.rating).toFixed(1)}</span>
                            <span>•</span>
                          </>
                        ) : null}
                        <span className="truncate">{formatDeliveryTime(s)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Novidades */}
            {novidades.length > 0 && (
              <section>
                <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" /> Novidades
                </h2>
                <ul className="divide-y divide-border/50">
                  {novidades.map((s: any) => (
                    <li key={s.id}>
                      <StoreRow store={s} onClick={() => goToStore(s)} badge="Novo" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default ClientBuscaPage;