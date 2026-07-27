import type { KeyboardEvent } from "react";
import { MapPin, Store as StoreIcon, Star } from "lucide-react";
import { describeStoreFee } from "@/lib/deliveryFeeDisplay";

interface Props {
  store: any;
  onClick: () => void;
  variant?: "grid" | "row";
}

const StoreCard = ({ store, onClick, variant = "grid" }: Props) => {
  const isOpen = !!store.realIsOpen;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick();
  };
  const distance =
    typeof store.distanceKm === "number"
      ? store.distanceKm < 1
        ? `${Math.round(store.distanceKm * 1000)} m`
        : (formatDistanceKm(store.distanceKm) ?? `${store.distanceKm.toFixed(1)} km`)
      : null;

  const rating =
    typeof store.rating === "number" && store.rating > 0 ? Number(store.rating) : null;
  const deliveryTime = (() => {
    if (typeof store.distanceKm !== "number") return "30-45 min";
    const base = 20 + Math.round(store.distanceKm * 4);
    return `${base}-${base + 15} min`;
  })();
  const feeInfo = describeStoreFee(store);
  const feeLabel = feeInfo.label;
  const isFreeFee = feeInfo.free;

  if (variant === "row") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        data-native-scroll-pan
        onPointerEnter={() => {
          if (store.slug) {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = `/${store.slug}`;
            document.head.appendChild(link);
            setTimeout(() => link.remove(), 4000);
          }
        }}
        className="w-full flex items-center gap-3 py-3 active:opacity-70 transition-opacity text-left cursor-pointer"
      >
        {store.image_url ? (
          <img
            loading="lazy"
            decoding="async"
            src={store.image_url}
            alt={store.name}
            className={`w-16 h-16 rounded-2xl object-cover border border-border/50 shrink-0 ${
              isOpen ? "" : "grayscale opacity-60"
            }`}
          />
        ) : (
          <div className={`w-16 h-16 rounded-2xl bg-muted flex items-center justify-center shrink-0 ${
            isOpen ? "" : "opacity-60"
          }`}>
            <StoreIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {!isOpen && (
            <span className="inline-block text-[9px] font-black tracking-wider text-rose-600 mb-0.5">
              FECHADA
            </span>
          )}
          <p className="text-[15px] font-bold text-foreground truncate leading-tight">
            {store.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground">
            {rating ? (
              <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {rating.toFixed(1)}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground/70">Novo</span>
            )}
            <span className="text-muted-foreground/50">•</span>
            <span className="truncate capitalize">{(store.category || "").replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-muted-foreground">
            <span>{deliveryTime}</span>
            <span className="text-muted-foreground/50">•</span>
            <span className={isFreeFee ? "font-bold text-emerald-600" : "font-semibold text-foreground"}>
              {feeLabel}
            </span>
            {distance && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {distance}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-native-scroll-pan
      onPointerEnter={() => {
        if (store.slug) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.href = `/${store.slug}`;
          document.head.appendChild(link);
          setTimeout(() => link.remove(), 4000);
        }
      }}
      className={`group relative bg-card border border-border rounded-2xl overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer ${
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
    </div>
  );
};

export default StoreCard;