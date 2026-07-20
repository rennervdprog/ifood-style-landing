import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Loader2, Search, Shirt, X, ArrowLeft, Tag } from "lucide-react";
import type { Product } from "@/pages/pdv/types";
import LabelPrintDialog, { type LabelData } from "./LabelPrintDialog";

interface Variant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  stock_qty: number;
  price_override: number | null;
  sku: string | null;
  barcode: string | null;
  active: boolean;
}

interface Props {
  storeId: string;
  products: Product[];
  addItem: (p: Product) => void;
  getQty: (id: string) => number;
}

/**
 * Layout de venda para lojas boutique: card por modelo com foto grande + chip
 * de cores; clique abre matriz tamanho × cor e cada célula adiciona a variante
 * ao carrinho, respeitando o estoque atual (`product_variants.stock_qty`).
 */
export default function ApparelCatalogGrid({ storeId, products, addItem, getQty }: Props) {
  const [search, setSearch] = useState("");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);

  const { data: variants = [], isLoading, refetch } = useQuery({
    queryKey: ["apparel-variants", storeId],
    enabled: !!storeId,
    staleTime: 15_000,
    queryFn: async () => {
      const ids = products.map((p) => p.id);
      if (!ids.length) return [] as Variant[];
      const { data } = await supabase
        .from("product_variants" as any)
        .select("id, product_id, size, color, stock_qty, price_override, sku, barcode, active")
        .in("product_id", ids)
        .eq("active", true);
      return ((data || []) as unknown) as Variant[];
    },
  });

  // Realtime: reflete decremento de estoque instantâneo em outros terminais
  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`variants-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants" },
        () => refetch(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, refetch]);

  const byProduct = useMemo(() => {
    const m = new Map<string, Variant[]>();
    variants.forEach((v) => {
      if (!m.has(v.product_id)) m.set(v.product_id, []);
      m.get(v.product_id)!.push(v);
    });
    return m;
  }, [variants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => byProduct.has(p.id) && (!q || p.name.toLowerCase().includes(q)));
  }, [products, byProduct, search]);

  const totalStock = (pid: string) =>
    (byProduct.get(pid) || []).reduce((s, v) => s + Number(v.stock_qty || 0), 0);

  const uniqueColors = (pid: string) =>
    Array.from(new Set((byProduct.get(pid) || []).map((v) => v.color).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="px-3 pt-2.5 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar modelo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2.5 bg-muted/40 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shirt className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum modelo com grade cadastrada.</p>
            <p className="text-xs mt-1 opacity-70">Cadastre em Cardápio → Modelos & Grade.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.map((p) => {
              const stock = totalStock(p.id);
              const colors = uniqueColors(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setOpenProduct(p)}
                  className="text-left bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/40 active:scale-[0.98] transition-all"
                >
                  <div className="aspect-square bg-muted/40 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Shirt className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
                    <p className="text-sm font-black text-primary pdv-mono">{formatBRL(Number(p.price))}</p>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex -space-x-1">
                        {colors.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            title={c}
                            className="w-3 h-3 rounded-full border border-border bg-muted"
                          />
                        ))}
                        {colors.length > 4 && (
                          <span className="text-[9px] text-muted-foreground ml-1">+{colors.length - 4}</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          stock === 0
                            ? "bg-red-500/10 text-red-600"
                            : stock < 5
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {stock} pçs
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openProduct && (
        <VariantMatrixSheet
          product={openProduct}
          variants={byProduct.get(openProduct.id) || []}
          onClose={() => setOpenProduct(null)}
          addItem={addItem}
          getQty={getQty}
        />
      )}
    </div>
  );
}

function VariantMatrixSheet({
  product, variants, onClose, addItem, getQty,
}: {
  product: Product;
  variants: Variant[];
  onClose: () => void;
  addItem: (p: Product) => void;
  getQty: (id: string) => number;
}) {
  const [labels, setLabels] = useState<LabelData[] | null>(null);
  const { sizes, colors, matrix } = useMemo(() => {
    const sSet = new Set<string>();
    const cSet = new Set<string>();
    variants.forEach((v) => {
      sSet.add(v.size || "—");
      cSet.add(v.color || "—");
    });
    const s = Array.from(sSet);
    const c = Array.from(cSet);
    const m = new Map<string, Variant>();
    variants.forEach((v) => m.set(`${v.size || "—"}::${v.color || "—"}`, v));
    return { sizes: s, colors: c, matrix: m };
  }, [variants]);

  const handleCellClick = (v: Variant) => {
    if (v.stock_qty <= 0) return;
    // ID composto pra virar linha independente no carrinho por variante
    const compositeId = `${product.id}::${v.id}`;
    const variantLabel = [v.size, v.color].filter(Boolean).join(" · ");
    const pseudo: Product = {
      ...product,
      id: compositeId,
      name: `${product.name}${variantLabel ? ` (${variantLabel})` : ""}`,
      price: v.price_override != null ? Number(v.price_override) : Number(product.price),
      metadata: {
        ...(product.metadata || {}),
        apparel_variant_id: v.id,
        apparel_parent_product_id: product.id,
        apparel_size: v.size,
        apparel_color: v.color,
      },
      // Estes campos garantem que o addItem trate como produto simples
      sold_by_weight: false,
    } as any;
    addItem(pseudo);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground pdv-mono">{formatBRL(Number(product.price))}</p>
          </div>
          <button
            onClick={() =>
              setLabels(
                variants
                  .filter((v) => v.stock_qty > 0 || v.barcode || v.sku)
                  .map((v) => ({
                    productName: product.name,
                    size: v.size,
                    color: v.color,
                    price: v.price_override != null ? Number(v.price_override) : Number(product.price),
                    sku: v.sku,
                    barcode: v.barcode || v.sku,
                  })),
              )
            }
            className="flex items-center gap-1 text-[11px] font-bold bg-muted/60 hover:bg-muted rounded-lg px-2 py-1.5"
            title="Imprimir etiquetas"
          >
            <Tag className="h-3.5 w-3.5" /> Etiquetas
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <table className="w-full text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground font-bold px-2">Tam \ Cor</th>
                {colors.map((c) => (
                  <th key={c} className="text-center text-muted-foreground font-bold px-2 py-1">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s}>
                  <td className="font-black text-sm px-2 py-1">{s}</td>
                  {colors.map((c) => {
                    const v = matrix.get(`${s}::${c}`);
                    if (!v) {
                      return (
                        <td key={c} className="text-center text-muted-foreground/30 py-2">—</td>
                      );
                    }
                    const compositeId = `${product.id}::${v.id}`;
                    const inCart = getQty(compositeId);
                    const out = v.stock_qty <= 0;
                    return (
                      <td key={c} className="p-0">
                        <button
                          onClick={() => handleCellClick(v)}
                          disabled={out}
                          className={`w-full min-h-[52px] rounded-xl border-2 font-bold text-sm flex flex-col items-center justify-center transition-all active:scale-95 ${
                            out
                              ? "bg-red-500/5 border-red-500/20 text-red-500/40 cursor-not-allowed"
                              : inCart > 0
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : v.stock_qty < 3
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:border-amber-500/60"
                              : "bg-emerald-500/5 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500/60"
                          }`}
                        >
                          <span className="pdv-mono text-base leading-tight">{v.stock_qty}</span>
                          {inCart > 0 && (
                            <span className="text-[9px] opacity-90">+{inCart} carrinho</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[11px] text-muted-foreground mt-4 text-center">
            Toque numa célula pra adicionar. Vermelho = sem estoque.
          </p>
        </div>
      </div>
      {labels && <LabelPrintDialog items={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}