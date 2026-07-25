import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { formatBRL } from "@/lib/utils";

interface Props {
  products: any[];
  storesMap: Map<string, any>;
  onSelect: (store: any) => void;
}

/**
 * Grid editorial de produtos aleatórios de lojas abertas.
 * Card com imagem no topo e nome/loja/preço no rodapé — sem overlaps no mobile.
 */
const DiscoverGrid = memo(({ products, storesMap, onSelect }: Props) => {
  const navigate = useNavigate();
  if (!products?.length) return null;

  const openProduct = (p: any, store: any) => {
    if (!store) return;
    const base = store.slug ? `/${store.slug}` : `/loja/${store.id}`;
    navigate(`${base}?product=${p.id}`);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p) => {
        const store = storesMap.get(p.store_id);
        return (
          <button
            key={p.id}
            onClick={() => openProduct(p, store)}
            onPointerEnter={() => {
              if (store?.slug) {
                const link = document.createElement("link");
                link.rel = "prefetch";
                link.href = `/${store.slug}`;
                document.head.appendChild(link);
                setTimeout(() => link.remove(), 4000);
              }
            }}
            className="relative rounded-3xl overflow-hidden bg-card border border-border text-left active:scale-[0.98] transition-transform group flex flex-col"
          >
            <div className="relative w-full aspect-square overflow-hidden">
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
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-background/90 backdrop-blur text-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Aberta
              </span>
              {store?.category && (
                <span className="absolute top-2 right-2 bg-foreground/85 text-background text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur max-w-[70%] truncate">
                  {String(store.category).replace(/_/g, " ")}
                </span>
              )}
            </div>

            <div className="p-2.5 flex flex-col gap-1.5">
              <p className="font-display font-bold text-[13px] leading-tight text-foreground line-clamp-2 min-h-[2.2em]">
                {p.name}
              </p>
              <div className="flex items-center justify-between gap-1.5">
                {store && (
                  <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">
                    {store.name}
                  </span>
                )}
                <span className="bg-primary text-primary-foreground font-display font-bold text-[11px] px-2 py-0.5 rounded-full shrink-0">
                  {formatBRL(Number(p.price))}
                </span>
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