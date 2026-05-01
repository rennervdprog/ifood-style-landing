import { memo } from "react";
import { Star, Clock, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StoreCardProps {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  is_open: boolean;
  rating: number | null;
  statusReason?: string;
  slug?: string | null;
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

const StoreCard = memo(({ id, name, category, image_url, is_open, rating, statusReason, slug }: StoreCardProps) => {
  const navigate = useNavigate();
  const icon = CATEGORY_ICONS[category] || "🍽️";
  const gradient = CATEGORY_GRADIENTS[category] || "from-primary/20 via-primary/10 to-primary/5";

  return (
     <button
       onClick={() => navigate(slug ? `/${slug}` : `/loja/${id}`)}
       className="w-full text-left rounded-[2rem] bg-card shadow-sm border border-border overflow-hidden transition-all active:scale-[0.96] hover:shadow-lg group"
     >
        <div className="relative h-44 bg-muted overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!is_open ? "grayscale brightness-75" : ""}`}
            loading="lazy"
            decoding="async"
            width={200}
            height={144}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 ${!is_open ? "grayscale" : ""}`}>
            <span className="text-5xl drop-shadow-sm">{icon}</span>
            <span className="text-[10px] font-semibold text-muted-foreground/70 capitalize tracking-wide">{category}</span>
          </div>
        )}

          {/* Overlay for status and rating */}
          <div className="absolute inset-x-0 top-0 p-4 flex justify-between items-start z-10">
            {is_open ? (
              <div className={`px-3 py-1.5 rounded-full text-[10px] font-black backdrop-blur-md border border-white/20 shadow-lg ${
                category === "farmacias" ? "bg-teal-500/80 text-white" : "bg-primary/80 text-white"
              }`}>
                ABERTO
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-full text-[10px] font-black bg-black/60 text-white/90 backdrop-blur-md border border-white/10 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                FECHADO
              </div>
            )}

            {rating && (
              <div className="flex items-center gap-1 bg-white/90 dark:bg-black/60 px-2 py-1 rounded-full border border-white/20 shadow-md backdrop-blur-md">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[10px] font-black text-foreground">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Category Floating Badge */}
          <div className="absolute bottom-3 left-3 z-10">
            <span className="bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">
              {category}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="space-y-1">
            <h3 className={`font-black text-lg leading-tight transition-colors ${!is_open ? "text-muted-foreground" : "text-foreground group-hover:text-primary"}`}>
              {name}
            </h3>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary/70" />
                <span>30-45 min</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary/70" />
                <span>1.2 km</span>
              </div>
            </div>
          </div>

        {!is_open && statusReason && (
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {statusReason}
          </p>
        )}
      </div>
    </button>
  );
});

StoreCard.displayName = "StoreCard";

export default StoreCard;
