import { memo } from "react";
import { Star, Clock, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StoreCardProps {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  is_open: boolean;
  rating: number | null;
  statusReason?: string;
  slug?: string | null;
  distanceKm?: number | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  lanches: "🍔",
  pizzas: "🍕",
  adegas: "🍷",
  japonesa: "🍣",
  saudavel: "🥗",
  sobremesas: "🍰",
  cafeteria: "☕",
  churrasco: "🥩",
  farmacias: "💊",
  docerias: "🧁",
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  lanches: "from-amber-500/20 via-orange-400/10 to-yellow-300/5",
  pizzas: "from-red-500/20 via-orange-400/10 to-yellow-300/5",
  adegas: "from-purple-500/20 via-violet-400/10 to-pink-300/5",
  japonesa: "from-rose-500/20 via-pink-400/10 to-red-300/5",
  saudavel: "from-green-500/20 via-emerald-400/10 to-teal-300/5",
  sobremesas: "from-pink-500/20 via-rose-400/10 to-fuchsia-300/5",
  cafeteria: "from-amber-600/20 via-yellow-500/10 to-orange-300/5",
  churrasco: "from-orange-600/20 via-red-500/10 to-amber-300/5",
  farmacias: "from-teal-500/20 via-cyan-400/10 to-emerald-300/5",
  docerias: "from-fuchsia-500/20 via-pink-400/10 to-rose-300/5",
};

const StoreCard = memo(({ id, name, category, image_url, is_open, rating, statusReason, slug, distanceKm }: StoreCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const icon = CATEGORY_ICONS[category] || "🍽️";
  const gradient = CATEGORY_GRADIENTS[category] || "from-primary/20 via-primary/10 to-primary/5";
  const distanceLabel =
    typeof distanceKm === "number" && Number.isFinite(distanceKm)
      ? distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`
      : null;

  const prefetchBootstrap = () => {
    const key = slug || id;
    if (!key) return;
    queryClient.prefetchQuery({
      queryKey: ["store-bootstrap", key],
      queryFn: async () => {
        const { data, error } = await (supabase as any).rpc("store_bootstrap", { _slug: key });
        if (error) throw error;
        return data;
      },
      staleTime: 1000 * 60 * 3,
    });
  };

  return (
    <button
      onClick={() => navigate(slug ? `/${slug}` : `/loja/${id}`)}
      onMouseEnter={prefetchBootstrap}
      onTouchStart={prefetchBootstrap}
      className="w-full text-left rounded-[2.5rem] bg-card shadow-sm border border-border overflow-hidden transition-all active:scale-[0.96] hover:shadow-xl group flex flex-col h-full"
    >
      <div className="relative h-44 sm:h-48 bg-muted overflow-hidden shrink-0">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${!is_open ? "grayscale brightness-75" : ""}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 ${!is_open ? "grayscale" : ""}`}>
            <span className="text-5xl drop-shadow-sm">{icon}</span>
            <span className="text-[11px] font-bold text-foreground/60 uppercase tracking-wide">{category}</span>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="absolute inset-x-0 top-0 p-4 flex justify-start items-start z-10">
          {is_open ? (
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/20 shadow-lg ${
              category === "farmacias" ? "bg-teal-500/80 text-white" : "bg-primary text-black"
            }`}>
              ABERTO
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-full text-[10px] font-black bg-black/60 text-white/90 backdrop-blur-md border border-white/10 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              FECHADO
            </div>
          )}
        </div>

        {/* Category Floating Badge */}
        <div className="absolute bottom-4 left-4 z-10">
          <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border border-white/10 shadow-lg">
            {category}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-black text-xl leading-tight transition-colors flex-1 ${!is_open ? "text-muted-foreground" : "text-foreground group-hover:text-primary"}`}>
              {name}
            </h3>
            {rating && (
              <div className="flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-lg shrink-0">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
              <Clock className="h-3 w-3 text-primary" />
              <span>30-45 min</span>
            </div>
            {distanceLabel && (
              <>
                <span className="w-1 h-1 rounded-full bg-border/60" />
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span>{distanceLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!is_open && statusReason && (
          <div className="mt-auto pt-2 border-t border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-destructive" />
              {statusReason}
            </p>
          </div>
        )}
      </div>
    </button>
  );
});

StoreCard.displayName = "StoreCard";

export default StoreCard;
