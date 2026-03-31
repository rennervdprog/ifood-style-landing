import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartAddon } from "@/contexts/CartContext";
import { ArrowLeft, Star, Clock, ChevronRight } from "lucide-react";
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
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);

  // Store data - supports both ID and slug lookup
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", id || slug],
    queryFn: async () => {
      let query = supabase.from("stores").select("*").eq("status", "ativo");
      if (id) {
        query = query.eq("id", id);
      } else if (slug) {
        query = query.eq("slug", slug);
      }
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!(id || slug),
  });

  // Store hours
  const { data: storeHours } = useQuery({
    queryKey: ["store-hours", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("opening_hours").select("*").eq("store_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Owner profile (for WhatsApp)
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

  // Menu sections
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

  // Products
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

  // Set first section as active
  useEffect(() => {
    if (sections && sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Group products by section
  const productsBySection = (sectionId: string | null) =>
    products?.filter(p => p.section_id === sectionId) || [];

  const unsectionedProducts = products?.filter(p => !p.section_id) || [];

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

  // Not found
  if (!storeLoading && !store && id) {
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
      {/* ===== HERO BANNER ===== */}
      <div className="relative h-52">
        {store?.image_url ? (
          <img
            src={store.image_url}
            alt={store.name}
            className={`w-full h-full object-cover ${!storeStatus.isOpen ? "grayscale brightness-75" : ""}`}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br from-primary/40 to-primary/10 ${!storeStatus.isOpen ? "grayscale" : ""}`} />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-card/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md z-10"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>

        {/* WhatsApp floating */}
        {ownerProfile?.whatsapp_number && (
          <div className="absolute top-4 right-4 z-10">
            <WhatsAppButton
              number={ownerProfile.whatsapp_number}
              message={`Olá! Estou vendo o cardápio da ${store?.name} no ItaFood.`}
              label="Falar"
              size="sm"
            />
          </div>
        )}
      </div>

      {/* ===== STORE INFO CARD ===== */}
      <div className="relative -mt-14 mx-4 bg-card rounded-2xl border border-border p-4 shadow-lg z-10">
        <div className="flex items-start gap-3">
          {/* Logo circle */}
          <div className="w-16 h-16 rounded-full bg-muted border-2 border-background shadow-md flex-shrink-0 overflow-hidden -mt-10">
            {store?.image_url ? (
              <img src={store.image_url} alt={store?.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <span className="text-2xl">🍽️</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-lg font-black text-foreground truncate">{store?.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground capitalize">{store?.category}</span>
              {store?.rating && store.rating > 0 && (
                <div className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold">{store.rating}</span>
                </div>
              )}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                storeStatus.isOpen
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}>
                {storeStatus.isOpen ? "Aberto" : "Fechado"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Closed banner */}
      {!storeStatus.isOpen && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-destructive">Loja fechada</p>
            <p className="text-xs text-muted-foreground">{storeStatus.reason}</p>
          </div>
        </div>
      )}

      {/* ===== CATEGORY NAV BAR ===== */}
      {sections && sections.length > 0 && (
        <div
          ref={navRef}
          className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border mt-4"
        >
          <div className="flex overflow-x-auto gap-1 px-4 py-2 no-scrollbar">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground"
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
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
                <div className="w-24 h-24 bg-muted rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Sectioned products */}
            {sections?.map(section => {
              const sectionProducts = productsBySection(section.id);
              if (sectionProducts.length === 0) return null;
              return (
                <div
                  key={section.id}
                  ref={el => { sectionRefs.current[section.id] = el; }}
                  className="scroll-mt-16"
                >
                  <h2 className="text-base font-black text-foreground mb-3">{section.name}</h2>
                  <div className="space-y-3">
                    {sectionProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        disabled={!storeStatus.isOpen}
                        onClick={() => {
                          if (!storeStatus.isOpen) {
                            toast.error(`Loja fechada. ${storeStatus.reason}`);
                            return;
                          }
                          setSelectedProduct(product);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Unsectioned products */}
            {unsectionedProducts.length > 0 && (
              <div>
                {sections && sections.length > 0 && (
                  <h2 className="text-base font-black text-foreground mb-3">Outros</h2>
                )}
                <div className="space-y-3">
                  {unsectionedProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      disabled={!storeStatus.isOpen}
                      onClick={() => {
                        if (!storeStatus.isOpen) {
                          toast.error(`Loja fechada. ${storeStatus.reason}`);
                          return;
                        }
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

      {/* Product detail modal */}
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

/* ===== Product Card Component ===== */
interface ProductCardProps {
  product: Product;
  disabled: boolean;
  onClick: () => void;
}

const ProductCard = ({ product, disabled, onClick }: ProductCardProps) => (
  <button
    onClick={onClick}
    className={`w-full flex gap-3 bg-card rounded-2xl p-3 border border-border text-left transition-all active:scale-[0.98] ${
      disabled ? "opacity-50" : "hover:shadow-md"
    }`}
  >
    <div className="flex-1 min-w-0 flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-sm text-foreground line-clamp-1">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-black text-primary">R$ {product.price.toFixed(2)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
    <div className="flex-shrink-0">
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-24 h-24 rounded-2xl object-cover" loading="lazy" />
      ) : (
        <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center">
          <span className="text-3xl">🍴</span>
        </div>
      )}
    </div>
  </button>
);

export default StorePage;
