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
      className="w-full text-left rounded-2xl bg-card shadow-sm border border-border overflow-hidden transition-all active:scale-[0.98] hover:shadow-md group"
    >
      <div className="relative h-36 bg-muted overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!is_open ? "grayscale brightness-75" : ""}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 ${!is_open ? "grayscale" : ""}`}>
            <span className="text-5xl drop-shadow-sm">{icon}</span>
            <span className="text-[10px] font-semibold text-muted-foreground/70 capitalize tracking-wide">{category}</span>
          </div>
        )}

        {/* Status badge */}
        <div
          className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm ${
            is_open
              ? category === "farmacias"
                ? "bg-teal-500/90 text-white"
                : "bg-accent/90 text-accent-foreground"
              : "bg-black/50 text-white/90"
          }`}
        >
          {!is_open && <Clock className="h-2.5 w-2.5" />}
          {is_open ? "Aberto" : "Fechado"}
        </div>

        {/* Bottom gradient overlay for text readability */}
        {image_url && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
        )}
      </div>

      <div className="p-3.5">
        <h3 className={`font-bold text-sm leading-tight line-clamp-1 ${!is_open ? "text-muted-foreground" : "text-foreground"}`}>
          {name}
        </h3>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-muted-foreground capitalize">{category}</span>
          {rating ? (
            <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="text-xs font-bold text-primary">{rating.toFixed(1)}</span>
            </div>
          ) : null}
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
