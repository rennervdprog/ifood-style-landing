import { memo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Wallet, Truck } from "lucide-react";

/**
 * Bento hero — 1 banner grande + 2 mini-cards fixos (cashback / frete grátis).
 * Substitui o carrossel de `PromoBanners` na home /cliente.
 */
const BentoHero = memo(() => {
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
      if (!banner) return;
      if (banner.link_type === "store" && banner.link_value) navigate(`/${banner.link_value}`);
      else if (banner.link_type === "url" && banner.link_value) window.open(banner.link_value, "_blank");
    },
    [navigate]
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
            Ver mais <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </button>

      {/* Mini card 1 — cashback */}
      <div className="rounded-2xl bg-primary/10 border border-primary/20 p-3 flex flex-col justify-between">
        <Wallet className="h-4 w-4 text-primary" />
        <div>
          <p className="font-display font-bold text-xs text-foreground leading-tight">Sem taxa</p>
          <p className="text-[10px] text-muted-foreground leading-tight">de serviço</p>
        </div>
      </div>

      {/* Mini card 2 — frete grátis */}
      <div className="rounded-2xl bg-card border border-border p-3 flex flex-col justify-between">
        <Truck className="h-4 w-4 text-primary" />
        <div>
          <p className="font-display font-bold text-xs text-foreground leading-tight">Entrega</p>
          <p className="text-[10px] text-muted-foreground leading-tight">direta da loja</p>
        </div>
      </div>
    </div>
  );
});

BentoHero.displayName = "BentoHero";

export default BentoHero;