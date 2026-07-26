import { memo, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flame, Plus, Trash2, Edit2, Save, X, Tag, Star, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";

interface Props {
  storeId: string;
}

interface PromoCollection {
  id: string;
  store_id: string;
  name: string;
  subtitle: string | null;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

type ProductRow = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  promo_active: boolean;
  promo_price: number | null;
  promo_collection_id: string | null;
  is_bestseller: boolean;
};

const PromotionsTab = memo(({ storeId }: Props) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"products" | "collections">("products");

  const { data: collections = [], isLoading: loadingCol } = useQuery({
    queryKey: ["promo-collections", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("promo_collections")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as PromoCollection[];
    },
    enabled: !!storeId,
  });

  const { data: products = [], isLoading: loadingProd } = useQuery({
    queryKey: ["promo-products", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id, name, price, image_url, promo_active, promo_price, promo_collection_id, is_bestseller")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return (data || []) as ProductRow[];
    },
    enabled: !!storeId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["promo-products", storeId] });
    qc.invalidateQueries({ queryKey: ["promo-collections", storeId] });
    qc.invalidateQueries({ queryKey: ["products", storeId] });
    qc.invalidateQueries({ queryKey: ["store-promo-collections", storeId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Flame className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground">Promoções</h2>
          <p className="text-xs text-muted-foreground">Crie ofertas com preço promocional e coleções temáticas.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === "products" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Produtos em promoção
        </button>
        <button
          onClick={() => setTab("collections")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === "collections" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          Coleções
        </button>
      </div>

      {tab === "products" ? (
        <ProductsPromoList
          products={products}
          collections={collections}
          loading={loadingProd}
          onChanged={invalidate}
        />
      ) : (
        <CollectionsList
          collections={collections}
          loading={loadingCol}
          storeId={storeId}
          onChanged={invalidate}
        />
      )}
    </div>
  );
});

PromotionsTab.displayName = "PromotionsTab";
export default PromotionsTab;

// ====================== PRODUCTS LIST ======================
const ProductsPromoList = ({
  products, collections, loading, onChanged,
}: {
  products: ProductRow[];
  collections: PromoCollection[];
  loading: boolean;
  onChanged: () => void;
}) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );
  const inPromo = filtered.filter(p => p.promo_active);
  const others = filtered.filter(p => !p.promo_active);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-card text-foreground px-3 py-2.5 rounded-xl text-sm border border-border focus:border-primary focus:outline-none"
      />

      {loading && <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-primary" /></div>}

      {!loading && (
        <>
          {inPromo.length > 0 && (
            <section>
              <p className="text-xs font-black uppercase text-orange-500 mb-2 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" /> Em promoção ({inPromo.length})
              </p>
              <div className="space-y-2">
                {inPromo.map(p => (
                  <PromoProductRow key={p.id} product={p} collections={collections} onChanged={onChanged} />
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Todos os produtos</p>
            <div className="space-y-2">
              {others.map(p => (
                <PromoProductRow key={p.id} product={p} collections={collections} onChanged={onChanged} />
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto encontrado.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const PromoProductRow = ({
  product, collections, onChanged,
}: { product: ProductRow; collections: PromoCollection[]; onChanged: () => void }) => {
  const [editing, setEditing] = useState(product.promo_active);
  const [promoPrice, setPromoPrice] = useState(
    product.promo_price ? formatBRLDisplay(Number(product.promo_price)) : ""
  );
  const [collectionId, setCollectionId] = useState<string>(product.promo_collection_id || "");
  const [bestseller, setBestseller] = useState(!!product.is_bestseller);
  const [saving, setSaving] = useState(false);

  const handleSave = async (activate: boolean) => {
    setSaving(true);
    const numericPromo = promoPrice ? parseBRLCentsInput(promoPrice) : 0;
    if (activate && (!numericPromo || numericPromo <= 0)) {
      toast.error("Defina o preço promocional");
      setSaving(false);
      return;
    }
    if (activate && numericPromo >= Number(product.price)) {
      toast.error("Preço promocional deve ser menor que o preço normal");
      setSaving(false);
      return;
    }
    const { error } = await (supabase as any)
      .from("products")
      .update({
        promo_active: activate,
        promo_price: activate ? numericPromo : null,
        promo_collection_id: collectionId || null,
        is_bestseller: bestseller,
      })
      .eq("id", product.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(activate ? "Promoção ativada!" : "Promoção desativada");
    onChanged();
    if (!activate) setEditing(false);
  };

  return (
    <div className={`rounded-xl border p-3 ${product.promo_active ? "border-orange-500/40 bg-orange-500/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        {product.image_url ? (
          <img src={product.image_url} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
          <p className="text-xs">
            <span className={product.promo_active ? "line-through text-muted-foreground" : "text-foreground font-bold"}>
              {formatBRL(Number(product.price))}
            </span>
            {product.promo_active && product.promo_price && (
              <span className="ml-1.5 font-black text-orange-600">{formatBRL(Number(product.promo_price))}</span>
            )}
          </p>
        </div>
        {!editing && !product.promo_active && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Plus className="h-3 w-3 inline mr-1" />Promoção
          </button>
        )}
        {!editing && product.promo_active && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted"
          >
            <Edit2 className="h-3 w-3 inline mr-1" />Editar
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <label className="block text-xs font-bold text-foreground">Preço promocional</label>
          <div className="flex items-center gap-1.5 bg-card text-foreground px-3 py-2 rounded-lg text-sm border border-border focus-within:border-primary">
            <span className="text-muted-foreground font-bold">R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={promoPrice}
              onChange={(e) => {
                const n = parseBRLCentsInput(e.target.value);
                setPromoPrice(n > 0 ? formatBRLDisplay(n) : "");
              }}
              placeholder="0,00"
              className="flex-1 bg-transparent focus:outline-none"
            />
          </div>

          {collections.length > 0 && (
            <>
              <label className="block text-xs font-bold text-foreground mt-2">Coleção (opcional)</label>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full bg-card text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
              >
                <option value="">— Sem coleção —</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ""}{c.name}</option>
                ))}
              </select>
            </>
          )}

          <label className="flex items-center gap-2 text-xs font-bold text-foreground mt-2">
            <input
              type="checkbox"
              checked={bestseller}
              onChange={(e) => setBestseller(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Star className="h-3.5 w-3.5 text-amber-500" />
            Marcar como "+ Vendido"
          </label>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              Ativar promoção
            </button>
            {product.promo_active && (
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                Desativar
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ====================== COLLECTIONS LIST ======================
const CollectionsList = ({
  collections, loading, storeId, onChanged,
}: { collections: PromoCollection[]; loading: boolean; storeId: string; onChanged: () => void }) => {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setCreating(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" /> Nova coleção de promoção
      </button>

      {creating && (
        <CollectionForm storeId={storeId} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); onChanged(); }} />
      )}

      {loading && <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-primary" /></div>}

      {!loading && collections.length === 0 && !creating && (
        <div className="text-center py-10 text-sm text-muted-foreground bg-card rounded-xl border border-border border-dashed">
          <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhuma coleção ainda. Crie uma para agrupar produtos em promoção (ex: "Promoção Copa do Mundo").
        </div>
      )}

      {collections.map(c => (
        <CollectionRow key={c.id} collection={c} storeId={storeId} onChanged={onChanged} />
      ))}
    </div>
  );
};

const CollectionForm = ({
  storeId, initial, onClose, onSaved,
}: { storeId: string; initial?: PromoCollection; onClose: () => void; onSaved: () => void }) => {
  const [name, setName] = useState(initial?.name || "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle || "");
  const [emoji, setEmoji] = useState(initial?.emoji || "🔥");
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = { store_id: storeId, name: name.trim(), subtitle: subtitle.trim() || null, emoji: emoji.trim() || null, is_active: active };
    const q = initial
      ? (supabase as any).from("promo_collections").update(payload).eq("id", initial.id)
      : (supabase as any).from("promo_collections").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Coleção atualizada!" : "Coleção criada!");
    onSaved();
  };

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="🔥"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="w-16 bg-background text-center text-foreground px-2 py-2.5 rounded-lg text-lg border border-border focus:border-primary focus:outline-none"
          maxLength={4}
        />
        <input
          type="text"
          placeholder="Nome da coleção (ex: PROMOÇÃO RUMO AO HEXA)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none font-bold"
        />
      </div>
      <input
        type="text"
        placeholder="Subtítulo (opcional, ex: PROMOÇÕES COPA DO MUNDO)"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
      />
      <label className="flex items-center gap-2 text-xs font-bold text-foreground">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-primary" />
        Coleção ativa (aparece na loja)
      </label>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
        <button onClick={onClose} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const CollectionRow = ({
  collection, storeId, onChanged,
}: { collection: PromoCollection; storeId: string; onChanged: () => void }) => {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <CollectionForm storeId={storeId} initial={collection} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />;
  }

  const toggleActive = async () => {
    const { error } = await (supabase as any)
      .from("promo_collections")
      .update({ is_active: !collection.is_active })
      .eq("id", collection.id);
    if (error) { toast.error(error.message); return; }
    toast.success(collection.is_active ? "Coleção desativada" : "Coleção ativada");
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Excluir coleção "${collection.name}"? Os produtos não serão excluídos, apenas desvinculados.`)) return;
    const { error } = await (supabase as any).from("promo_collections").delete().eq("id", collection.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Coleção excluída");
    onChanged();
  };

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${collection.is_active ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card opacity-70"}`}>
      <span className="text-2xl">{collection.emoji || "🏷️"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-foreground truncate">{collection.name}</p>
        {collection.subtitle && <p className="text-xs text-muted-foreground truncate">{collection.subtitle}</p>}
        {!collection.is_active && <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Inativa</p>}
      </div>
      <button onClick={toggleActive} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted">
        {collection.is_active ? "Pausar" : "Ativar"}
      </button>
      <button onClick={() => setEditing(true)} className="p-2 rounded-lg hover:bg-muted">
        <Edit2 className="h-4 w-4 text-foreground" />
      </button>
      <button onClick={remove} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};