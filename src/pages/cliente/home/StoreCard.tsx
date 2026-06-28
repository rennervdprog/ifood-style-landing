import { MapPin, Store as StoreIcon, Star } from "lucide-react";

interface Props {
  store: any;
  onClick: () => void;
  variant?: "grid" | "row";
}

const StoreCard = ({ store, onClick, variant = "grid" }: Props) => {
  const isOpen = !!store.realIsOpen;
  const distance =
    typeof store.distanceKm === "number"
      ? store.distanceKm < 1
        ? `${Math.round(store.distanceKm * 1000)} m`
        : `${store.distanceKm.toFixed(1)} km`
      : null;

  if (variant === "row") {
    return (
      <button
        onClick={onClick}
        onPointerEnter={() => {
          if (store.slug) {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = `/${store.slug}`;
            document.head.appendChild(link);
            setTimeout(() => link.remove(), 4000);
          }
        }}
        className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-2xl hover:bg-muted/40 active:scale-[0.99] transition-all text-left"
      >
        {store.image_url ? (
          <img loading="lazy" decoding="async" src={store.image_url} alt={store.name}
            className="w-14 h-14 rounded-xl object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <StoreIcon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              isOpen ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
            }`}>
              {isOpen ? "Aberta" : "Fechada"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground capitalize truncate">
            {(store.category || "").replace(/_/g, " ")}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            {distance && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> {distance}
              </span>
            )}
            {!isOpen && store.statusReason && <span className="truncate">{store.statusReason}</span>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onPointerEnter={() => {
        if (store.slug) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.href = `/${store.slug}`;
          document.head.appendChild(link);
          setTimeout(() => link.remove(), 4000);
        }
      }}
      className={`group relative bg-card border border-border rounded-2xl overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
        isOpen ? "" : "opacity-80"
      }`}
    >
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {store.image_url ? (
          <img
            loading="lazy"
            decoding="async"
            src={store.image_url}
            alt={store.name}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              isOpen ? "" : "grayscale"
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <StoreIcon className="h-8 w-8 text-primary" />
          </div>
        )}
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
          isOpen ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        }`}>
          {isOpen ? "Aberta" : "Fechada"}
        </span>
        {distance && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/55 text-white backdrop-blur-sm flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" /> {distance}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
        <p className="text-[11px] text-muted-foreground capitalize truncate">
          {(store.category || "Loja").replace(/_/g, " ")}
        </p>
        {!isOpen && store.statusReason && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{store.statusReason}</p>
        )}
      </div>
    </button>
  );
};

export default StoreCard;