import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartAddon } from "@/contexts/CartContext";
import { ArrowLeft, Star, Clock, ChevronRight, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import CartFAB from "@/components/CartFAB";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductDetailModal from "@/components/ProductDetailModal";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";

interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  section_id: string | null;
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
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", id || slug],
    queryFn: async () => {
      let query = supabase.from("stores").select("*").eq("status", "ativo");
      if (id) query = query.eq("id", id);
      else if (slug) query = query.eq("slug", slug);
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!(id || slug),
  });

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

  const storeStatus = store
    ? getStoreOpenStatus(
        (storeHours as any as OpeningHour[]) || [],
        (store as any).force_closed || false,
        store.is_open
      )
    : { isOpen: false, reason: "" };

  useEffect(() => {
    if (sections && sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = sectionRefs.current[sectionId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl">
          Voltar à Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 overflow-y-auto">
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/20" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-card/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-border/50"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
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
                message={`Olá! Estou vendo o cardápio da ${store?.name} no FoodIta.`}
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
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full mt-1 ${
              storeStatus.isOpen
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-destructive/10 text-destructive"
            }`}>
              {storeStatus.isOpen ? "● Aberto" : "● Fechado"}
            </span>
          </div>

          {/* Store meta info */}
          {store?.address_neighborhood && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-xs truncate">
                {[store.address_street, store.address_number, store.address_neighborhood, store.address_city]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}

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

      {/* Closed banner */}
      {!storeStatus.isOpen && (
        <div className="mx-4 mt-3 bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-destructive">Loja fechada no momento</p>
            <p className="text-xs text-muted-foreground">{storeStatus.reason}</p>
          </div>
        </div>
      )}

      {/* ===== SEARCH BAR ===== */}
      {showSearch && (
        <div className="mx-4 mt-3 animate-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar no cardápio..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setShowSearch(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
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
}

const ProductCard = ({ product, disabled, onClick }: ProductCardProps) => (
  <button
    onClick={onClick}
    className={`w-full flex gap-3 bg-card rounded-2xl p-3 border border-border text-left transition-all group ${
      disabled ? "opacity-50" : "hover:shadow-lg hover:border-primary/20 active:scale-[0.98]"
    }`}
  >
    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
      <div>
        <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-black text-primary">
          R$ {product.price.toFixed(2)}
        </span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
          disabled
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
        }`}>
          {disabled ? "Indisponível" : "Ver detalhes"}
        </span>
      </div>
    </div>
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
          <span className="text-3xl">🍴</span>
        </div>
      )}
    </div>
  </button>
);

export default StorePage;
