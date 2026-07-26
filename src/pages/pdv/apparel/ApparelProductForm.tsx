import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Shirt, Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Props {
  storeId: string;
}

interface Variant {
  size: string;
  color: string;
  stock: number;
  sku?: string;
  barcode?: string;
}

/**
 * Cadastro de modelo (SKU-pai) + gerador automático de variantes tamanho × cor.
 * Ao salvar chama `apparel_create_product_with_variants` no Supabase externo.
 */
export default function ApparelProductForm({ storeId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sizesRaw, setSizesRaw] = useState("P, M, G, GG");
  const [colorsRaw, setColorsRaw] = useState("Preto, Branco");
  const [initialStock, setInitialStock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState<Variant[]>([]);

  const sizes = useMemo(
    () => sizesRaw.split(",").map((s) => s.trim()).filter(Boolean),
    [sizesRaw],
  );
  const colors = useMemo(
    () => colorsRaw.split(",").map((s) => s.trim()).filter(Boolean),
    [colorsRaw],
  );

  const grid: Variant[] = useMemo(() => {
    if (manual.length) return manual;
    if (!sizes.length && !colors.length) return [];
    const s = sizes.length ? sizes : [""];
    const c = colors.length ? colors : [""];
    const out: Variant[] = [];
    for (const sz of s) for (const cl of c) out.push({ size: sz, color: cl, stock: initialStock });
    return out;
  }, [sizes, colors, initialStock, manual]);

  const { data: sectionId } = useQuery({
    queryKey: ["apparel-default-section", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_sections")
        .select("id")
        .eq("store_id", storeId)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      return (data as any)?.id ?? null;
    },
    enabled: !!storeId,
  });

  const { data: products, refetch: refetchProducts } = useQuery({
    queryKey: ["apparel-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      const ids = (prods || []).map((p: any) => p.id);
      if (!ids.length) return [];
      const { data: vars } = await supabase
        .from("product_variants" as any)
        .select("product_id, size, color, stock_qty")
        .in("product_id", ids);
      const byProd = new Map<string, any[]>();
      (vars || []).forEach((v: any) => {
        if (!byProd.has(v.product_id)) byProd.set(v.product_id, []);
        byProd.get(v.product_id)!.push(v);
      });
      return (prods || []).map((p: any) => ({ ...p, variants: byProd.get(p.id) || [] }));
    },
  });

  async function save() {
    if (!name.trim() || !price) return toast.error("Preencha nome e preço.");
    if (!grid.length) return toast.error("Defina tamanhos e/ou cores.");
    setSaving(true);
    try {
      const { error } = await supabase.rpc("apparel_create_product_with_variants" as any, {
        _store_id: storeId,
        _name: name.trim(),
        _price: Number(price),
        _section_id: sectionId,
        _image_url: null,
        _variants: grid.map((v) => ({
          size: v.size || null,
          color: v.color || null,
          stock_qty: v.stock ?? 0,
          sku: v.sku ?? null,
          barcode: v.barcode ?? null,
        })),
      });
      if (error) throw error;
      toast.success(`Modelo "${name}" criado com ${grid.length} variantes.`);
      setName("");
      setPrice("");
      setManual([]);
      qc.invalidateQueries({ queryKey: ["apparel-products", storeId] });
      qc.invalidateQueries({ queryKey: ["pdv-products", storeId] });
      refetchProducts();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shirt className="h-5 w-5 text-fuchsia-500" />
          <h3 className="text-sm font-bold">Novo modelo</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold col-span-2 sm:col-span-1">
            Nome do modelo
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Camiseta Básica"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-bold col-span-2 sm:col-span-1">
            Preço base (R$)
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="49.90"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-bold col-span-2 sm:col-span-1">
            Tamanhos (separe por vírgula)
            <input
              value={sizesRaw}
              onChange={(e) => { setSizesRaw(e.target.value); setManual([]); }}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-bold col-span-2 sm:col-span-1">
            Cores (separe por vírgula)
            <input
              value={colorsRaw}
              onChange={(e) => { setColorsRaw(e.target.value); setManual([]); }}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-bold col-span-2 sm:col-span-1">
            Estoque inicial por variante
            <input
              type="number"
              value={initialStock}
              onChange={(e) => { setInitialStock(Number(e.target.value) || 0); setManual([]); }}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm font-normal"
            />
          </label>
        </div>

        {grid.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
              Grade — {grid.length} variantes
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-2">Tamanho</th>
                    <th className="py-1.5 pr-2">Cor</th>
                    <th className="py-1.5 pr-2">Estoque</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((v, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1.5 pr-2 font-bold">{v.size || "—"}</td>
                      <td className="py-1.5 pr-2">{v.color || "—"}</td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          value={v.stock}
                          onChange={(e) => {
                            const next = [...grid];
                            next[i] = { ...next[i], stock: Number(e.target.value) || 0 };
                            setManual(next);
                          }}
                          className="w-20 px-2 py-1 rounded border border-border bg-muted/40"
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          onClick={() => setManual(grid.filter((_, j) => j !== i))}
                          className="text-red-500 p-1"
                          title="Remover variante"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Preço médio da grade: <b>{formatBRL(Number(price || 0))}</b>
          </p>
          <button
            onClick={save}
            disabled={saving || !name || !price || !grid.length}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm active:scale-95 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvar modelo
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold">Modelos cadastrados</h3>
        {!products?.length ? (
          <p className="text-xs text-muted-foreground">Nenhum modelo cadastrado ainda.</p>
        ) : (
          products.map((p: any) => (
            <div key={p.id} className="border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-xs pdv-mono font-black text-primary">{formatBRL(Number(p.price))}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {p.variants.map((v: any, i: number) => (
                  <span
                    key={i}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      Number(v.stock_qty) > 0
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 border-red-500/30"
                    }`}
                  >
                    {v.size || "—"}/{v.color || "—"} · {v.stock_qty}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}