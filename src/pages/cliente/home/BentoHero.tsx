import { memo, useCallback, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Wallet, Truck, Sparkles, Store } from "lucide-react";

/**
 * Bento hero — 1 banner grande + 2 mini-cards fixos (cashback / frete grátis).
 * Substitui o carrossel de `PromoBanners` na home /cliente.
 */
type HeroAction = "no_fee" | "direct_delivery" | null;

interface BentoHeroProps {
  activeAction?: HeroAction;
  onExploreStores: () => void;
  onSelectNoFee: () => void;
  onSelectDirectDelivery: () => void;
}

const BentoHero = memo(({ activeAction, onExploreStores, onSelectNoFee, onSelectDirectDelivery }: BentoHeroProps) => {
  const navigate = useNavigate();

  const runOnKeyboard = useCallback((event: KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  }, []);

  const { data: banners } = useQuery({
    queryKey: ["active-banners-hero"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleBanner = useCallback(
    (banner: any) => {
      if (!banner) {
        onExploreStores();
        return;
      }
      if (banner.link_type === "store" && banner.link_value) navigate(`/${banner.link_value}`);
      else if (banner.link_type === "url" && banner.link_value) window.open(banner.link_value, "_blank");
      else onExploreStores();
    },
    [navigate, onExploreStores]
  );

  const main = banners?.[0];

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2 h-40">
      {/* Banner principal */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleBanner(main)}
        onKeyDown={(event) => runOnKeyboard(event, () => handleBanner(main))}
        data-native-scroll-pan
        className="col-span-2 row-span-2 relative rounded-3xl overflow-hidden border border-primary/30 text-left active:scale-[0.99] transition-transform cursor-pointer shadow-lg shadow-primary/20"
      >
        {main?.image_url ? (
          <img
            src={main.image_url}
            alt={main.title || "Promoção"}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            {/* Fundo vibrante com gradiente laranja quente */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-primary to-orange-600" />
            {/* Blobs decorativos */}
            <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-yellow-300/40 blur-2xl" />
            <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
            {/* Padrão de pontos sutil */}
            <div
              className="absolute inset-0 opacity-20 mix-blend-overlay"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
                backgroundSize: "14px 14px",
              }}
            />
            {/* Ícone loja gigante decorativo */}
            <Store
              className="absolute -right-3 -bottom-3 h-28 w-28 text-white/15"
              strokeWidth={1.5}
            />
          </>
        )}
        {main?.image_url && (
          <div className="absolute inset-0 bg-gradient-to-tr from-foreground/70 via-foreground/30 to-transparent" />
        )}
        <div className="relative z-10 h-full p-4 flex flex-col justify-between text-white">
          {/* Badge topo */}
          <div className="flex items-center gap-1.5 self-start rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 border border-white/30">
            <Sparkles className="h-3 w-3 text-yellow-200 fill-yellow-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Novo por aqui</span>
          </div>

          {/* Texto principal */}
          <div>
            <h3 className="font-display font-black text-[19px] leading-[1.05] line-clamp-2 drop-shadow-md">
              {main?.title || (
                <>
                  Descubra as<br />lojas da sua<br />cidade
                </>
              )}
            </h3>
            {main?.subtitle && (
              <p className="text-xs opacity-90 mt-1 line-clamp-1 drop-shadow">{main.subtitle}</p>
            )}
            <div className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold bg-white/95 text-primary rounded-full px-2.5 py-1 shadow-sm">
              Ver mais <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Mini card 1 — cashback */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectNoFee}
        onKeyDown={(event) => runOnKeyboard(event, onSelectNoFee)}
        data-native-scroll-pan
        aria-pressed={activeAction === "no_fee"}
        className={`rounded-2xl border p-3 flex flex-col justify-between text-left active:scale-[0.98] transition-all cursor-pointer ${
          activeAction === "no_fee"
            ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
            : "bg-primary/10 border-primary/20"
        }`}
      >
        <Wallet className={`h-4 w-4 ${activeAction === "no_fee" ? "text-primary-foreground" : "text-primary"}`} />
        <div>
          <p className={`font-display font-bold text-xs leading-tight ${activeAction === "no_fee" ? "text-primary-foreground" : "text-foreground"}`}>Sem taxa</p>
          <p className={`text-[10px] leading-tight ${activeAction === "no_fee" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>de serviço</p>
        </div>
      </div>

      {/* Mini card 2 — frete grátis */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectDirectDelivery}
        onKeyDown={(event) => runOnKeyboard(event, onSelectDirectDelivery)}
        data-native-scroll-pan
        aria-pressed={activeAction === "direct_delivery"}
        className={`rounded-2xl border p-3 flex flex-col justify-between text-left active:scale-[0.98] transition-all cursor-pointer ${
          activeAction === "direct_delivery"
            ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
            : "bg-card border-border"
        }`}
      >
        <Truck className={`h-4 w-4 ${activeAction === "direct_delivery" ? "text-primary-foreground" : "text-primary"}`} />
        <div>
          <p className={`font-display font-bold text-xs leading-tight ${activeAction === "direct_delivery" ? "text-primary-foreground" : "text-foreground"}`}>Entrega</p>
          <p className={`text-[10px] leading-tight ${activeAction === "direct_delivery" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>direta da loja</p>
        </div>
      </div>
    </div>
  );
});

BentoHero.displayName = "BentoHero";

export default BentoHero;