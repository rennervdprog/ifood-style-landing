import { memo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppIcon } from "@/components/ui/app-icon";

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
      <button
        onClick={() => handleBanner(main)}
        className="col-span-2 row-span-2 relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 border border-primary/20 text-left active:scale-[0.99] transition-transform"
      >
        {main?.image_url && (
          <img
            src={main.image_url}
            alt={main.title || "Promoção"}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-tr from-foreground/70 via-foreground/30 to-transparent" />
        <div className="relative z-10 h-full p-4 flex flex-col justify-end text-background">
          <h3 className="font-display font-bold text-lg leading-tight line-clamp-2 drop-shadow">
            {main?.title || "Descubra as lojas da sua cidade"}
          </h3>
          {main?.subtitle && (
            <p className="text-xs opacity-90 mt-0.5 line-clamp-1">{main.subtitle}</p>
          )}
          <div className="flex items-center gap-0.5 mt-2 text-[11px] font-bold opacity-95">
            Ver mais <AppIcon name="alt-arrow-right" variant="linear" className="h-3 w-3" />
          </div>
        </div>
      </button>

      {/* Mini card 1 — cashback */}
      <button
        type="button"
        onClick={onSelectNoFee}
        aria-pressed={activeAction === "no_fee"}
        className={`rounded-2xl border p-3 flex flex-col justify-between text-left active:scale-[0.98] transition-all ${
          activeAction === "no_fee"
            ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
            : "bg-primary/10 border-primary/20"
        }`}
      >
        <AppIcon name="wallet" variant="bold-duotone" className={`h-4 w-4 ${activeAction === "no_fee" ? "text-primary-foreground" : "text-primary"}`} />
        <div>
          <p className={`font-display font-bold text-xs leading-tight ${activeAction === "no_fee" ? "text-primary-foreground" : "text-foreground"}`}>Sem taxa</p>
          <p className={`text-[10px] leading-tight ${activeAction === "no_fee" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>de serviço</p>
        </div>
      </button>

      {/* Mini card 2 — frete grátis */}
      <button
        type="button"
        onClick={onSelectDirectDelivery}
        aria-pressed={activeAction === "direct_delivery"}
        className={`rounded-2xl border p-3 flex flex-col justify-between text-left active:scale-[0.98] transition-all ${
          activeAction === "direct_delivery"
            ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
            : "bg-card border-border"
        }`}
      >
        <AppIcon name="delivery" variant="bold-duotone" className={`h-4 w-4 ${activeAction === "direct_delivery" ? "text-primary-foreground" : "text-primary"}`} />
        <div>
          <p className={`font-display font-bold text-xs leading-tight ${activeAction === "direct_delivery" ? "text-primary-foreground" : "text-foreground"}`}>Entrega</p>
          <p className={`text-[10px] leading-tight ${activeAction === "direct_delivery" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>direta da loja</p>
        </div>
      </button>
    </div>
  );
});

BentoHero.displayName = "BentoHero";

export default BentoHero;