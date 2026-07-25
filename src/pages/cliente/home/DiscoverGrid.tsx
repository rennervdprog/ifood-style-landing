import { memo } from "react";
import { formatBRL } from "@/lib/utils";

interface Props {
  products: any[];
  storesMap: Map<string, any>;
  onSelect: (store: any) => void;
}

/**
 * Grid editorial de produtos aleatórios de lojas abertas.
 * Cards com imagem cheia, overlay editorial e pill de preço.
 */
const DiscoverGrid = memo(({ products, storesMap, onSelect }: Props) => {
  if (!products?.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p) => {
        const store = storesMap.get(p.store_id);
        return (
          <button
            key={p.id}
            onClick={() => store && onSelect(store)}
            onPointerEnter={() => {
              if (store?.slug) {
                const link = document.createElement("link");
                link.rel = "prefetch";
                link.href = `/${store.slug}`;
                document.head.appendChild(link);
                setTimeout(() => link.remove(), 4000);
              }
            }}
            className="relative rounded-3xl overflow-hidden bg-card border border-border aspect-square text-left active:scale-[0.98] transition-transform group"
          >
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-primary/10" />
            )}

            {/* preço pill topo-direita */}
            <span className="absolute top-2 right-2 bg-primary text-primary-foreground font-display font-bold text-[11px] px-2 py-1 rounded-full shadow-md">
              {formatBRL(Number(p.price))}
            </span>

            {/* loja pill topo-esquerda */}
            {store && (
              <span className="absolute top-2 left-2 bg-background/90 backdrop-blur text-foreground font-semibold text-[10px] px-2 py-1 rounded-full max-w-[70%] truncate">
                {store.name}
              </span>
            )}

            {/* overlay inferior */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground/85 via-foreground/40 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-3 text-background">
              <p className="font-display font-bold text-sm leading-tight line-clamp-2 drop-shadow">
                {p.name}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] opacity-95">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Aberta agora
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

DiscoverGrid.displayName = "DiscoverGrid";

export default DiscoverGrid;