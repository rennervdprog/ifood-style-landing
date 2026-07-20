import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Loader2, Save, Palette, Hash } from "lucide-react";

interface Section { id: string; name: string; sort_order: number; pdv_color: string | null }
interface Product { id: string; name: string; section_id: string | null; pdv_short_code: string | null; pdv_sort_order: number | null }

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
];

/**
 * Editor "Teclas PDV": lista seções (com cor) + produtos (com código curto e ordenação),
 * salva direto em menu_sections.pdv_color, products.pdv_short_code/pdv_sort_order.
 */
export function PdvQuickGridEditor({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: sections = [], isFetching: sectLoading } = useQuery({
    queryKey: ["pdv-editor-sections", storeId],
    enabled: open && !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_sections")
        .select("id, name, sort_order, pdv_color" as any)
        .eq("store_id", storeId)
        .order("sort_order");
      return ((data as any) || []) as Section[];
    },
  });

  const { data: products = [], isFetching: prodLoading } = useQuery({
    queryKey: ["pdv-editor-products", storeId],
    enabled: open && !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, section_id, pdv_short_code, pdv_sort_order" as any)
        .eq("store_id", storeId)
        .order("pdv_sort_order", { ascending: true, nullsFirst: false })
        .order("name");
      return ((data as any) || []) as Product[];
    },
  });

  const [localSections, setLocalSections] = useState<Record<string, Partial<Section>>>({});
  const [localProducts, setLocalProducts] = useState<Record<string, Partial<Product>>>({});
  const [saving, setSaving] = useState(false);

  const patchSection = (id: string, p: Partial<Section>) =>
    setLocalSections((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  const patchProduct = (id: string, p: Partial<Product>) =>
    setLocalProducts((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const getSection = (s: Section): Section => ({ ...s, ...localSections[s.id] });
  const getProduct = (p: Product): Product => ({ ...p, ...localProducts[p.id] });

  const move = (list: Product[], id: string, dir: -1 | 1) => {
    const merged = list.map(getProduct);
    const idx = merged.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= merged.length) return;
    const a = merged[idx], b = merged[swap];
    const aOrder = a.pdv_sort_order ?? idx;
    const bOrder = b.pdv_sort_order ?? swap;
    patchProduct(a.id, { pdv_sort_order: bOrder });
    patchProduct(b.id, { pdv_sort_order: aOrder });
  };

  const save = async () => {
    setSaving(true);
    try {
      const sUpdates = Object.entries(localSections);
      for (const [id, patch] of sUpdates) {
        await (supabase.from("menu_sections") as any)
          .update({ pdv_color: patch.pdv_color ?? null })
          .eq("id", id);
      }
      const pUpdates = Object.entries(localProducts);
      for (const [id, patch] of pUpdates) {
        const payload: Record<string, any> = {};
        if ("pdv_short_code" in patch) payload.pdv_short_code = (patch.pdv_short_code || null) as any;
        if ("pdv_sort_order" in patch) payload.pdv_sort_order = patch.pdv_sort_order ?? null;
        if (Object.keys(payload).length) {
          await (supabase.from("products") as any).update(payload).eq("id", id);
        }
      }
      toast.success("Teclas PDV salvas.");
      setLocalSections({});
      setLocalProducts({});
      qc.invalidateQueries({ queryKey: ["pdv-editor-sections", storeId] });
      qc.invalidateQueries({ queryKey: ["pdv-editor-products", storeId] });
      qc.invalidateQueries({ queryKey: ["pdv-products", storeId] });
      qc.invalidateQueries({ queryKey: ["pdv-sections", storeId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const dirty = Object.keys(localSections).length + Object.keys(localProducts).length > 0;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <span className="font-black text-sm">Teclas rápidas do PDV</span>
          <span className="text-[10px] text-muted-foreground font-semibold">
            Código curto · cor da categoria · ordem
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-5">
          {sectLoading || prodLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Cor por categoria */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Cor das categorias</p>
                </div>
                <div className="space-y-2">
                  {sections.map((s) => {
                    const cur = getSection(s);
                    return (
                      <div key={s.id} className="flex items-center gap-2 bg-muted/20 rounded-xl p-2">
                        <span className="text-xs font-bold flex-1 truncate">{s.name}</span>
                        <div className="flex items-center gap-1">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              onClick={() => patchSection(s.id, { pdv_color: c })}
                              style={{ background: c }}
                              className={`w-5 h-5 rounded-full border-2 ${cur.pdv_color === c ? "border-foreground" : "border-transparent"}`}
                              title={c}
                            />
                          ))}
                          <button
                            onClick={() => patchSection(s.id, { pdv_color: null })}
                            className="text-[10px] font-bold text-muted-foreground px-1.5"
                          >
                            reset
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Código curto + ordem por produto */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Produtos</p>
                </div>
                <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                  {products.map((p, i) => {
                    const cur = getProduct(p);
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-muted/20 rounded-lg p-2">
                        <div className="flex flex-col">
                          <button
                            onClick={() => move(products, p.id, -1)}
                            disabled={i === 0}
                            className="w-6 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                            aria-label="Subir"
                          ><ChevronUp className="h-3 w-3" /></button>
                          <button
                            onClick={() => move(products, p.id, 1)}
                            disabled={i === products.length - 1}
                            className="w-6 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                            aria-label="Descer"
                          ><ChevronDown className="h-3 w-3" /></button>
                        </div>
                        <input
                          value={cur.pdv_short_code || ""}
                          onChange={(e) => patchProduct(p.id, { pdv_short_code: e.target.value.slice(0, 6) })}
                          placeholder="cód"
                          maxLength={6}
                          className="w-16 px-2 py-1.5 text-center pdv-mono font-black text-xs bg-background rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <span className="text-xs font-semibold flex-1 truncate">{p.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={!dirty || saving}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar teclas
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}