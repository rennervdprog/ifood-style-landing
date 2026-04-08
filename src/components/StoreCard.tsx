import { memo } from "react";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StoreCardProps {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  is_open: boolean;
  rating: number | null;
  statusReason?: string;
}

const StoreCard = memo(({ id, name, category, image_url, is_open, rating, statusReason }: StoreCardProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/loja/${id}`)}
      className="w-full text-left rounded-2xl bg-card shadow-sm border border-border overflow-hidden transition-all active:scale-[0.98]"
    >
      <div className="relative h-36 bg-muted overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className={`w-full h-full object-cover ${!is_open ? "grayscale" : ""}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ${!is_open ? "grayscale" : ""}`}>
            <span className="text-3xl">🍽️</span>
          </div>
        )}
        {(() => {
          const isPharmacy = category === "farmacias";
          return (
            <div
              className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                is_open
                  ? isPharmacy
                    ? "bg-teal-500 text-white"
                    : "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {is_open ? "Aberto" : "Fechado"}
            </div>
          );
        })()}
      </div>
      <div className="p-3">
        <h3 className={`font-bold text-sm ${!is_open ? "text-muted-foreground" : "text-foreground"}`}>
          {name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-muted-foreground capitalize">{category}</span>
          {rating && (
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="text-xs font-bold text-foreground">{rating}</span>
            </div>
          )}
        </div>
        {!is_open && statusReason && (
          <p className="text-[10px] text-muted-foreground mt-1">{statusReason}</p>
        )}
      </div>
    </button>
  );
});

StoreCard.displayName = "StoreCard";

export default StoreCard;
