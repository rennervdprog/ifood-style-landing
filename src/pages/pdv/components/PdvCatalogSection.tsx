import { Search, Plus, Minus, Layers, Loader2, X, Hash } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { useState, type RefObject, type ReactNode } from "react";
import type { Product, MenuSection } from "@/pages/pdv/types";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  sections: MenuSection[];
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
  grouped: Record<string, Product[]>;
  prodLoading: boolean;
  getQty: (id: string) => number;
  addItem: (p: Product) => void;
  decItem: (id: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** Slot opcional renderizado acima da busca (ex.: Monte sua Pizza/Pastel). */
  topSlot?: ReactNode;
  /** Slot renderizado DENTRO da área rolável, antes dos produtos (scrolla junto). */
  scrollTopSlot?: ReactNode;
  /** Esconde as pills de categoria (quando já há sidebar externa). */
  hideSectionTabs?: boolean;
  /** Lista bruta de produtos, pra lookup por pdv_short_code. */
  allProducts?: Product[];
  /** Mapa de estoque: product_id -> {quantity, min_quantity, track_stock} */
  stockMap?: Map<string, any>;
}

interface ProductCardProps {
  product: Product;
  qty: number;
  stock?: any;
  addItem: (p: Product) => void;
  decItem: (id: string) => void;
}

/** 5 gradientes do protótipo — a cor é estável por produto (hash do nome). */
const CARD_GRADIENTS = [
  "linear-gradient(135deg,#FF6A00,#FF9A3D)",
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
  "linear-gradient(135deg,#EF4444,#F87171)",
  "linear-gradient(135deg,#3B82F6,#60A5FA)",
  "linear-gradient(135deg,#10B981,#34D399)",
];

/** Escolhe um dos 5 gradientes pelo hash do nome (mesmo produto, mesma cor). */
export const gradientFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
};

/** Card individual do produto com feedback visual ao adicionar. */
export const PdvProductCard = ({ product, qty, stock, addItem, decItem }: ProductCardProps) => {
  const [justAdded, setJustAdded] = useState(false);
  const hasStockControl = stock?.track_stock === true;
  const stockQty = hasStockControl ? Number(stock.quantity) : null;
  const isOutOfStock = hasStockControl && stockQty !== null && stockQty <= 0;
  const isLowStock = hasStockControl && stockQty !== null && stockQty > 0 && stockQty <= 5;

  const handleAdd = () => {
    if (isOutOfStock) {
      toast.error(`${product.name} está esgotado`);
      return;
    }
    addItem(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 350);
  };

  const priceStr = `R$ ${Number(product.price).toFixed(2).replace(".", ",")}`;
  const stockStr = hasStockControl
    ? isOutOfStock ? "esgotado" : `${stockQty} un`
    : "";

  return (
    <div
      onClick={handleAdd}
      className={`relative flex flex-col gap-2 p-3 rounded-2xl border-[1.5px] min-h-[148px] bg-card cursor-pointer select-none transition-all duration-150 ${
        justAdded
          ? "border-primary ring-2 ring-primary/25 scale-[0.97]"
          : "border-border"
      } ${isOutOfStock ? "opacity-50" : "active:scale-[0.97]"}`}>
      {/* Bloco colorido com a inicial */}
      <div
        className="h-16 rounded-[10px] flex items-center justify-center text-white text-[26px] font-extrabold shrink-0"
        style={{ background: gradientFor(product.name) }}>
        {product.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-foreground leading-[1.3] line-clamp-2">{product.name}</p>
        <p className={`text-[15px] font-extrabold mt-0.5 ${isOutOfStock ? "text-muted-foreground" : "text-primary"}`}>
          {priceStr}
          {stockStr && <span className="font-medium text-muted-foreground"> · {stockStr}</span>}
          {isLowStock && <span className="font-bold text-orange-600"> · baixo!</span>}
        </p>
        {product.pdv_short_code && (
          <p className="text-[10.5px] text-muted-foreground font-semibold tracking-[0.04em] uppercase pdv-mono mt-0.5">
            CÓD · {product.pdv_short_code}
          </p>
        )}
      </div>
      {/* Controles −/+ (não disparam o toque de adicionar do card) */}
      {qty > 0 && (
        <div className="flex items-center justify-end gap-1.5 mt-auto" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => decItem(product.id)}
            aria-label="Remover um"
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-7 text-center text-sm font-extrabold tabular-nums">{qty}</span>
          <button
            onClick={handleAdd}
            disabled={isOutOfStock}
            aria-label="Adicionar um"
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              justAdded ? "bg-green-600" : "bg-primary"
            } ${isOutOfStock ? "opacity-40" : "shadow-md shadow-primary/25"}`}>
            <Plus className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
};

export const PdvCatalogSection = ({
  search, setSearch, sections, activeSection, setActiveSection,
  grouped, prodLoading, getQty, addItem, decItem, searchInputRef, topSlot,
  scrollTopSlot, hideSectionTabs, allProducts, stockMap,
}: Props) => {
  const [code, setCode] = useState("");
  const submitCode = () => {
    const c = code.trim();
    if (!c || !allProducts) return;
    const found = allProducts.find(
      (p) => (p.pdv_short_code || "").toLowerCase() === c.toLowerCase(),
    );
    if (found) {
      // Mesma trava de esgotado do card (PdvProductCard.handleAdd).
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
  return (
  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    {topSlot && <div className="shrink-0">{topSlot}</div>}
    {/* Busca fixa + código curto */}
    <div className="px-4 pt-3 pb-2 shrink-0">
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
            ref={searchInputRef}
            type="text" placeholder="Buscar produto ou código…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full py-[13px] pl-11 pr-10 bg-[#F4F4F5] rounded-[14px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Abas de seção */}
    {!hideSectionTabs && sections.length > 0 && !search && (
      <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setActiveSection(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors border ${!activeSection ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>
          Todos
        </button>
        {sections.map((s) => (
          <button key={s.id}
            onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors border ${activeSection === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>
            {s.name}
          </button>
        ))}
      </div>
    )}

    {/* Produtos */}
    <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4">
      {scrollTopSlot}
      {prodLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : (
        Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            {Object.keys(grouped).length > 1 && (
              <div className="flex items-center gap-2 px-1 mb-1.5 mt-2">
                <Layers className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{section}</p>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {items.map((product) => (
                <PdvProductCard
                  key={product.id}
                  product={product}
                  qty={getQty(product.id)}
                  stock={stockMap?.get(product.id)}
                  addItem={addItem}
                  decItem={decItem}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
};
