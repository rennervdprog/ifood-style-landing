import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { Loader2, Plus, Pencil, Trash2, Layers, X, GripVertical } from "lucide-react";

interface Slot { name: string; product_ids: string[] }
interface Combo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  slots: Slot[] | null;
  active: boolean;
  sort_order: number;
  printer_target?: string | null;
}

interface Product { id: string; name: string; price: number; section_id: string | null }

/** CRUD de combos do modo Lanches (snack_bar). */
export default function SnackBarCombosManager({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Combo | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: combos, isLoading } = useQuery({
    queryKey: ["snackbar-combos-admin", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("combo_definitions")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as Combo[]) ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["snackbar-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,section_id")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return (data as Product[]) ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["snackbar-combos-admin", storeId] });
    qc.invalidateQueries({ queryKey: ["snackbar-combos", storeId] });
  };

  const toggleActive = async (c: Combo) => {
    const { error } = await (supabase as any)
      .from("combo_definitions").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    invalidate();
  };
  const remove = async (c: Combo) => {
    if (!confirm(`Excluir combo "${c.name}"?`)) return;
    const { error } = await (supabase as any).from("combo_definitions").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Combo excluído");
    invalidate();
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-6" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" /> Combos
          </h2>
          <p className="text-[11px] text-muted-foreground">Combos aparecem no topo do catálogo do PDV.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 bg-primary text-primary-foreground font-bold px-3 py-2 rounded-lg text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      </div>

      {(combos ?? []).length === 0 && (
        <div className="text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl py-8">
          Nenhum combo cadastrado ainda.
        </div>
      )}

      <div className="grid gap-2">
        {(combos ?? []).map((c) => (
          <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${c.active ? "border-primary/40 bg-card" : "border-border bg-muted/30 opacity-70"}`}>
            {c.image_url
              ? <img src={c.image_url} alt={c.name} className="w-14 h-14 rounded-lg object-cover" />
              : <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center"><Layers className="h-5 w-5 text-primary/40" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{c.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {formatBRL(Number(c.price))} · {Array.isArray(c.slots) ? c.slots.length : 0} etapa(s)
              </p>
            </div>
            <button onClick={() => toggleActive(c)} className={`text-[10px] font-bold px-2 py-1 rounded ${c.active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              {c.active ? "ATIVO" : "OFF"}
            </button>
            <button onClick={() => setEditing(c)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={() => remove(c)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <ComboForm
          storeId={storeId}
          combo={editing}
          products={products ?? []}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { invalidate(); setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function ComboForm({ storeId, combo, products, onClose, onSaved }: {
  storeId: string;
  combo: Combo | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(combo?.name ?? "");
  const [description, setDescription] = useState(combo?.description ?? "");
  const [price, setPrice] = useState<string>(combo?.price != null ? String(combo.price) : "");
  const [imageUrl, setImageUrl] = useState(combo?.image_url ?? "");
  const [printerTarget, setPrinterTarget] = useState<string>(combo?.printer_target ?? "both");
  const [slots, setSlots] = useState<Slot[]>(
    Array.isArray(combo?.slots) && combo!.slots!.length > 0
      ? (combo!.slots as Slot[])
      : [{ name: "Lanche", product_ids: [] }],
  );
  const [saving, setSaving] = useState(false);

  const addSlot = () => setSlots((s) => [...s, { name: `Etapa ${s.length + 1}`, product_ids: [] }]);
  const rmSlot = (i: number) => setSlots((s) => s.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));
  const toggleProduct = (i: number, pid: string) => {
    setSlots((s) => s.map((sl, idx) => {
      if (idx !== i) return sl;
      const has = sl.product_ids.includes(pid);
      return { ...sl, product_ids: has ? sl.product_ids.filter((x) => x !== pid) : [...sl.product_ids, pid] };
    }));
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome ao combo");
    const priceNum = parseFloat(price.replace(",", "."));
    if (!priceNum || priceNum <= 0) return toast.error("Informe um preço válido");
    setSaving(true);
    const payload: any = {
      store_id: storeId,
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      image_url: imageUrl.trim() || null,
      slots: slots.filter((s) => s.name.trim() && s.product_ids.length > 0),
      active: true,
      printer_target: printerTarget,
    };
    const { error } = combo
      ? await (supabase as any).from("combo_definitions").update(payload).eq("id", combo.id)
      : await (supabase as any).from("combo_definitions").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(combo ? "Combo atualizado" : "Combo criado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-black">{combo ? "Editar combo" : "Novo combo"}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm" placeholder="Combo Big Burguer" /></Field>
          <Field label="Descrição"><textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm" placeholder="Lanche + Batata M + Refri lata" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Preço (R$)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm" placeholder="29,90" /></Field>
            <Field label="Impressora">
              <select value={printerTarget} onChange={(e) => setPrinterTarget(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm">
                <option value="both">Cozinha + Balcão</option>
                <option value="kitchen">Só cozinha</option>
                <option value="counter">Só balcão</option>
              </select>
            </Field>
          </div>
          <Field label="URL da imagem (opcional)"><input value={imageUrl ?? ""} onChange={(e) => setImageUrl(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm" placeholder="https://..." /></Field>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold">Etapas do combo</p>
              <button onClick={addSlot} className="text-[10px] font-bold text-primary flex items-center gap-1"><Plus className="h-3 w-3" />Etapa</button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">O operador escolhe UM item por etapa ao vender.</p>
            <div className="space-y-3">
              {slots.map((sl, i) => (
                <div key={i} className="rounded-lg border border-border p-2 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <input value={sl.name} onChange={(e) => updateSlot(i, { name: e.target.value })} className="flex-1 h-8 px-2 rounded border border-border bg-background text-xs font-bold" placeholder="Ex.: Lanche, Bebida" />
                    <button onClick={() => rmSlot(i)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 gap-1 pr-1">
                    {products.map((p) => {
                      const sel = sl.product_ids.includes(p.id);
                      return (
                        <label key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${sel ? "bg-primary/10 border border-primary/40" : "hover:bg-muted"}`}>
                          <input type="checkbox" checked={sel} onChange={() => toggleProduct(i, p.id)} />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-muted-foreground">{formatBRL(Number(p.price))}</span>
                        </label>
                      );
                    })}
                    {products.length === 0 && <p className="text-[11px] text-muted-foreground italic p-2">Cadastre produtos primeiro.</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-border font-bold text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}