import { memo, type KeyboardEvent } from "react";
import { Star, Clock, MapPin } from "lucide-react";

interface Props {
  stores: any[];
  onSelect: (store: any) => void;
}

const distanceLabel = (km?: number | null) =>
  typeof km === "number" ? (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`) : null;

/**
 * Bento 2x2 de destaques — 1 loja grande + 2 laterais empilhadas.
 * Substitui o carrossel horizontal antigo na home /cliente.
 */
const HighlightsBento = memo(({ stores, onSelect }: Props) => {
  const [featured, ...rest] = stores;
  const sides = rest.slice(0, 2);
  if (!featured) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, store: any) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(store);
  };

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2 h-56">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(featured)}
        onKeyDown={(event) => handleKeyDown(event, featured)}
        data-native-scroll-pan
        className="col-span-2 row-span-2 relative rounded-3xl overflow-hidden bg-card border border-border text-left active:scale-[0.99] transition-transform group cursor-pointer"
      >
        {featured.image_url ? (
          <img
            src={featured.image_url}
            alt={featured.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-primary/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
        <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full bg-primary text-primary-foreground uppercase tracking-wide">
          Destaque
        </span>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-background">
          <h3 className="font-display font-bold text-lg leading-tight truncate drop-shadow">
            {featured.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] opacity-95">
            {featured.rating && (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-current" />
                {Number(featured.rating).toFixed(1)}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> 30-45 min
            </span>
            {distanceLabel(featured.distanceKm) && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3" /> {distanceLabel(featured.distanceKm)}
              </span>
            )}
          </div>
        </div>
      </div>

      {sides.map((store) => (
        <div
          key={store.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(store)}
          onKeyDown={(event) => handleKeyDown(event, store)}
          data-native-scroll-pan
          className="relative rounded-2xl overflow-hidden bg-card border border-border text-left active:scale-[0.99] transition-transform group cursor-pointer"
        >
          {store.image_url ? (
            <img
              src={store.image_url}
              alt={store.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-primary/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2 text-background">
            <p className="font-display font-bold text-xs leading-tight truncate">{store.name}</p>
            <p className="text-[9px] opacity-90 truncate">
              {distanceLabel(store.distanceKm) || (store.category || "").replace(/_/g, " ")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});

HighlightsBento.displayName = "HighlightsBento";

export default HighlightsBento;