import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ruler, Tag, Plus, X, Download, Eye, EyeOff } from "lucide-react";
import {
  readPizzaCatalogConfig,
  slugifySizeName,
  type PizzaSizeCatalogItem,
  type PizzaFlavorCategory,
  type PizzaPriceMatrix,
} from "@/types/pizza";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";

interface Props {
  storeId: string;
}

const DEFAULT_CATEGORIES: PizzaFlavorCategory[] = [
  { id: "tradicional", name: "Tradicional" },
  { id: "especial", name: "Especial" },
  { id: "premium", name: "Premium" },
  { id: "doce", name: "Doce" },
];

const PriceCell = ({
  value,
  onCommit,
}: { value: number; onCommit: (v: number) => void }) => {
  const [display, setDisplay] = useState(value > 0 ? formatBRLDisplay(value) : "");
  const [editing, setEditing] = useState(false);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? display : value > 0 ? formatBRLDisplay(value) : ""}
      placeholder="—"
      onFocus={() => { setEditing(true); setDisplay(value > 0 ? formatBRLDisplay(value) : ""); }}
      onChange={(e) => {
        const raw = e.target.value;
        if (!raw.replace(/\D/g, "")) { setDisplay(""); return; }
        setDisplay(formatBRLDisplay(parseBRLCentsInput(raw)));
      }}
      onBlur={() => {
        setEditing(false);
        const n = display ? parseBRLCentsInput(display) : 0;
        if (n !== value) onCommit(n);
      }}
      className="w-full bg-transparent text-center text-xs font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-primary/5 rounded py-1"
    />
  );
};

const PizzaSizesCatalogManager = ({ storeId }: Props) => {
  const qc = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-for-pizza-catalog", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
  });

  const settings = (store?.settings || {}) as Record<string, any>;
  const cfg = useMemo(() => readPizzaCatalogConfig(settings), [settings]);

  const [newSizeName, setNewSizeName] = useState("");
  const [newSizeDesc, setNewSizeDesc] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [importing, setImporting] = useState(false);

  const saveSettings = async (patch: Record<string, any>) => {
    const newSettings = { ...settings, ...patch };
    const { error } = await supabase.from("stores").update({ settings: newSettings }).eq("id", storeId);
    if (error) { toast.error("Erro ao salvar"); return; }
    qc.invalidateQueries({ queryKey: ["store-for-pizza-catalog", storeId] });
    qc.invalidateQueries({ queryKey: ["store-for-pizza", storeId] });
    qc.invalidateQueries({ queryKey: ["store-settings-for-category", storeId] });
  };

  // ─── Tamanhos ──────────────────────────────────────────────────────────
  const addSize = async () => {
    const name = newSizeName.trim();
    if (!name) return;
    let id = slugifySizeName(name);
    if (cfg.sizes.some((s) => s.id === id)) id = `${id}-${cfg.sizes.length + 1}`;
    const next: PizzaSizeCatalogItem[] = [
      ...cfg.sizes,
      { id, name, description: newSizeDesc.trim() || undefined, active: true },
    ];
    await saveSettings({ pizza_sizes_catalog: next });
    setNewSizeName(""); setNewSizeDesc("");
    toast.success(`Tamanho "${name}" criado`);
  };
  const updateSize = async (id: string, patch: Partial<PizzaSizeCatalogItem>) => {
    const next = cfg.sizes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    await saveSettings({ pizza_sizes_catalog: next });
  };
  const removeSize = async (id: string) => {
    const size = cfg.sizes.find((s) => s.id === id);
    if (!size) return;
    if (!window.confirm(`Remover "${size.name}"? Os preços na matriz serão apagados.`)) return;
    const nextSizes = cfg.sizes.filter((s) => s.id !== id);
    const nextMatrix: PizzaPriceMatrix = {};
    for (const [catId, row] of Object.entries(cfg.priceMatrix)) {
      const { [id]: _drop, ...rest } = row;
      nextMatrix[catId] = rest;
    }
    await saveSettings({ pizza_sizes_catalog: nextSizes, pizza_price_matrix: nextMatrix });
  };

  // ─── Categorias ────────────────────────────────────────────────────────
  const ensureDefaults = async () => {
    if (cfg.categories.length === 0) {
      await saveSettings({ pizza_flavor_categories: DEFAULT_CATEGORIES });
      toast.success("Categorias padrão criadas");
    }
  };
  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    let id = slugifySizeName(name);
    if (cfg.categories.some((c) => c.id === id)) id = `${id}-${cfg.categories.length + 1}`;
    const next = [...cfg.categories, { id, name }];
    await saveSettings({ pizza_flavor_categories: next });
    setNewCatName("");
    toast.success(`Categoria "${name}" criada`);
  };
  const removeCategory = async (id: string) => {
    const cat = cfg.categories.find((c) => c.id === id);
    if (!cat) return;
    if (!window.confirm(`Remover "${cat.name}"? Sabores ficarão sem categoria.`)) return;
    const nextCats = cfg.categories.filter((c) => c.id !== id);
    const { [id]: _drop, ...nextMatrix } = cfg.priceMatrix;
    await saveSettings({ pizza_flavor_categories: nextCats, pizza_price_matrix: nextMatrix });
  };
  const renameCategory = async (id: string, name: string) => {
    const next = cfg.categories.map((c) => (c.id === id ? { ...c, name } : c));
    await saveSettings({ pizza_flavor_categories: next });
  };

  // ─── Matriz ────────────────────────────────────────────────────────────
  const setMatrixPrice = async (catId: string, sizeId: string, price: number) => {
    const nextMatrix: PizzaPriceMatrix = {
      ...cfg.priceMatrix,
      [catId]: { ...(cfg.priceMatrix[catId] || {}), [sizeId]: price },
    };
    await saveSettings({ pizza_price_matrix: nextMatrix });
  };

  // ─── Importar do legado ────────────────────────────────────────────────
  const importFromLegacy = async () => {
    setImporting(true);
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, price, metadata")
        .eq("store_id", storeId);
      if (error) throw error;
      const sizesMap = new Map<string, { name: string; prices: number[] }>();
      for (const p of (products || [])) {
        const sizes = Array.isArray((p.metadata as any)?.sizes) ? (p.metadata as any).sizes : [];
        for (const s of sizes) {
          if (!s?.name || !(Number(s.price) > 0)) continue;
          const id = slugifySizeName(s.name);
          const cur = sizesMap.get(id) || { name: s.name, prices: [] };
          cur.prices.push(Number(s.price));
          sizesMap.set(id, cur);
        }
      }
      if (sizesMap.size === 0) { toast.error("Nenhum tamanho encontrado nos produtos."); return; }
      const newSizes: PizzaSizeCatalogItem[] = Array.from(sizesMap.entries()).map(([id, v]) => ({
        id, name: v.name, active: true,
      }));
      const tradicionalId = "tradicional";
      const newCats: PizzaFlavorCategory[] = cfg.categories.length > 0 ? cfg.categories : DEFAULT_CATEGORIES;
      const newMatrix: PizzaPriceMatrix = { ...cfg.priceMatrix };
      newMatrix[tradicionalId] = { ...(newMatrix[tradicionalId] || {}) };
      for (const [sizeId, v] of sizesMap.entries()) {
        // mediana das observações como preço base
        const sorted = [...v.prices].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] || 0;
        if (!newMatrix[tradicionalId][sizeId]) newMatrix[tradicionalId][sizeId] = median;
      }
      await saveSettings({
        pizza_sizes_catalog: newSizes,
        pizza_flavor_categories: newCats,
        pizza_price_matrix: newMatrix,
      });
      toast.success(`${newSizes.length} tamanho(s) importado(s) com preços medianos em "Tradicional".`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao importar");
    } finally {
      setImporting(false);
    }
  };

  const catalogReady = cfg.sizes.length > 0 && cfg.categories.length > 0;

  return (
    <div className="space-y-5">
      {/* Banner explicativo */}
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
          ⚡ Catálogo Profissional (recomendado)
        </p>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          Define os <b>tamanhos</b> uma vez na loja e uma <b>tabela de preços por categoria de sabor</b>
          (Tradicional, Especial, Premium...). Cada novo sabor só escolhe a categoria — o preço sai automático.
          É o padrão que iFood, Anota AI e Goomer usam.
        </p>
        {!catalogReady && (
          <button
            type="button"
            onClick={importFromLegacy}
            disabled={importing}
            className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {importing ? "Importando..." : "Importar tamanhos existentes"}
          </button>
        )}
      </div>

      {/* 1) Tamanhos da pizzaria */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black text-foreground">Tamanhos da pizzaria</h3>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Ex.: Broto, Média, Grande 35cm, Família 45cm. Aplicam-se a todos os sabores.
        </p>

        <div className="space-y-2">
          {cfg.sizes.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
              <div className="flex-1 min-w-0 space-y-1">
                <input
                  type="text"
                  defaultValue={s.name}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.name) updateSize(s.id, { name: e.target.value.trim() }); }}
                  className="w-full bg-transparent text-sm font-bold text-foreground focus:outline-none"
                />
                <input
                  type="text"
                  defaultValue={s.description || ""}
                  placeholder="Descrição (ex: 8 fatias · 35cm)"
                  onBlur={(e) => { if (e.target.value !== (s.description || "")) updateSize(s.id, { description: e.target.value.trim() || undefined }); }}
                  className="w-full bg-transparent text-[11px] text-muted-foreground focus:outline-none"
                />
              </div>
              <select
                value={s.maxFlavors || 0}
                onChange={(e) => updateSize(s.id, { maxFlavors: Number(e.target.value) ? Number(e.target.value) as 2|3|4 : undefined })}
                className="text-[10px] bg-background border border-border rounded-lg px-1.5 py-1"
                title="Máx. sabores neste tamanho"
              >
                <option value={0}>auto</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
              <button
                type="button"
                onClick={() => updateSize(s.id, { active: !s.active })}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary"
                title={s.active ? "Ocultar do cliente" : "Mostrar"}
              >
                {s.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
              </button>
              <button
                type="button"
                onClick={() => removeSize(s.id)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <input
            type="text"
            value={newSizeName}
            onChange={(e) => setNewSizeName(e.target.value)}
            placeholder="Nome (ex: Grande 35cm)"
            className="flex-1 min-w-[140px] bg-muted text-foreground px-2.5 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={newSizeDesc}
            onChange={(e) => setNewSizeDesc(e.target.value)}
            placeholder="Descrição"
            className="flex-1 min-w-[120px] bg-muted text-foreground px-2.5 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={addSize}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Tamanho
          </button>
        </div>
      </div>

      {/* 2) Categorias de sabor */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">Categorias de sabor</h3>
          </div>
          {cfg.categories.length === 0 && (
            <button type="button" onClick={ensureDefaults} className="text-[11px] font-bold text-primary underline">
              Usar padrões
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Cada sabor é classificado em uma categoria e herda o preço da matriz abaixo.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {cfg.categories.map((c) => (
            <span key={c.id} className="bg-primary/15 text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
              <input
                type="text"
                defaultValue={c.name}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.name) renameCategory(c.id, e.target.value.trim()); }}
                className="bg-transparent focus:outline-none w-auto min-w-[60px]"
                style={{ width: `${Math.max(c.name.length, 6)}ch` }}
              />
              <button onClick={() => removeCategory(c.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Nova categoria (ex: Especial)"
            className="flex-1 bg-muted text-foreground px-2.5 py-1.5 rounded-lg text-xs border border-border focus:border-primary focus:outline-none"
          />
          <button type="button" onClick={addCategory} className="bg-primary/20 text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 3) Matriz de preços */}
      {catalogReady && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-black text-foreground">Tabela de preços (categoria × tamanho)</h3>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Preencha o preço base. Cada sabor pode sobrescrever no cadastro do produto.
          </p>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase pb-1 pr-2">Categoria</th>
                  {cfg.sizes.map((s) => (
                    <th key={s.id} className="text-center text-[10px] font-bold text-muted-foreground uppercase pb-1 px-1">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="text-xs font-bold text-foreground pr-2 whitespace-nowrap">{cat.name}</td>
                    {cfg.sizes.map((s) => (
                      <td key={s.id} className="bg-muted/30 rounded-lg px-1 min-w-[72px]">
                        <PriceCell
                          value={cfg.priceMatrix[cat.id]?.[s.id] || 0}
                          onCommit={(v) => setMatrixPrice(cat.id, s.id, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PizzaSizesCatalogManager;