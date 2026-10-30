import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Shirt, Trash2, Upload, X, Check } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/compressImage";

interface Props {
  storeId: string;
}

interface Variant {
  size: string;
  color: string;
  stock: number;
  sku?: string;
  barcode?: string;
  price?: number;
}

const SIZE_PRESETS: { label: string; sizes: string }[] = [
  { label: "P–GG", sizes: "PP, P, M, G, GG" },
  { label: "P–G", sizes: "P, M, G" },
  { label: "34–46", sizes: "34, 36, 38, 40, 42, 44, 46" },
  { label: "Único", sizes: "Único" },
  { label: "Infantil", sizes: "2, 4, 6, 8, 10, 12" },
];

const COLOR_SUGGESTIONS = [
  "Preto", "Branco", "Azul", "Vermelho", "Verde",
  "Amarelo", "Rosa", "Roxo", "Cinza", "Marrom", "Bege", "Estampado",
];

/**
 * Cadastro de modelo (SKU-pai) + gerador automático de variantes tamanho × cor.
 * Ao salvar chama `apparel_create_product_with_variants` no Supabase.
 */
export default function ApparelProductForm({ storeId }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sizesRaw, setSizesRaw] = useState("P, M, G, GG");
  const [colorsRaw, setColorsRaw] = useState("Preto, Branco");
  const [initialStock, setInitialStock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState<Variant[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

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

  const totalStock = grid.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

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
        .select("product_id, size, color, stock_qty, sku")
        .in("product_id", ids);
      const byProd = new Map<string, any[]>();
      (vars || []).forEach((v: any) => {
        if (!byProd.has(v.product_id)) byProd.set(v.product_id, []);
        byProd.get(v.product_id)!.push(v);
      });
      return (prods || []).map((p: any) => ({ ...p, variants: byProd.get(p.id) || [] }));
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login primeiro"); return; }
      const compressed = await compressImage(file, { maxDim: 1024, quality: 0.75, forceWebp: true }).catch(() => file);
      const ext = compressed.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/products/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, compressed, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success("Foto enviada!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const updateVariant = (i: number, patch: Partial<Variant>) => {
    const next = [...grid];
    next[i] = { ...next[i], ...patch };
    setManual(next);
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    setManual([]);
    setImageUrl("");
  };

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
        _image_url: imageUrl || null,
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
      resetForm();
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
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
            <Shirt className="h-5 w-5 text-fuchsia-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Novo modelo</h3>
            <p className="text-[11px] text-muted-foreground">Cadastre o modelo e gere a grade de tamanhos × cores</p>
          </div>
        </div>

        {/* Foto + Nome + Preço */}
        <div className="flex gap-3">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden shrink-0 bg-muted/30"
          >
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                <span
                  onClick={(e) => { e.stopPropagation(); setImageUrl(""); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </span>
              </>
            ) : uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Upload className="h-5 w-5" />
                <span className="text-[9px] font-bold mt-1">Foto</span>
              </div>
            )}
          </button>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold">
              Nome do modelo *
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Camiseta Básica"
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm font-normal focus:border-primary focus:outline-none"
              />
            </label>
            <label className="text-xs font-bold">
              Preço base (R$) *
              <div className="mt-1 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-muted/40 focus-within:border-primary">
                <span className="text-muted-foreground font-bold text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="49,90"
                  className="flex-1 min-w-0 bg-transparent text-sm font-normal focus:outline-none"
                />
              </div>
            </label>
          </div>
        </div>

        {/* Tamanhos com presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold">Tamanhos</label>
            <div className="flex gap-1 flex-wrap">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setSizesRaw(p.sizes); setManual([]); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                    sizesRaw === p.sizes
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:border-primary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <input
            value={sizesRaw}
            onChange={(e) => { setSizesRaw(e.target.value); setManual([]); }}
            placeholder="P, M, G, GG"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Cores com sugestões */}
        <div>
          <label className="text-xs font-bold block mb-1.5">Cores</label>
          <input
            value={colorsRaw}
            onChange={(e) => { setColorsRaw(e.target.value); setManual([]); }}
            placeholder="Preto, Branco, Azul..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm focus:border-primary focus:outline-none"
          />
          <div className="flex gap-1 flex-wrap mt-1.5">
            {COLOR_SUGGESTIONS.map((c) => {
              const active = colors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const next = active ? colors.filter((x) => x !== c) : [...colors, c];
                    setColorsRaw(next.join(", "));
                    setManual([]);
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/40"
                      : "bg-muted/40 text-muted-foreground border-border hover:border-fuchsia-500/50"
                  }`}
                >
                  {active ? <Check className="h-3 w-3 inline mr-0.5" /> : null}{c}
                </button>
              );
            })}
          </div>
        </div>

        <label className="text-xs font-bold block">
          Estoque inicial por variante
          <input
            type="number"
            min="0"
            value={initialStock}
            onChange={(e) => { setInitialStock(Number(e.target.value) || 0); setManual([]); }}
            className="mt-1 w-32 px-3 py-2.5 rounded-xl border border-border bg-muted/40 text-sm font-normal focus:border-primary focus:outline-none"
          />
        </label>

        {/* Grade de variantes */}
        {grid.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                Grade — {grid.length} variantes
              </p>
              <p className="text-[11px] text-muted-foreground">
                Estoque total: <b className="text-foreground">{totalStock}</b> peças
              </p>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 px-2 font-bold">Tamanho</th>
                      <th className="py-2 px-2 font-bold">Cor</th>
                      <th className="py-2 px-2 font-bold w-24">Estoque</th>
                      <th className="py-2 px-2 font-bold">SKU</th>
                      <th className="py-2 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((v, i) => (
                      <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="py-1.5 px-2 font-bold whitespace-nowrap">{v.size || "—"}</td>
                        <td className="py-1.5 px-2 whitespace-nowrap">{v.color || "—"}</td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateVariant(i, { stock: Math.max(0, (Number(v.stock) || 0) - 1) })}
                              className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-sm font-bold hover:bg-muted"
                            >−</button>
                            <input
                              type="number"
                              min="0"
                              value={v.stock}
                              onChange={(e) => updateVariant(i, { stock: Number(e.target.value) || 0 })}
                              className="w-14 px-1.5 py-1 rounded-md border border-border bg-muted/40 text-center text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => updateVariant(i, { stock: (Number(v.stock) || 0) + 1 })}
                              className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-sm font-bold hover:bg-muted"
                            >+</button>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            value={v.sku || ""}
                            onChange={(e) => updateVariant(i, { sku: e.target.value })}
                            placeholder="SKU opcional"
                            className="w-28 px-2 py-1 rounded-md border border-border bg-muted/40 text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <button
                            onClick={() => setManual(grid.filter((_, j) => j !== i))}
                            className="text-red-500/70 hover:text-red-500 p-1"
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
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Preço base: <b className="text-foreground">{formatBRL(Number(price || 0))}</b>
          </p>
          <button
            onClick={save}
            disabled={saving || !name.trim() || !price || !grid.length}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 disabled:opacity-40 shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvar modelo
          </button>
        </div>
      </div>

      {/* Modelos cadastrados */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Modelos cadastrados</h3>
          <span className="text-[11px] text-muted-foreground">{products?.length || 0} modelos</span>
        </div>
        {!products?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shirt className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-xs font-medium">Nenhum modelo cadastrado ainda</p>
            <p className="text-[11px] mt-1">Use o formulário acima para criar o primeiro</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p: any) => {
              const stockTotal = p.variants.reduce((s: number, v: any) => s + (Number(v.stock_qty) || 0), 0);
              return (
                <div key={p.id} className="border border-border rounded-xl p-3 hover:border-primary/30 transition-colors">
                  <div className="flex gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                        <Shirt className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold truncate">{p.name}</p>
                        <p className="text-sm font-black text-primary whitespace-nowrap">{formatBRL(Number(p.price))}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.variants.length} variantes · {stockTotal} peças em estoque
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {p.variants.slice(0, 8).map((v: any, i: number) => (
                      <span
                        key={i}
                        title={v.sku ? `SKU: ${v.sku}` : undefined}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          Number(v.stock_qty) > 0
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 border-red-500/30"
                        }`}
                      >
                        {v.size || "—"}/{v.color || "—"} · {v.stock_qty}
                      </span>
                    ))}
                    {p.variants.length > 8 && (
                      <span className="text-[10px] px-2 py-0.5 text-muted-foreground font-bold">
                        +{p.variants.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
