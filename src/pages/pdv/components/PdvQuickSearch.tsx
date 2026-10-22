import { Search, Plus, Minus, Hash, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/pages/pdv/types";
import { gradientFor } from "@/pages/pdv/components/PdvCatalogSection";

interface Props {
  /** Lista bruta de produtos (a mesma do catálogo e do leitor de código). */
  products: Product[];
  getQty: (id: string) => number;
  addItem: (p: Product) => void;
  decItem: (id: string) => void;
  /** Mapa de estoque: product_id -> {quantity, min_quantity, track_stock} */
  stockMap?: Map<string, any>;
}

const MAX_RESULTS = 12;

/**
 * Busca rápida fixa na tela do caixa (pedido de lojista PDV): campo de código
 * curto + busca por nome/código SEM abrir a gaveta de produtos. Ao digitar,
 * os resultados aparecem numa lista logo abaixo; tocar adiciona à venda.
 * O botão "Ver produtos" continua existindo para o catálogo completo.
 * Visual e regras (trava de esgotado, toasts) espelham o PdvCatalogSection.
 */
export const PdvQuickSearch = ({ products, getQty, addItem, decItem, stockMap }: Props) => {
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.pdv_short_code || "").toLowerCase().includes(q),
    );
  }, [products, query]);

  // Fecha a lista ao clicar fora do componente.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open ]);

  /** Mesma trava de esgotado do card do catálogo (PdvProductCard.handleAdd). */
  const handleAdd = (p: Product) => {
    const stock = stockMap?.get(p.id);
    if (stock?.track_stock === true && Number(stock.quantity) <= 0) {
      toast.error(`${p.name} está esgotado`);
      return;
    }
    addItem(p);
  };

  /** Idêntico ao campo "# Cód" do catálogo: match exato do código curto. */
  const submitCode = () => {
    const c = code.trim();
    if (!c) return;
    const found = products.find(
      (p) => (p.pdv_short_code || "").toLowerCase() === c.toLowerCase(),
    );
    if (found) {
      const stock = stockMap?.get(found.id);
      if (stock?.track_stock === true && Number(stock.quantity) <= 0) {
        toast.error(`${found.name} está esgotado`);
        return;
      }
      addItem(found);
      setCode("");
    } else {
      toast.error(`Produto não encontrado para o código "${c}"`);
    }
  };

  const showList = open && query.trim().length > 0;
  const visible = results.slice(0, MAX_RESULTS);

  return (
    <div ref={rootRef} className="relative shrink-0 border-b border-border z-30">
      {/* Busca + código curto — mesmos campos da gaveta de produtos */}
      <div className="px-3 py-2.5">
        <div className="flex gap-2.5">
          <div className="relative shrink-0">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text" inputMode="numeric" placeholder="Cód"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCode(); }}
              className="w-[76px] h-full min-h-[50px] pl-9 pr-2 bg-[#F4F4F5] rounded-[14px] text-sm font-black pdv-mono text-center text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              title="Código curto do produto (Enter pra adicionar)"
            />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
            <input
              type="text" placeholder="Buscar produto ou código…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setQuery(""); setOpen(false); }
                if (e.key === "Enter" && results.length === 1) {
                  handleAdd(results[0]);
                  setQuery("");
                  setOpen(false);
                }
              }}
              className="w-full py-[13px] pl-11 pr-10 bg-[#F4F4F5] rounded-[14px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setOpen(false); }}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resultados em lista, logo abaixo da busca */}
      {showList && (
        <div className="absolute left-3 right-3 top-full -mt-0.5 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {visible.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-7 w-7 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="max-h-[336px] overflow-y-auto py-1.5">
              {visible.map((p) => {
                const qty = getQty(p.id);
                const stock = stockMap?.get(p.id);
                const hasStockControl = stock?.track_stock === true;
                const stockQty = hasStockControl ? Number(stock.quantity) : null;
                const isOutOfStock = hasStockControl && stockQty !== null && stockQty <= 0;
                const isLowStock = hasStockControl && stockQty !== null && stockQty > 0 && stockQty <= 5;
                const priceStr = `R$ ${Number(p.price).toFixed(2).replace(".", ",")}`;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleAdd(p)}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-muted/30 active:bg-muted/50 ${isOutOfStock ? "opacity-50" : ""}`}
                  >
                    <div
                      className="w-11 h-11 rounded-[10px] flex items-center justify-center text-white text-base font-extrabold shrink-0"
                      style={{ background: gradientFor(p.name) }}
                    >
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight truncate">{p.name}</p>
                      <p className={`text-[13px] font-extrabold ${isOutOfStock ? "text-muted-foreground" : "text-primary"}`}>
                        {priceStr}
                        {hasStockControl && (
                          <span className="font-medium text-muted-foreground">
                            {" "}· {isOutOfStock ? "esgotado" : `${stockQty} un`}
                          </span>
                        )}
                        {isLowStock && <span className="font-bold text-orange-600"> · baixo!</span>}
                      </p>
                      {p.pdv_short_code && (
                        <p className="text-[10.5px] text-muted-foreground font-semibold tracking-[0.04em] uppercase pdv-mono">
                          CÓD · {p.pdv_short_code}
                        </p>
                      )}
                    </div>
                    {qty > 0 ? (
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => decItem(p.id)}
                          aria-label="Remover um"
                          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-7 text-center text-sm font-extrabold tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleAdd(p)}
                          disabled={isOutOfStock}
                          aria-label="Adicionar um"
                          className={`w-9 h-9 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform shadow-md shadow-primary/25 ${isOutOfStock ? "opacity-40" : ""}`}
                        >
                          <Plus className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAdd(p); }}
                        disabled={isOutOfStock}
                        aria-label={`Adicionar ${p.name}`}
                        className={`w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 active:scale-90 transition-transform shadow-md shadow-primary/25 ${isOutOfStock ? "opacity-40" : ""}`}
                      >
                        <Plus className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}
              {results.length > MAX_RESULTS && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border/60">
                  + {results.length - MAX_RESULTS} produtos — continue digitando pra refinar a busca
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
