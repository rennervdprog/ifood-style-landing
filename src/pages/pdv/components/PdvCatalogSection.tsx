import { Search, Plus, Minus, Layers, Loader2, X, Hash } from "lucide-react";
import { formatBRL } from "@/lib/utils";
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
}

export const PdvCatalogSection = ({
  search, setSearch, sections, activeSection, setActiveSection,
  grouped, prodLoading, getQty, addItem, decItem, searchInputRef, topSlot,
  scrollTopSlot, hideSectionTabs, allProducts,
}: Props) => {
  const [code, setCode] = useState("");
  const submitCode = () => {
    const c = code.trim();
    if (!c || !allProducts) return;
    const found = allProducts.find(
      (p) => (p.pdv_short_code || "").toLowerCase() === c.toLowerCase(),
    );
    if (found) {
      addItem(found);
      setCode("");
    }
  };
  return (
  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    {topSlot && <div className="shrink-0">{topSlot}</div>}
    {/* Busca + código curto */}
    <div className="px-3 pt-2.5 pb-2 shrink-0 flex gap-2">
      <div className="relative">
        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text" inputMode="numeric" placeholder="Cód"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitCode(); }}
          className="w-20 pl-7 pr-2 py-2.5 bg-muted/40 rounded-xl text-sm font-black pdv-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
          title="Código curto do produto (Enter pra adicionar)"
        />
      </div>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text" placeholder="Buscar produto..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2.5 bg-muted/40 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>

    {/* Abas de seção */}
    {!hideSectionTabs && sections.length > 0 && !search && (
      <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar shrink-0">
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
    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-1.5">
              {items.map((product) => {
                const qty = getQty(product.id);
                return (
                  <div key={product.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${qty > 0 ? "bg-primary/5 border-primary/25 shadow-sm" : "bg-card border-border/60 hover:bg-muted/20"}`}
                    onClick={() => addItem(product)}>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-11 h-11 rounded-lg object-cover shrink-0 border border-border/30" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border/30">
                        <span className="text-base font-bold text-muted-foreground">{product.name[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {product.pdv_short_code && (
                          <span className="pdv-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {product.pdv_short_code}
                          </span>
                        )}
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{product.name}</p>
                      </div>
                      <p className={`text-sm font-black mt-0.5 pdv-mono ${qty > 0 ? "text-primary" : "text-muted-foreground"}`}>{formatBRL(Number(product.price))}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {qty > 0 && (
                        <>
                          <button onClick={() => decItem(product.id)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center active:scale-90">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-6 text-center text-sm font-black">{qty}</span>
                        </>
                      )}
                      <button onClick={() => addItem(product)} className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 shadow-sm ${qty > 0 ? "bg-primary shadow-primary/30" : "bg-primary/80 hover:bg-primary shadow-primary/20"}`}>
                        <Plus className="h-4 w-4 text-primary-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
};