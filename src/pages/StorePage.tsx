import { formatBRL } from "@/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import PizzaHalfHalfModal from "@/components/PizzaHalfHalfModal";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartAddon } from "@/contexts/CartContext";
import { Star, Clock, ChevronRight, ChevronDown, ChevronUp, MapPin, Search, X, Navigation, CreditCard, Banknote, Smartphone, QrCode, RotateCcw, TrendingUp, ArrowLeft, Bike, Timer, Wallet } from "lucide-react";
import LoyaltyBanner from "@/components/LoyaltyBanner";
import { toast } from "sonner";
import { useRef, useState, useEffect, memo, useCallback, useMemo } from "react";
import CartFAB from "@/components/CartFAB";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductDetailModal from "@/components/ProductDetailModal";
import AgeGateModal from "@/components/AgeGateModal";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreContext } from "@/contexts/StoreContext";
import { useStorePlan } from "@/hooks/useStorePlan";
import { getStoreAppSlug } from "@/components/StoreAppGuard";
import { checkStoreAccess, MAX_DISTANCE_KM } from "@/lib/fraudCheck";

interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  section_id: string | null;
  metadata?: Record<string, any>;
}

interface MenuSection {
  id: string;
  name: string;
  sort_order: number;
}

const getPageScrollElement = (): HTMLElement => {
  const root = document.getElementById("root");
  if (root && (document.body.classList.contains("native-app") || document.documentElement.classList.contains("native-app"))) {
    return root;
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
};

const isDocumentScrollElement = (element: HTMLElement) =>
  element === document.documentElement || element === document.body || element === document.scrollingElement;

const StorePage = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { setCurrentStore } = useStoreContext();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==== Adega: filtros e ordenação ====
  const [adegaType, setAdegaType] = useState<string | null>(null);
  const [adegaSort, setAdegaSort] = useState<"default" | "price-asc" | "price-desc">("default");

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);
  const [showSearch, setShowSearch] = useState(false);
  const [showHours, setShowHours] = useState(false);
   const [showHalfHalf, setShowHalfHalf] = useState(false);
   const [scrolled, setScrolled] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pageRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [fraudBlock, setFraudBlock] = useState<{ distanceKm: number; storeCity: string | null } | null>(null);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", id || slug],
    queryFn: async () => {
      let query = supabase.from("stores_public").select("id, name, slug, image_url, category, rating, is_open, force_closed, status, delivery_mode, own_delivery_fee, delivery_fee, minimum_order_value, estimated_delivery_time, owner_id, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings").in("status", ["ativo", "bloqueado"]);
      if (id) query = query.eq("id", id);
      else if (slug) query = query.eq("slug", slug);
      const { data, error } = await query.maybeSingle();
      if (data) return data;

      const { data: publicData, error: publicError } = await supabase.functions.invoke("public-store-catalog", {
        body: {
          store_id: id,
          slug,
          limit: 1,
          fallback_to_all: false,
          include_blocked: true,
        },
      });

      if (publicError) throw publicError;

      const publicStore = Array.isArray(publicData?.stores) ? publicData.stores[0] : null;
      if (publicStore) return publicStore;
      if (error) throw error;
      return null;
    },
    enabled: !!(id || slug),
    staleTime: 1000 * 60 * 3,
  });

  // Set store context when accessed via slug (client mode)
  useEffect(() => {
    if (store && slug) {
      setCurrentStore(store.id, (store as any).slug || slug, store.name);
    }
  }, [store, slug, setCurrentStore]);

  // Dynamic OG meta tags for social sharing (WhatsApp, Facebook, etc.)
  useEffect(() => {
    if (!store) return;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    const twImage = document.querySelector('meta[name="twitter:image"]');

    const title = `${store.name} - ItaSuper`;
    const desc = `Peça pelo ItaSuper: ${store.name} - ${store.category}. Entrega rápida!`;
    const img = store.image_url || "";

    document.title = title;
    if (ogTitle) ogTitle.setAttribute("content", title);
    if (ogDesc) ogDesc.setAttribute("content", desc);
    if (ogImage && img) ogImage.setAttribute("content", img);
    if (twTitle) twTitle.setAttribute("content", title);
    if (twDesc) twDesc.setAttribute("content", desc);
    if (twImage && img) twImage.setAttribute("content", img);
  }, [store]);

  const storeId = store?.id || id;
   const storePlan = useStorePlan(storeId);

   // Track scroll to show name in header
   useEffect(() => {
     let ticking = false;
     const handleScroll = () => {
       if (ticking) return;
       ticking = true;
       window.requestAnimationFrame(() => {
         const isScrolled = window.scrollY > 150;
         setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));
         ticking = false;
       });
     };

     window.addEventListener("scroll", handleScroll, { passive: true });
     return () => window.removeEventListener("scroll", handleScroll);
   }, []);

  const { data: storeHours } = useQuery({
    queryKey: ["store-hours", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("opening_hours").select("*").eq("store_id", storeId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ["store-owner", store?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("whatsapp_number")
        .eq("user_id", store!.owner_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!store?.owner_id,
    staleTime: 1000 * 60 * 10,
  });

  const { data: sections } = useQuery({
    queryKey: ["menu-sections", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_sections")
        .select("*")
        .eq("store_id", storeId!)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as MenuSection[];
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId!)
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 3,
  });

  // "Peça de novo" - products user has ordered before from this store
  const { data: reorderProducts } = useQuery({
    queryKey: ["reorder-products", storeId, user?.id],
    queryFn: async () => {
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("product_id, quantity, orders!inner(store_id, client_id, status)")
        .eq("orders.store_id", storeId!)
        .eq("orders.client_id", user!.id)
        .in("orders.status", ["entregue", "finalizado"])
        .limit(300);
      if (error) throw error;
      const countMap: Record<string, number> = {};
      (orderItems || []).forEach((item: any) => {
        countMap[item.product_id] = (countMap[item.product_id] || 0) + item.quantity;
      });
      return Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pid]) => pid);
    },
    enabled: !!storeId && !!user?.id,
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });

  // "Mais pedidos" - most popular products in this store (all users)
  const { data: popularProducts } = useQuery({
    queryKey: ["popular-products", storeId],
    queryFn: async () => {
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("product_id, quantity, orders!inner(store_id, status)")
        .eq("orders.store_id", storeId!)
        .in("orders.status", ["entregue", "finalizado"])
        .limit(500);
      if (error) throw error;
      const countMap: Record<string, number> = {};
      (orderItems || []).forEach((item: any) => {
        countMap[item.product_id] = (countMap[item.product_id] || 0) + item.quantity;
      });
      return Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([pid, count]) => ({ productId: pid, count }));
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });

  const isSuspended = store?.status === "bloqueado";

  // Verificar se tem driver online (apenas para lojas com motoboy próprio)
  const isOwnDeliveryStore = (store as any)?.delivery_mode === "own";
  const { data: onlineDriversCount = 0 } = useQuery({
    queryKey: ["store-online-drivers", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "store_active_drivers_count" as any,
        { _store_id: store!.id } as any
      );
      if (error) return 0;
      return (data as number) || 0;
    },
    enabled: !!store?.id && isOwnDeliveryStore,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Loja own sem nenhum driver vinculado = sem entrega disponível
  const hasNoDrivers = isOwnDeliveryStore && onlineDriversCount === 0;

  const storeStatus = store
    ? getStoreOpenStatus(
        (storeHours as any as OpeningHour[]) || [],
        (store as any).force_closed || false,
        store.is_open
      )
    : { isOpen: false, reason: "" };

  // Suspended stores are always "closed"
  if (isSuspended) {
    storeStatus.isOpen = false;
    storeStatus.reason = "Loja temporariamente fechada";
  }

  // Antifraude: bloqueia acesso quando GPS está muito longe da loja
  useEffect(() => {
    if (!store) return;
    const lat = (store as any).latitude;
    const lng = (store as any).longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    let cancelled = false;
    checkStoreAccess({
      storeId: store.id,
      storeName: store.name,
      storeCity: (store as any).address_city ?? null,
      storeLat: lat,
      storeLng: lng,
    }).then((res) => {
      if (cancelled) return;
      if (!res.allowed && typeof res.distanceKm === "number") {
        setFraudBlock({ distanceKm: res.distanceKm, storeCity: (store as any).address_city ?? null });
      } else {
        setFraudBlock(null);
      }
    });
    return () => { cancelled = true; };
  }, [store]);

  const hasConfiguredHours = Array.isArray(storeHours) && storeHours.length > 0;
  const statusLabel = hasConfiguredHours
    ? `${storeStatus.reason || (storeStatus.isOpen ? "Aberto" : "Fechado")}`
    : "Horário não informado";

  const reorderProductsList = useMemo(
    () => products?.filter((p) => reorderProducts?.includes(p.id)) || [],
    [products, reorderProducts]
  );
  const popularProductsList = useMemo(
    () =>
      (popularProducts
        ?.map((pp) => {
          const product = products?.find((p) => p.id === pp.productId);
          return product ? { ...product, orderCount: pp.count } : null;
        })
        .filter(Boolean) as (Product & { orderCount: number })[]) || [],
    [popularProducts, products]
  );

  const sectionProductsMap = useMemo(() => {
    const map: Record<string, Product[]> = {};
    sections?.forEach((section) => {
      map[section.id] = [];
    });
    products?.forEach((product) => {
      if (product.section_id && map[product.section_id]) {
        map[product.section_id].push(product);
      }
    });
    return map;
  }, [sections, products]);

  const visibleSections = useMemo(
    () => (sections || []).filter((section) => (sectionProductsMap[section.id]?.length || 0) > 0),
    [sections, sectionProductsMap]
  );

  useEffect(() => {
    if (visibleSections.length > 0 && !activeSection) {
      setActiveSection(visibleSections[0].id);
    }
  }, [visibleSections, activeSection]);

  // Auto-update active section based on scroll position
  useEffect(() => {
    if (visibleSections.length === 0) return;

    const scrollElement = getPageScrollElement();
    const isWindow = scrollElement === document.documentElement || scrollElement === document.body || scrollElement === document.scrollingElement;

    const observer = new IntersectionObserver(
      (entries) => {
        // Encontra a seção que está mais próxima do topo da viewport (respeitando a margem do cabeçalho)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            // Preferimos a que está mais próxima do topo
            return Math.abs(a.boundingClientRect.top - 100) - Math.abs(b.boundingClientRect.top - 100);
          });

        if (visible.length > 0) {
          const id = visible[0].target.getAttribute("data-section-id");
          if (id) setActiveSection(id);
        }
      },
      {
        root: isWindow ? null : scrollElement,
        // Ajustamos a margem para detectar melhor quando o título da seção chega no topo
        rootMargin: "-120px 0px -70% 0px",
        threshold: [0, 0.1, 0.5]
      }
    );

    visibleSections.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visibleSections]);
 
   // Scroll active category chip into view in the sticky nav
   useEffect(() => {
     if (!activeSection || !navRef.current) return;
     const chip = navRef.current.querySelector<HTMLElement>(
       `[data-chip-id="${activeSection}"]`
     );
     if (chip) {
       chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
     }
   }, [activeSection]);
 
  const scrollToSection = useCallback((sectionId: string) => {
    window.requestAnimationFrame(() => {
      const target = sectionRefs.current[sectionId] || document.getElementById(`menu-section-${sectionId}`);
      if (!target) return;

      const scrollElement = getPageScrollElement();
      const isWindow = scrollElement === document.documentElement || scrollElement === document.body || scrollElement === document.scrollingElement;
      
      const navHeight = navRef.current?.offsetHeight || 60;
      const extraGap = 16;
      
      const currentScrollTop = isWindow ? window.pageYOffset : scrollElement.scrollTop;
      const containerTop = isWindow ? 0 : scrollElement.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top - containerTop + currentScrollTop;
      const finalPosition = Math.max(targetTop - navHeight - extraGap, 0);

      setActiveSection(sectionId);

      if (isWindow) {
        window.scrollTo({
          top: finalPosition,
          behavior: "smooth"
        });
      } else {
        scrollElement.scrollTo({
          top: finalPosition,
          behavior: "smooth"
        });
      }
    });
  }, []);

  const productsBySection = useCallback(
    (sectionId: string | null) => sectionId ? sectionProductsMap[sectionId] || [] : [],
    [sectionProductsMap]
  );

  const isAdega = store?.category === "adegas";

  // Aplica filtro/ordenação de adega em qualquer lista de produtos
  const applyAdegaFilters = useCallback((list: Product[]): Product[] => {
    if (!isAdega) return list;
    let out = list;
    if (adegaType) {
      out = out.filter((p) => (p.metadata as any)?.drink_type === adegaType);
    }
    if (adegaSort === "price-asc") {
      out = [...out].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (adegaSort === "price-desc") {
      out = [...out].sort((a, b) => Number(b.price) - Number(a.price));
    }
    return out;
  }, [isAdega, adegaType, adegaSort]);

  // Tipos disponíveis no catálogo (apenas adega)
  const availableDrinkTypes = useMemo(() => {
    if (!isAdega || !products) return [] as string[];
    const set = new Set<string>();
    for (const p of products) {
      const t = (p.metadata as any)?.drink_type;
      if (t) set.add(t);
    }
    return Array.from(set);
  }, [isAdega, products]);

  const unsectionedProducts = useMemo(
    () => applyAdegaFilters(products?.filter((p) => !p.section_id) || []),
    [products, applyAdegaFilters]
  );

  // Search filter
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return null;
    const base =
      products?.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      ) || [];
    return applyAdegaFilters(base);
  }, [products, debouncedSearch, applyAdegaFilters]);

  const handleAddToCart = (
    product: Product,
    addons: CartAddon[],
    observations: string,
    quantity: number,
    unitPrice: number
  ) => {
    if (!storeStatus.isOpen) {
      toast.error(`Esta loja está fechada. ${storeStatus.reason}`);
      return;
    }
    if (hasNoDrivers) {
      toast.error("Esta loja não tem entregador disponível no momento.");
      return;
    }
    if ((product as any)?.metadata?.out_of_stock) {
      toast.error("Produto esgotado");
      return;
    }
    addItem(
      {
        id: product.id,
        store_id: product.store_id,
        store_name: store?.name || "",
        name: product.name,
        price: unitPrice,
        basePrice: product.price,
        image_url: product.image_url,
        addons,
        observations,
      },
      quantity
    );
    toast.success(`${quantity}x ${product.name} adicionado!`);
  };

  const openProduct = useCallback((product: Product) => {
    // Allow opening modal even when closed/out-of-stock (for browsing).
    // The "Add to cart" button inside the modal already validates.
    setSelectedProduct(product);
  }, []);

  const openMaps = useCallback(() => {
    if (!store) return;
    const addr = encodeURIComponent(
      [store.address_street, store.address_number, store.address_neighborhood, store.address_city, store.address_state]
        .filter(Boolean)
        .join(", ")
    );
    const url = `https://www.google.com/maps/search/?api=1&query=${addr}`;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = url;
    }
  }, [store]);

  const totalProducts = products?.length || 0;

  if (!storeLoading && !store && (id || slug)) {
    // Acessou via slug e não existe → tratar como rota inválida (evita catch-all confuso)
    if (slug && !id) {
      return <NotFound />;
    }
    // Acessou via id real (link de loja) → loja realmente indisponível
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <span className="text-5xl mb-4">🔒</span>
        <h1 className="text-xl font-bold text-foreground mb-2">Loja indisponível</h1>
        <p className="text-sm text-muted-foreground mb-6">Esta loja não está ativa no momento.</p>
        <button
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground rounded-2xl py-3 px-6 font-semibold hover:bg-primary/90 transition-colors"
        >
          Ver outras lojas
        </button>
      </div>
    );
  }

  if (fraudBlock) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <span className="text-5xl mb-4">📍</span>
        <h1 className="text-xl font-bold text-foreground mb-2">Loja fora da sua área</h1>
        <p className="text-sm text-muted-foreground mb-2">
          Esta loja está a aproximadamente <span className="font-bold text-foreground">{fraudBlock.distanceKm.toFixed(1)} km</span> de você
          {fraudBlock.storeCity ? <> em <span className="font-bold">{fraudBlock.storeCity}</span></> : null}.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Por segurança, só permitimos pedidos a até {MAX_DISTANCE_KM} km da loja.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground rounded-2xl py-3 px-6 font-semibold hover:bg-primary/90 transition-colors"
        >
          Ver lojas próximas
        </button>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-background pb-24">
      {/* ===== HERO ===== */}
      <div className="relative h-56 md:h-64">
        {store?.image_url ? (
             <img
               src={store.image_url}
               alt={store.name}
               className={`w-full h-full object-cover ${!storeStatus.isOpen ? "grayscale brightness-75" : ""}`}
               loading="eager"
               decoding="async"
               fetchPriority="high"
             />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 ${!storeStatus.isOpen ? "grayscale" : ""}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

         {/* Sticky Header Top Bar */}
         {!showHalfHalf && (
           <div className={`fixed top-0 left-0 right-0 flex items-center justify-between p-4 z-[70] transition-all duration-300 h-[64px] ${
             scrolled ? "bg-background border-b border-border shadow-sm py-2" : "bg-transparent"
           }`}>
          <div className="flex items-center gap-3 min-w-0">
            {!getStoreAppSlug() && (
              <button
                onClick={() => navigate("/cliente")}
               aria-label="Voltar"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  scrolled ? "bg-muted text-foreground" : "bg-card/90 backdrop-blur-md shadow-lg border border-border/50 text-foreground"
                }`}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            {scrolled && (
              <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <h2 className="text-sm font-black text-foreground truncate">{store?.name}</h2>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${storeStatus.isOpen ? "bg-green-500" : "bg-destructive"}`} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{storeStatus.isOpen ? "Aberto" : "Fechado"}</span>
                </div>
              </div>
            )}
           </div>
           <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              aria-label="Buscar produtos"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                scrolled ? "bg-muted text-foreground" : "bg-card/90 backdrop-blur-md shadow-lg border border-border/50 text-foreground"
              }`}
            >
              <Search className="h-4 w-4" />
            </button>
            {ownerProfile?.whatsapp_number && (
              <WhatsAppButton
                number={ownerProfile.whatsapp_number}
                message={`Olá! Estou vendo o cardápio da ${store?.name} no ItaSuper.`}
                label=""
                size="sm"
              />
            )}
           </div>
         </div>
         )}
      </div>

      {/* ===== STORE INFO ===== */}
      <div className="relative -mt-12 mx-4 z-10">
        <div className="bg-card rounded-2xl border border-border shadow-xl overflow-visible">
          <div className="p-5 pb-0 relative">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="w-[100px] h-[100px] rounded-full bg-card border-[4px] border-card shadow-2xl flex-shrink-0 overflow-hidden -mt-[70px] relative z-[55] mx-auto sm:mx-0">
                {store?.image_url ? (
                  <img loading="lazy" decoding="async" src={store.image_url} alt={store?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-3xl">🍽️</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col pt-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-black text-foreground break-words leading-tight mt-1 sm:mt-0">{store?.name}</h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider bg-muted/80 px-2.5 py-1 rounded-md border border-border/50">
                    {store?.category}
                  </span>
                  {store?.rating && store.rating > 0 && (
                    <div className="flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">{store.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {hasConfiguredHours && (
              <div className="mt-4 flex justify-center sm:justify-start">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full border ${
                  storeStatus.isOpen
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${storeStatus.isOpen ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
                  {statusLabel}
                </span>
              </div>
            )}

            {/* Address + Maps button */}
            {store?.address_neighborhood && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 w-7 h-7 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Endereço</p>
                      <p className="text-[11px] text-foreground font-medium leading-relaxed truncate">
                        {[store.address_street, store.address_number, store.address_neighborhood, store.address_city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openMaps(); }}
                    aria-label="Abrir endereço no Google Maps"
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-primary/90 transition-all shadow-sm flex-shrink-0"
                  >
                    <Navigation className="h-3 w-3" />
                    MAPS
                  </button>
                </div>
              </div>
            )}

            {/* Delivery info row: taxa, tempo, pedido mínimo */}
            {((store as any)?.own_delivery_fee != null ||
              (store as any)?.delivery_fee != null ||
              (store as any)?.estimated_delivery_time ||
              (store as any)?.minimum_order_value) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="bg-muted/30 rounded-xl p-2.5 border border-border/30 flex flex-col items-center text-center">
                  <Bike className="h-3.5 w-3.5 text-primary mb-1" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Taxa</span>
                  <span className="text-[11px] font-black text-foreground mt-0.5">
                    {(() => {
                      const mode = (store as any)?.delivery_mode;
                      // Para entrega própria: taxa do lojista + R$2 da plataforma
                      // Para entrega da plataforma: delivery_fee já é o total (inclui splits)
                      const baseFee = mode === "own"
                        ? (store as any)?.own_delivery_fee
                        : (store as any)?.delivery_fee;
                      if (baseFee == null) return "—";
                      const platformAdd = mode === "own" ? 2 : 0;
                      const total = Number(baseFee) + platformAdd;
                      return total === 0 ? "Grátis" : `A partir de ${formatBRL(total)}`;
                    })()}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-xl p-2.5 border border-border/30 flex flex-col items-center text-center">
                  <Timer className="h-3.5 w-3.5 text-primary mb-1" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Tempo</span>
                  <span className="text-[11px] font-black text-foreground mt-0.5">
                    {(store as any)?.estimated_delivery_time || "—"}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-xl p-2.5 border border-border/30 flex flex-col items-center text-center">
                  <Wallet className="h-3.5 w-3.5 text-primary mb-1" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Pedido mín.</span>
                  <span className="text-[11px] font-black text-foreground mt-0.5">
                    {(store as any)?.minimum_order_value
                      ? formatBRL(Number((store as any).minimum_order_value))
                      : "—"}
                  </span>
                </div>
              </div>
            )}

            {/* Info Tabs / Expandables */}
            <div className="mt-4 space-y-2 pb-4">
              {/* Opening Hours */}
              <div className="bg-muted/30 rounded-xl overflow-hidden border border-border/30">
                <button
                  onClick={() => setShowHours(!showHours)}
                  className="flex items-center justify-between w-full p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Horários</span>
                  </div>
                  {showHours ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {showHours && (
                  <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {hasConfiguredHours ? (
                      <div className="grid grid-cols-1 gap-0.5">
                        {[0, 1, 2, 3, 4, 5, 6].map(day => {
                          const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                          const h = storeHours.find((hr: any) => hr.day_of_week === day);
                          const now = new Date();
                          const isToday = now.getDay() === day;
                          return (
                            <div key={day} className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] ${isToday ? "bg-primary/10 font-bold" : ""}`}>
                              <span className={`${isToday ? "text-primary" : "text-muted-foreground"} w-10`}>{dayNames[day]}</span>
                              {h && !h.is_closed_all_day ? (
                                <span className={isToday ? "text-foreground" : "text-muted-foreground font-medium"}>
                                  {String(h.open_time).slice(0, 5)} - {String(h.close_time).slice(0, 5)}
                                </span>
                              ) : (
                                <span className="text-destructive/70 font-medium italic">Fechado</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground text-center py-2 italic">
                        Horários não informados.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Methods — dinâmico baseado nas configurações da loja */}
              {(() => {
                const s = (store?.settings || {}) as Record<string, any>;
                const pixOnline   = s.accept_pix_online  !== false && s.accept_pix_online !== undefined ? s.accept_pix_online : false;
                const pixMachine  = s.accept_pix_machine === true;
                const card        = s.accept_card        !== false;
                const cash        = s.accept_cash        !== false;
                const hasPix      = pixOnline || pixMachine;
                const methods = [
                  { show: pixOnline,  icon: <QrCode className="h-3 w-3 text-emerald-500" />,  label: "PIX Online",     badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
                  { show: pixMachine, icon: <QrCode className="h-3 w-3 text-primary" />,       label: "PIX",            badge: "" },
                  { show: card,       icon: <CreditCard className="h-3 w-3 text-primary" />,   label: "Cartão",         badge: "" },
                  { show: cash,       icon: <Banknote className="h-3 w-3 text-primary" />,     label: "Dinheiro",       badge: "" },
                ];
                const active = methods.filter(m => m.show);
                return (
                  <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-black text-foreground uppercase tracking-wider">Pagamento</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {active.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground">Consulte a loja</span>
                      ) : active.map(m => (
                        <span
                          key={m.label}
                          className={`flex items-center gap-1.5 bg-card px-2.5 py-1.5 rounded-lg text-[10px] font-bold border shadow-sm ${
                            m.badge || "text-muted-foreground border-border/50"
                          }`}
                        >
                          {m.icon}
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Loyalty */}
          {store && <div className="px-5"><LoyaltyBanner storeId={store.id} storeName={store.name} /></div>}

          {/* Stats bar */}
          <div className="bg-muted/50 mt-2 px-5 py-4 flex items-center justify-around border-t border-border/50">
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-foreground leading-none">{totalProducts}</span>
              <span className="text-[11px] font-semibold text-muted-foreground mt-1">Produtos</span>
            </div>
            <div className="w-px h-6 bg-border/80" />
            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-foreground leading-none">{sections?.length || 0}</span>
              <span className="text-[11px] font-semibold text-muted-foreground mt-1">Categorias</span>
            </div>
            {store?.rating && store.rating > 0 && (
              <>
                <div className="w-px h-6 bg-border/80" />
                <div className="flex flex-col items-center">
                  <span className="text-lg font-black text-amber-500 leading-none flex items-center gap-1">
                    {store.rating}
                    <Star className="h-3 w-3 fill-amber-500" />
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground mt-1">Avaliação</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Suspended banner */}
      {isSuspended && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="text-sm font-bold text-destructive">Loja fechada no momento</p>
            <p className="text-xs text-muted-foreground">Esta loja está temporariamente indisponível para pedidos. Você pode consultar o cardápio, mas não é possível fazer pedidos agora.</p>
          </div>
        </div>
      )}

      {/* Closed banner (only when not suspended) */}
      {/* Banner: sem entregador vinculado */}
      {isOwnDeliveryStore && hasNoDrivers && storeStatus.isOpen && (
        <div className="mx-4 mt-3 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-lg shrink-0">🛵</span>
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400">
              Sem entregador disponível
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
              Esta loja ainda não tem motoboy cadastrado. Entre em contato com a loja para confirmar a entrega.
            </p>
          </div>
        </div>
      )}

      {!storeStatus.isOpen && !isSuspended && (
        <div className="mx-4 mt-3 bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-destructive">Loja fechada no momento</p>
            <p className="text-xs text-muted-foreground">{storeStatus.reason}</p>
          </div>
        </div>
      )}

      {/* ===== SEARCH BAR ===== */}
      <div className="mx-4 mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ===== PEÇA DE NOVO ===== */}
      {reorderProductsList.length > 0 && !filteredProducts && (
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">Peça de novo</h2>
          </div>
          <div className="flex overflow-x-auto gap-3 no-scrollbar pb-1">
            {reorderProductsList.map(product => (
              <button
                key={`reorder-${product.id}`}
                onClick={() => openProduct(product)}
                className={`flex-shrink-0 w-36 bg-card rounded-xl border border-border overflow-hidden text-left transition-all ${
                  !storeStatus.isOpen || hasNoDrivers || (product as any).metadata?.out_of_stock ? "opacity-60" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.97]"
                }`}
              >
                <div className="relative">
                  {(product as any).metadata?.out_of_stock && (
                    <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center">
                      <span className="text-[9px] font-black uppercase text-white bg-destructive px-1.5 py-0.5 rounded tracking-wider">Esgotado</span>
                    </div>
                  )}
                  {product.image_url ? (
                    <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className={`w-full h-24 object-cover ${(product as any).metadata?.out_of_stock ? "grayscale" : ""}`} />
                  ) : (
                    <div className="w-full h-24 bg-muted flex items-center justify-center"><span className="text-2xl">🍴</span></div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold text-foreground line-clamp-1">
                    {product.name}
                    {(product as any).metadata?.is_beverage && (product as any).metadata?.drink_volume && (
                      <span className="text-muted-foreground font-medium"> · {(product as any).metadata.drink_volume}</span>
                    )}
                  </p>
                  <p className="text-xs font-black text-primary mt-0.5">{formatBRL(product.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MAIS PEDIDOS ===== */}
      {popularProductsList.length > 0 && !filteredProducts && (
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">Mais pedidos</h2>
          </div>
          <div className="flex overflow-x-auto gap-3 no-scrollbar pb-1">
            {popularProductsList.map(product => (
              <button
                key={`popular-${product.id}`}
                onClick={() => openProduct(product)}
                className={`flex-shrink-0 w-36 bg-card rounded-xl border border-border overflow-hidden text-left transition-all relative ${
                  !storeStatus.isOpen || hasNoDrivers || (product as any).metadata?.out_of_stock ? "opacity-60" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.97]"
                }`}
              >
                <span className="absolute top-1.5 right-1.5 bg-primary/90 text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10">
                  🔥 {product.orderCount}x
                </span>
                <div className="relative">
                  {(product as any).metadata?.out_of_stock && (
                    <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center">
                      <span className="text-[9px] font-black uppercase text-white bg-destructive px-1.5 py-0.5 rounded tracking-wider">Esgotado</span>
                    </div>
                  )}
                  {product.image_url ? (
                    <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className={`w-full h-24 object-cover ${(product as any).metadata?.out_of_stock ? "grayscale" : ""}`} />
                  ) : (
                    <div className="w-full h-24 bg-muted flex items-center justify-center"><span className="text-2xl">🍴</span></div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold text-foreground line-clamp-1">
                    {product.name}
                    {(product as any).metadata?.is_beverage && (product as any).metadata?.drink_volume && (
                      <span className="text-muted-foreground font-medium"> · {(product as any).metadata.drink_volume}</span>
                    )}
                  </p>
                  <p className="text-xs font-black text-primary mt-0.5">{formatBRL(product.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== MONTE SUA PIZZA MEIO A MEIO ===== */}
      {store?.category === "pizzas" && (() => {
        const storeSettings = (store?.settings || {}) as Record<string, any>;
        const halfEnabled = !!storeSettings.pizza_half_enabled;
        if (!halfEnabled) return null;
        // Need at least one product to montar meio a meio
        if (!products || products.length === 0) return null;
        return (
          <div className="px-4 mt-4">
            <button
              onClick={() => {
                if (!storeStatus.isOpen) { toast.error(`Loja fechada. ${storeStatus.reason}`); return; }
                if (!products || products.length < 2) {
                  toast.error("Cadastre pelo menos 2 sabores de pizza para usar o meio a meio.");
                  return;
                }
                setShowHalfHalf(true);
              }}
              className={`w-full bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30 rounded-2xl p-4 flex items-center gap-4 text-left transition-all ${
                !storeStatus.isOpen ? "opacity-50" : "hover:border-primary/50 active:scale-[0.98]"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🍕</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-foreground">Monte sua Pizza Meio a Meio</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Escolha 2 sabores diferentes em uma pizza</p>
              </div>
              <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
            </button>
          </div>
        );
      })()}

       {/* ===== CATEGORY NAV ===== */}
       {visibleSections.length > 0 && !filteredProducts && !showHalfHalf && (
        <div
          ref={navRef}
          className={`sticky z-[60] bg-background border-b border-border mt-4 shadow-sm transition-all duration-300 ${
            scrolled ? "top-[63px]" : "top-0"
          }`}
        >
          <div className="flex overflow-x-auto gap-1.5 px-4 py-2.5 no-scrollbar">
            {visibleSections.map(s => (
              <button
                key={s.id}
                type="button"
                data-chip-id={s.id}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  scrollToSection(s.id);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== PRODUCTS ===== */}
      <div className="px-4 pt-4 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse bg-card rounded-2xl p-3 border border-border">
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-muted rounded-lg w-3/4" />
                  <div className="h-3 bg-muted rounded-lg w-full" />
                  <div className="h-4 bg-muted rounded-lg w-1/4 mt-3" />
                </div>
                <div className="w-24 h-24 bg-muted rounded-2xl flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : filteredProducts ? (
          /* Search results */
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              {filteredProducts.length} resultado{filteredProducts.length !== 1 ? "s" : ""} para "{searchQuery}"
            </p>
            {filteredProducts.length > 0 ? (
              <div className="space-y-2.5">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    disabled={!storeStatus.isOpen}
                    storeCategory={store?.category}
                    onClick={() => openProduct(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-3xl block mb-2">🔍</span>
                <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {visibleSections.map(section => {
              const sectionProducts = productsBySection(section.id);
              return (
                <div
                  key={section.id}
                  id={`menu-section-${section.id}`}
                  ref={el => { sectionRefs.current[section.id] = el; }}
                  data-section-id={section.id}
                  className="scroll-mt-16"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-black text-foreground">{section.name}</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-bold">
                      {sectionProducts.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {sectionProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        disabled={!storeStatus.isOpen}
                        storeCategory={store?.category}
                        onClick={() => openProduct(product)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {unsectionedProducts.length > 0 && (
              <div>
                {sections && sections.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-black text-foreground">Outros</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-bold">
                      {unsectionedProducts.length}
                    </span>
                  </div>
                )}
                <div className="space-y-2.5">
                  {unsectionedProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      disabled={!storeStatus.isOpen}
                      storeCategory={store?.category}
                      onClick={() => openProduct(product)}
                    />
                  ))}
                </div>
              </div>
            )}

            {products?.length === 0 && (
              <div className="text-center py-16">
                <span className="text-4xl block mb-3">📋</span>
                <p className="text-sm text-muted-foreground">Cardápio vazio no momento.</p>
              </div>
            )}
          </>
        )}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        storeName={store?.name || ""}
        storeCategory={store?.category}
        singleSize={!!(store?.settings as any)?.pizza_single_size}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={handleAddToCart}
      />

      {/* ===== PIZZA HALF-HALF MODAL ===== */}
      {store?.category === "pizzas" && (() => {
        const storeSettings = (store?.settings || {}) as Record<string, any>;
        return (
           <PizzaHalfHalfModal
            open={showHalfHalf}
            onClose={() => setShowHalfHalf(false)}
            storeName={store?.name || ""}
            storeId={store?.id || ""}
            products={products || []}
            sections={sections || []}
            priceMode={storeSettings.pizza_price_mode || "maior"}
            maxFlavors={(storeSettings.pizza_config?.max_flavors as 2 | 3 | 4) || 4}
            singleSize={!!storeSettings.pizza_single_size}
            onAdd={handleAddToCart}
          />
        );
      })()}

      <CartFAB />
      <BottomNav />
    </div>
  );
};

/* ===== Product Card ===== */
interface ProductCardProps {
  product: Product;
  disabled: boolean;
  onClick: () => void;
  storeCategory?: string;
}

const categoryEmoji: Record<string, string> = {
  pizzas: "🍕", lanches: "🍔", farmacias: "💊", japonesa: "🍣",
  cafeteria: "☕", churrasco: "🥩", adegas: "🍷", sobremesas: "🍰",
  docerias: "🧁", saudavel: "🥗",
};

const ProductCard = memo(({ product, disabled, onClick, storeCategory }: ProductCardProps) => {
  const meta = product.metadata || {};
  const cat = storeCategory || "";
  const isBeverage = !!meta.is_beverage;
  const emoji = categoryEmoji[cat] || "🍴";
  const isOutOfStock = !!meta.out_of_stock;
  const isBlocked = disabled || isOutOfStock;

  // ===== PIZZA =====
  // ===== FARMACIA =====
  const isPharmacy = cat === "farmacias";

  // Price display logic
  const priceDisplay = `${formatBRL(product.price)}`;

  // CTA label
  const ctaLabel = (() => {
    if (isOutOfStock) return "Esgotado";
    if (disabled) return "Indisponível";
    if (isPharmacy && meta.requires_prescription) return "Ver detalhes";
    return "Adicionar";
  })();

  // Subtitle/volume info
  // Adegas: não duplicar volume no nome — já aparece como badge
  const volumeInfo = cat === "adegas" ? null
    : isBeverage && meta.drink_volume ? meta.drink_volume
    : meta.volume ? meta.volume
    : null;

  return (
    <button
      onClick={isOutOfStock ? undefined : onClick}
      disabled={isOutOfStock}
      className={`w-full flex gap-3 bg-card rounded-2xl p-3 border border-border text-left transition-all group ${
        isBlocked ? "opacity-60" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.98]"
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Badges row */}
          <div className="flex flex-wrap gap-1 mb-1">
            {/* Pharmacy: prescription badge */}
            {isPharmacy && meta.requires_prescription && (
              <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold">
                📋 Receita obrigatória
              </span>
            )}
            {/* Pharmacy: generic badge */}
            {isPharmacy && meta.is_generic && (
              <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
                Genérico
              </span>
            )}
            {/* Lanches: combo badge */}
            {cat === "lanches" && meta.is_combo && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                🎁 Combo
              </span>
            )}
            {/* Japonesa: pieces */}
            {cat === "japonesa" && meta.pieces_count && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                {meta.pieces_count} peças
              </span>
            )}
            {/* Japonesa: shareable */}
            {(cat === "japonesa" || cat === "churrasco") && meta.shareable && (
              <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                👥 Compartilhar
              </span>
            )}
            {/* Adegas: apenas temperatura */}
            {cat === "adegas" && (meta.temp_option === "cold" || meta.serve_cold === true) && meta.temp_option !== "both" && meta.temp_option !== "ambient" && (
              <span className="text-[10px] bg-sky-500/10 text-sky-600 px-1.5 py-0.5 rounded-full font-bold">
                ❄️ Gelado
              </span>
            )}
            {cat === "adegas" && meta.temp_option === "both" && (
              <span className="text-[10px] bg-sky-500/10 text-sky-600 px-1.5 py-0.5 rounded-full font-bold">
                ❄️🔥 Gelado ou Quente
              </span>
            )}
            {cat === "adegas" && meta.temp_option === "ambient" && (
              <span className="text-[10px] bg-muted text-foreground/70 px-1.5 py-0.5 rounded-full font-semibold">
                🌡️ Temp. ambiente
              </span>
            )}
            {/* Outras categorias: badge gelado normal */}
            {isBeverage && cat !== "adegas" && meta.serve_cold && (
              <span className="text-[10px] bg-sky-500/10 text-sky-600 px-1.5 py-0.5 rounded-full font-bold">
                ❄️ Gelado
              </span>
            )}
            {/* Restaurante: porção, compartilhar, combo */}
            {cat === "restaurante" && meta.portion_size && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                🍽️ {meta.portion_size}
              </span>
            )}
            {cat === "restaurante" && meta.shareable && (
              <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                👥 Compartilhar
              </span>
            )}
            {cat === "restaurante" && meta.is_combo && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                🎁 Combo
              </span>
            )}
            {cat === "restaurante" && meta.is_gluten_free && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">
                Sem glúten
              </span>
            )}
            {cat === "restaurante" && meta.is_lactose_free && (
              <span className="text-[10px] bg-teal-500/10 text-teal-600 px-1.5 py-0.5 rounded-full font-bold">
                Sem lactose
              </span>
            )}
            {/* Saudável: badges nutricionais */}
            {cat === "saudavel" && meta.is_vegan && (
              <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                🌱 Vegano
              </span>
            )}
            {cat === "saudavel" && meta.is_vegetarian && !meta.is_vegan && (
              <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                🥦 Vegetariano
              </span>
            )}
            {cat === "saudavel" && meta.is_gluten_free && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                Sem glúten
              </span>
            )}
            {cat === "saudavel" && meta.is_lactose_free && (
              <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
                Sem lactose
              </span>
            )}
            {cat === "saudavel" && meta.is_low_carb && (
              <span className="text-[10px] bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">
                Low carb
              </span>
            )}
            {cat === "saudavel" && meta.calories && (
              <span className="text-[10px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                🔥 {meta.calories}
              </span>
            )}
            {/* Pizza: tamanho e combo */}
            {cat === "pizzas" && meta.shareable && (
              <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                👥 Compartilhar
              </span>
            )}
            {cat === "pizzas" && meta.has_stuffed_crust && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                Borda recheada
              </span>
            )}
            {cat === "pizzas" && meta.is_combo && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                🎁 Combo
              </span>
            )}
          </div>

          {/* Product name */}
          <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
            {volumeInfo && (
              <span className="text-muted-foreground font-medium"> · {volumeInfo}</span>
            )}
          </h3>

          {/* Description / category-specific subtitle */}
          {product.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
          )}


          {/* Farmacia: dosage + manufacturer */}
          {isPharmacy && (meta.dosage || meta.manufacturer) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {meta.dosage && <span className="font-medium">{meta.dosage}</span>}
              {meta.dosage && meta.manufacturer && " · "}
              {meta.manufacturer && <span>{meta.manufacturer}</span>}
            </p>
          )}

          {/* Lanches combo items */}
          {cat === "lanches" && meta.is_combo && meta.combo_items?.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
              Inclui: {meta.combo_items.join(", ")}
            </p>
          )}

          {/* Churrasco: weight */}
          {cat === "churrasco" && meta.portion_weight && (
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              ⚖️ {meta.portion_weight}
            </p>
          )}

          {/* Sobremesas/Docerias: flavors preview */}
          {(cat === "sobremesas" || cat === "docerias") && meta.flavors?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {meta.flavors.slice(0, 3).map((f: string) => (
                <span key={f} className="text-[10px] bg-pink-500/10 text-pink-600 px-1.5 py-0.5 rounded-full font-medium">{f}</span>
              ))}
              {meta.flavors.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{meta.flavors.length - 3}</span>
              )}
            </div>
          )}

          {/* Cafeteria: product type + flavors + badges */}
          {cat === "cafeteria" && !isBeverage && meta.cafe_product_type && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[10px] bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                ☕ {meta.cafe_product_type}
              </span>
              {meta.can_heat && (
                <span className="text-[10px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">🔥 Aquece</span>
              )}
              {meta.sells_slice && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">🍰 Fatia</span>
              )}
              {meta.sells_whole && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">🎂 Inteiro</span>
              )}
              {meta.can_be_iced && (
                <span className="text-[10px] bg-sky-500/10 text-sky-600 px-1.5 py-0.5 rounded-full font-medium">❄️ Gelado</span>
              )}
            </div>
          )}
          {/* Cafeteria: drink sizes (only for drink types) */}
          {cat === "cafeteria" && !isBeverage && (meta.cafe_product_type === "Café / Bebida Quente" || meta.cafe_product_type === "Suco / Bebida Fria") && meta.drink_sizes?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {meta.drink_sizes.map((s: string) => (
                <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{s}</span>
              ))}
            </div>
          )}
          {/* Cafeteria: cake flavors preview */}
          {cat === "cafeteria" && !isBeverage && (meta.cafe_product_type === "Bolo / Fatia" || meta.cafe_product_type === "Torta (fatia)") && meta.flavors?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {meta.flavors.slice(0, 3).map((f: string) => (
                <span key={f} className="text-[10px] bg-pink-500/10 text-pink-600 px-1.5 py-0.5 rounded-full font-medium">{f}</span>
              ))}
              {meta.flavors.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{meta.flavors.length - 3}</span>
              )}
            </div>
          )}

          {/* Sobremesas/Docerias: size/weight */}
          {(cat === "sobremesas" || cat === "docerias") && meta.size_weight && (
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">📏 {meta.size_weight}</p>
          )}

          {/* Beverage info (any category with is_beverage) */}
          {isBeverage && (meta.drink_type || meta.drink_volume) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {meta.drink_type && <span className="font-medium">🥤 {meta.drink_type}</span>}
              {meta.drink_type && meta.drink_volume && " · "}
              {meta.drink_volume && <span>{meta.drink_volume}</span>}
            </p>
          )}

          {/* Saudável: dietary tags */}
          {cat === "saudavel" && !isBeverage && (
            <div className="flex flex-wrap gap-1 mt-1">
              {meta.is_vegan && <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">🌱 Vegano</span>}
              {meta.is_gluten_free && <span className="text-[10px] bg-amber-500/10 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">🌾 Sem Glúten</span>}
              {meta.is_lactose_free && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">🥛 Sem Lactose</span>}
              {meta.calories && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">🔥 {meta.calories} kcal</span>}
            </div>
          )}

          {/* Adegas: type + alcohol */}
          {cat === "adegas" && meta.brand && (
            <p className="text-[10px] text-muted-foreground mt-1">
              <span className="font-medium">{meta.brand}</span>
              {meta.volume && <span> · {meta.volume}</span>}
            </p>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-black text-primary">
            {priceDisplay}
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
            isOutOfStock
              ? "bg-destructive text-destructive-foreground"
              : disabled
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
          }`}>
            {ctaLabel}
          </span>
        </div>
      </div>

      {/* Image */}
      <div className="flex-shrink-0 relative">
        {isOutOfStock && (
          <div className="absolute inset-0 z-10 rounded-xl bg-black/55 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase text-white bg-destructive px-2 py-1 rounded shadow-lg tracking-wider">
              Esgotado
            </span>
          </div>
        )}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`w-24 h-24 rounded-xl object-cover shadow-sm group-hover:shadow-md transition-shadow ${isOutOfStock ? "grayscale" : ""}`}
            loading="lazy"
            decoding="async"
            width={96}
            height={96}
          />
        ) : (
          <div className={`w-24 h-24 rounded-xl bg-muted flex items-center justify-center ${isOutOfStock ? "grayscale" : ""}`}>
            <span className="text-3xl">{emoji}</span>
          </div>
        )}
      </div>
    </button>
  );
});

ProductCard.displayName = "ProductCard";

export default StorePage;
