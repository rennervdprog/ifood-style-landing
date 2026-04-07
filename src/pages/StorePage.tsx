import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartAddon } from "@/contexts/CartContext";
import { Star, Clock, ChevronRight, ChevronDown, ChevronUp, MapPin, Search, X, Navigation, CreditCard, Banknote, Smartphone, QrCode, RotateCcw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import CartFAB from "@/components/CartFAB";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductDetailModal from "@/components/ProductDetailModal";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreContext } from "@/contexts/StoreContext";

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

const StorePage = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { setCurrentStore } = useStoreContext();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pageRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", id || slug],
    queryFn: async () => {
      let query = supabase.from("stores").select("id, name, slug, image_url, category, rating, is_open, force_closed, status, delivery_mode, own_delivery_fee, owner_id, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, settings").in("status", ["ativo", "bloqueado"]);
      if (id) query = query.eq("id", id);
      else if (slug) query = query.eq("slug", slug);
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!(id || slug),
  });

  // Set store context when accessed via slug (client mode)
  useEffect(() => {
    if (store && slug) {
      setCurrentStore(store.id, (store as any).slug || slug, store.name);
    }
  }, [store, slug, setCurrentStore]);

  const storeId = store?.id || id;

  const { data: storeHours } = useQuery({
    queryKey: ["store-hours", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("opening_hours").select("*").eq("store_id", storeId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
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
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId!)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!storeId,
  });

  // "Peça de novo" - products user has ordered before from this store
  const { data: reorderProducts } = useQuery({
    queryKey: ["reorder-products", storeId, user?.id],
    queryFn: async () => {
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("product_id, quantity, orders!inner(store_id, client_id)")
        .eq("orders.store_id", storeId!)
        .eq("orders.client_id", user!.id);
      if (error) throw error;
      // Count how many times each product was ordered
      const countMap: Record<string, number> = {};
      (orderItems || []).forEach((item: any) => {
        countMap[item.product_id] = (countMap[item.product_id] || 0) + item.quantity;
      });
      // Sort by frequency, return top 10 product IDs
      return Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pid]) => pid);
    },
    enabled: !!storeId && !!user?.id,
  });

  // "Mais pedidos" - most popular products in this store (all users)
  const { data: popularProducts } = useQuery({
    queryKey: ["popular-products", storeId],
    queryFn: async () => {
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("product_id, quantity, orders!inner(store_id)")
        .eq("orders.store_id", storeId!);
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
  });

  const isSuspended = store?.status === "bloqueado";

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

  const hasConfiguredHours = Array.isArray(storeHours) && storeHours.length > 0;
  const statusLabel = hasConfiguredHours
    ? `● ${storeStatus.reason || (storeStatus.isOpen ? "Aberto" : "Fechado")}`
    : "● Horário não informado";

  const reorderProductsList = products?.filter(p => reorderProducts?.includes(p.id)) || [];
  const popularProductsList = popularProducts
    ?.map(pp => {
      const product = products?.find(p => p.id === pp.productId);
      return product ? { ...product, orderCount: pp.count } : null;
    })
    .filter(Boolean) as (Product & { orderCount: number })[] || [];

  useEffect(() => {
    if (sections && sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);

    const el = sectionRefs.current[sectionId];
    if (!el) return;

    const offset = 96;
    const container = pageRef.current;

    if (container && container.scrollHeight > container.clientHeight) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = el.getBoundingClientRect();
      const top = container.scrollTop + (elementRect.top - containerRect.top) - offset;

      container.scrollTo({
        top: Math.max(top, 0),
        behavior: "smooth",
      });

      return;
    }

    const top = window.scrollY + el.getBoundingClientRect().top - offset;
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });
  };

  const productsBySection = (sectionId: string | null) =>
    products?.filter(p => p.section_id === sectionId) || [];

  const unsectionedProducts = products?.filter(p => !p.section_id) || [];

  // Search filter
  const filteredProducts = searchQuery.trim()
    ? products?.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ) || []
    : null;

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

  const totalProducts = products?.length || 0;

  if (!storeLoading && !store && (id || slug)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <span className="text-5xl mb-4">🔒</span>
        <h1 className="text-xl font-bold text-foreground mb-2">Loja indisponível</h1>
        <p className="text-sm text-muted-foreground mb-6">Esta loja não está ativa no momento.</p>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-background pb-24 overflow-y-auto">
      {/* ===== HERO ===== */}
      <div className="relative h-56 md:h-64">
        {store?.image_url ? (
          <img
            src={store.image_url}
            alt={store.name}
            className={`w-full h-full object-cover ${!storeStatus.isOpen ? "grayscale brightness-75" : ""}`}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 ${!storeStatus.isOpen ? "grayscale" : ""}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-end p-4 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 bg-card/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-border/50"
            >
              <Search className="h-5 w-5 text-foreground" />
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
      </div>

      {/* ===== STORE INFO ===== */}
      <div className="relative -mt-16 mx-4 z-10">
        <div className="bg-card rounded-2xl border border-border shadow-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-18 h-18 rounded-2xl bg-muted border-2 border-card shadow-lg flex-shrink-0 overflow-hidden -mt-12 w-[72px] h-[72px]">
              {store?.image_url ? (
                <img src={store.image_url} alt={store?.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <span className="text-3xl">🍽️</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl font-black text-foreground truncate">{store?.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-full">
                  {store?.category}
                </span>
                {store?.rating && store.rating > 0 && (
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{store.rating}</span>
                  </div>
                )}
              </div>
            </div>
            {hasConfiguredHours && (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full mt-1 ${
                storeStatus.isOpen
                  ? "bg-green-100 text-green-800"
                  : "bg-destructive/10 text-destructive"
              }`}>
                {statusLabel}
              </span>
            )}
          </div>

          {/* Address + Maps button */}
          {store?.address_neighborhood && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <span className="text-xs truncate flex-1">
                {[store.address_street, store.address_number, store.address_neighborhood, store.address_city]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const addr = encodeURIComponent(
                    [store.address_street, store.address_number, store.address_neighborhood, store.address_city, store.address_state]
                      .filter(Boolean)
                      .join(", ")
                  );
                  window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, "_blank");
                }}
                className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-[10px] font-bold hover:bg-primary/20 transition-colors flex-shrink-0"
              >
                <Navigation className="h-3 w-3" />
                Maps
              </button>
            </div>
          )}

          {/* Opening Hours */}
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => setShowHours(!showHours)}
              className="flex items-center justify-between w-full"
            >
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Horários de funcionamento</span>
            </div>
              {showHours ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {showHours && hasConfiguredHours && (
              <div className="grid grid-cols-1 gap-0.5 mt-2">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                  const h = storeHours.find((hr: any) => hr.day_of_week === day);
                  const now = new Date();
                  const isToday = now.getDay() === day;
                  return (
                    <div key={day} className={`flex items-center justify-between px-2 py-1 rounded-md text-xs ${isToday ? "bg-primary/5 font-bold" : ""}`}>
                      <span className={`${isToday ? "text-primary" : "text-muted-foreground"} w-8`}>{dayNames[day]}</span>
                      {h && !h.is_closed_all_day ? (
                        <span className={isToday ? "text-foreground" : "text-muted-foreground"}>
                          {String(h.open_time).slice(0, 5)} - {String(h.close_time).slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-destructive/70">Fechado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {showHours && !hasConfiguredHours && (
              <p className="text-xs text-muted-foreground mt-2">
                Esta loja ainda não informou os horários de funcionamento.
              </p>
            )}
          </div>

          {/* Payment Methods */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Formas de pagamento</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: QrCode, label: "Pix" },
                { icon: Banknote, label: "Dinheiro" },
                { icon: CreditCard, label: "Cartão na entrega" },
              ].map(pm => (
                <span key={pm.label} className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full text-[10px] font-medium text-muted-foreground">
                  <pm.icon className="h-3 w-3" />
                  {pm.label}
                </span>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-4">
            <div className="text-center flex-1">
              <p className="text-lg font-black text-foreground">{totalProducts}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Itens</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-lg font-black text-foreground">{sections?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Categorias</p>
            </div>
            {store?.rating && store.rating > 0 && (
              <>
                <div className="w-px h-8 bg-border" />
                <div className="text-center flex-1">
                  <p className="text-lg font-black text-foreground">{store.rating}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nota</p>
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
                onClick={() => {
                  if (!storeStatus.isOpen) { toast.error(`Loja fechada. ${storeStatus.reason}`); return; }
                  setSelectedProduct(product);
                }}
                className={`flex-shrink-0 w-36 bg-card rounded-xl border border-border overflow-hidden text-left transition-all ${
                  !storeStatus.isOpen ? "opacity-50" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.97]"
                }`}
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-24 bg-muted flex items-center justify-center"><span className="text-2xl">🍴</span></div>
                )}
                <div className="p-2">
                  <p className="text-xs font-bold text-foreground line-clamp-1">
                    {product.name}
                    {(product as any).metadata?.is_beverage && (product as any).metadata?.drink_volume && (
                      <span className="text-muted-foreground font-medium"> · {(product as any).metadata.drink_volume}</span>
                    )}
                  </p>
                  <p className="text-xs font-black text-primary mt-0.5">R$ {product.price.toFixed(2)}</p>
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
                onClick={() => {
                  if (!storeStatus.isOpen) { toast.error(`Loja fechada. ${storeStatus.reason}`); return; }
                  setSelectedProduct(product);
                }}
                className={`flex-shrink-0 w-36 bg-card rounded-xl border border-border overflow-hidden text-left transition-all relative ${
                  !storeStatus.isOpen ? "opacity-50" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.97]"
                }`}
              >
                <span className="absolute top-1.5 right-1.5 bg-primary/90 text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10">
                  🔥 {product.orderCount}x
                </span>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-24 bg-muted flex items-center justify-center"><span className="text-2xl">🍴</span></div>
                )}
                <div className="p-2">
                  <p className="text-xs font-bold text-foreground line-clamp-1">
                    {product.name}
                    {(product as any).metadata?.is_beverage && (product as any).metadata?.drink_volume && (
                      <span className="text-muted-foreground font-medium"> · {(product as any).metadata.drink_volume}</span>
                    )}
                  </p>
                  <p className="text-xs font-black text-primary mt-0.5">R$ {product.price.toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== CATEGORY NAV ===== */}
      {sections && sections.length > 0 && !filteredProducts && (
        <div
          ref={navRef}
          className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border mt-4"
        >
          <div className="flex overflow-x-auto gap-1.5 px-4 py-2.5 no-scrollbar">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
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
                    onClick={() => {
                      if (!storeStatus.isOpen) { toast.error(`Loja fechada. ${storeStatus.reason}`); return; }
                      setSelectedProduct(product);
                    }}
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
            {sections?.map(section => {
              const sectionProducts = productsBySection(section.id);
              if (sectionProducts.length === 0) return null;
              return (
                <div
                  key={section.id}
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
                        onClick={() => {
                          if (!storeStatus.isOpen) { toast.error(`Loja fechada. ${storeStatus.reason}`); return; }
                          setSelectedProduct(product);
                        }}
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
                      onClick={() => {
                        if (!storeStatus.isOpen) { toast.error(`Loja fechada. ${storeStatus.reason}`); return; }
                        setSelectedProduct(product);
                      }}
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
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={handleAddToCart}
      />

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

const ProductCard = ({ product, disabled, onClick, storeCategory }: ProductCardProps) => {
  const meta = product.metadata || {};
  const cat = storeCategory || "";
  const isBeverage = !!meta.is_beverage;
  const emoji = categoryEmoji[cat] || "🍴";

  // ===== PIZZA =====
  const isPizza = cat === "pizzas" && !isBeverage;
  const sizes: Array<{ name: string; price: number }> = meta.sizes || [];

  // ===== FARMACIA =====
  const isPharmacy = cat === "farmacias";

  // Price display logic
  const priceDisplay = (() => {
    if (isPizza && sizes.length > 0) {
      const prices = sizes.map(s => s.price).filter(p => p > 0);
      if (prices.length === 0) return `R$ ${product.price.toFixed(2)}`;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? `R$ ${min.toFixed(2)}` : `R$ ${min.toFixed(2)} ~ R$ ${max.toFixed(2)}`;
    }
    return `R$ ${product.price.toFixed(2)}`;
  })();

  // CTA label
  const ctaLabel = (() => {
    if (disabled) return "Indisponível";
    if (isPizza && sizes.length > 0) return "Escolher tamanho";
    if (isPharmacy && meta.requires_prescription) return "Ver detalhes";
    return "Adicionar";
  })();

  // Subtitle/volume info
  const volumeInfo = isBeverage && meta.drink_volume ? meta.drink_volume
    : meta.volume ? meta.volume
    : null;

  return (
    <button
      onClick={onClick}
      className={`w-full flex gap-3 bg-card rounded-2xl p-3 border border-border text-left transition-all group ${
        disabled ? "opacity-50" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.98]"
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {/* Badges row */}
          <div className="flex flex-wrap gap-1 mb-1">
            {/* Pharmacy: prescription badge */}
            {isPharmacy && meta.requires_prescription && (
              <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold">
                📋 Receita obrigatória
              </span>
            )}
            {/* Pharmacy: generic badge */}
            {isPharmacy && meta.is_generic && (
              <span className="text-[9px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
                Genérico
              </span>
            )}
            {/* Lanches: combo badge */}
            {cat === "lanches" && meta.is_combo && (
              <span className="text-[9px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
                🎁 Combo
              </span>
            )}
            {/* Japonesa: pieces */}
            {cat === "japonesa" && meta.pieces_count && (
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                {meta.pieces_count} peças
              </span>
            )}
            {/* Japonesa: shareable */}
            {(cat === "japonesa" || cat === "churrasco") && meta.shareable && (
              <span className="text-[9px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
                👥 Compartilhar
              </span>
            )}
            {/* Beverage: cold badge */}
            {(isBeverage || cat === "adegas") && meta.serve_cold && (
              <span className="text-[9px] bg-sky-500/10 text-sky-600 px-1.5 py-0.5 rounded-full font-bold">
                ❄️ Gelado
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

          {/* Pizza: sizes preview */}
          {isPizza && sizes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {sizes.map(s => (
                <span key={s.name} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {s.name}
                </span>
              ))}
            </div>
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
          {cat === "adegas" && (meta.drink_type || meta.alcohol_content) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {meta.drink_type && <span className="font-medium">{meta.drink_type}</span>}
              {meta.drink_type && meta.alcohol_content && " · "}
              {meta.alcohol_content && <span>{meta.alcohol_content}</span>}
            </p>
          )}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-black text-primary">
            {isPizza && sizes.length > 0 && <span className="text-[10px] font-bold text-muted-foreground mr-1">a partir de</span>}
            {priceDisplay}
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
            disabled
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
          }`}>
            {ctaLabel}
          </span>
        </div>
      </div>

      {/* Image */}
      <div className="flex-shrink-0">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-24 h-24 rounded-xl object-cover shadow-sm group-hover:shadow-md transition-shadow"
            loading="lazy"
          />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-3xl">{emoji}</span>
          </div>
        )}
      </div>
    </button>
  );
};

export default StorePage;
