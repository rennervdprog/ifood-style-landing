import { memo, useRef, useState, useEffect } from "react";
import { formatBRL } from "@/lib/utils";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import {
  Trash2, Edit2, Package, PackageX, Pause, Play, ArrowRightLeft, Link2, X, Upload, Loader2, MoreVertical, ChevronDown, Link as LinkIcon, Copy,
} from "lucide-react";
import CategoryProductFields from "@/components/CategoryProductFields";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ---------- Upload helper ----------
const uploadProductImage = async (file: File): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error("Faça login primeiro"); return null; }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  if (!["png", "jpg", "jpeg", "webp"].includes(ext)) { toast.error("Use PNG, JPG ou WEBP."); return null; }
  const compressed = await compressImage(file, { maxDim: 1024, quality: 0.75, forceWebp: true }).catch(() => file);
  const finalExt = compressed.type === "image/webp" ? "webp" : (compressed.type === "image/png" ? "png" : "jpg");
  const filePath = `${user.id}/products/${Date.now()}.${finalExt}`;
  const { error } = await supabase.storage.from("store-assets").upload(filePath, compressed, { upsert: true });
  if (error) { toast.error("Erro ao enviar imagem"); return null; }
  const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(filePath);
  return urlData.publicUrl;
};

// ---------- Price helpers ----------
const formatPriceInput = (value: string) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? `R$ ${formatBRLDisplay(num)}` : "";
};
const normalizePriceInput = (value: string) => {
  const nextValue = parseBRLCentsInput(value);
  return nextValue > 0 ? nextValue.toFixed(2) : "";
};

// ---------- Product Form (estado 100% local) ----------
export interface ProductFormData {
  name: string;
  price: string;
  description: string;
  image_url: string;
  metadata: Record<string, any>;
}
const EMPTY_FORM: ProductFormData = { name: "", price: "", description: "", image_url: "", metadata: {} };

// ---------- Vender por peso (PDV) ----------
const WeightToggleField = ({
  metadata,
  onChange,
}: {
  metadata: Record<string, any>;
  onChange: (m: Record<string, any>) => void;
}) => {
  const enabled = !!metadata?.sold_by_weight;
  const priceKg = Number(metadata?.price_per_kg ?? 0);
  const [display, setDisplay] = useState(priceKg > 0 ? formatBRLDisplay(priceKg) : "");

  const setEnabled = (v: boolean) => {
    const next: Record<string, any> = { ...metadata, sold_by_weight: v };
    if (!v) {
      delete next.price_per_kg;
      delete next.weight_unit;
    } else {
      next.weight_unit = "kg";
    }
    onChange(next);
  };

  const setPricePerKg = (raw: string) => {
    if (!raw.replace(/\D/g, "")) {
      setDisplay("");
      onChange({ ...metadata, price_per_kg: 0, sold_by_weight: true, weight_unit: "kg" });
      return;
    }
    const n = parseBRLCentsInput(raw);
    setDisplay(formatBRLDisplay(n));
    onChange({ ...metadata, price_per_kg: n, sold_by_weight: true, weight_unit: "kg" });
  };

  const per100 = priceKg / 10;

  return (
    <div className="bg-background border border-border rounded-lg p-3 space-y-2">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-xs font-bold text-foreground">⚖️ Vender por peso (PDV)</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary cursor-pointer"
        />
      </label>
      {enabled && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-2 rounded-lg border border-border focus-within:border-primary">
            <span className="text-muted-foreground font-bold text-xs">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={display}
              onChange={(e) => setPricePerKg(e.target.value)}
              className="flex-1 min-w-0 bg-transparent focus:outline-none text-sm"
            />
            <span className="text-[11px] text-muted-foreground">por kg</span>
          </div>
          {priceKg > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Equivale a <b>R$ {formatBRLDisplay(per100)}</b> a cada 100 g.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            No PDV o operador digita o peso em gramas e o sistema calcula o valor.
          </p>
        </div>
      )}
    </div>
  );
};

interface ProductFormInlineProps {
  initial?: ProductFormData;
  onSave: (data: ProductFormData) => void;
  onCancel: () => void;
  storeCategory?: string;
  storeId?: string;
  storeCategories?: string[];
  onChange?: (data: ProductFormData) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  lanches: "🍔 Lanches",
  pizzas: "🍕 Pizzas",
  pasteis: "🥟 Pastéis",
  restaurante: "🍽️ Restaurante",
  bebidas: "🥤 Bebidas",
  doces: "🍰 Doces",
  mercado: "🛒 Mercado",
  farmacia: "💊 Farmácia",
  petshop: "🐾 Petshop",
  adegas: "🍷 Adegas",
  padaria: "🥖 Padaria",
  acai: "🍨 Açaí",
  sorvetes: "🍦 Sorvetes",
  hortifruti: "🥬 Hortifruti",
  salao: "💇 Salão",
  roupas: "👗 Roupas",
};

export const ProductFormInline = ({ initial, onSave, onCancel, storeCategory, storeId, storeCategories, onChange }: ProductFormInlineProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<ProductFormData>(initial || EMPTY_FORM);

  const availableCategories = (storeCategories && storeCategories.length > 0)
    ? Array.from(new Set(storeCategories.filter(Boolean)))
    : (storeCategory ? [storeCategory] : []);
  const effectiveCategory: string | undefined =
    (form.metadata as any)?.product_category
    || (availableCategories.length > 0 ? availableCategories[0] : storeCategory);

  useEffect(() => { onChange?.(form); }, [form, onChange]);
  
  // Estado local para o display do preço para evitar saltos e fechamento do teclado
  const [priceDisplay, setPriceDisplay] = useState(
    initial?.price ? formatBRLDisplay(Number(initial.price)) : ""
  );

  // Se houver override de preço por tamanho, o preço base do produto vira o MENOR override.
  useEffect(() => {
    const ov = (form.metadata?.pizza_size_overrides || {}) as Record<string, number>;
    const vals = Object.values(ov).map((v) => Number(v)).filter((n) => n > 0);
    if (!vals.length) return;
    const min = Math.min(...vals);
    const current = Number(form.price) || 0;
    if (Math.abs(current - min) < 0.005) return;
    setForm((p) => ({ ...p, price: min.toFixed(2) }));
    setPriceDisplay(formatBRLDisplay(min));
  }, [form.metadata?.pizza_size_overrides, form.price]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.replace(/\D/g, "")) {
      setPriceDisplay("");
      setForm(p => ({ ...p, price: "" }));
      return;
    }
    const n = parseBRLCentsInput(raw);
    const newDisplay = formatBRLDisplay(n);
    setPriceDisplay(newDisplay);
    setForm(p => ({ ...p, price: n.toFixed(2) }));
  };

  const handleRemoveImage = () => {
    const updatedForm = { ...form, image_url: "" };
    setForm(updatedForm);
    if (initial) onSave(updatedForm);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadProductImage(file);
    if (url) {
      const updatedForm = { ...form, image_url: url };
      setForm(updatedForm);
      if (initial) onSave(updatedForm);
    }
    setUploading(false);
  };

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
      <input
        type="text"
        placeholder="Nome do produto *"
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none font-medium"
      />
      <div className="flex gap-2">
        <div className="w-1/3 flex items-center gap-1.5 bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus-within:border-primary">
          <span className="text-muted-foreground font-bold">R$</span>
          <input
            type="text"
            placeholder="0,00"
            value={priceDisplay}
            onChange={handlePriceChange}
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            inputMode="numeric"
          />
        </div>
        <div className="flex-1">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} className="hidden" />
          {form.image_url ? (
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border">
              <img loading="lazy" decoding="async" src={form.image_url} alt="" className="w-8 h-8 rounded object-cover" />
              <button type="button" onClick={handleRemoveImage} className="text-destructive text-xs hover:underline">Remover</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary text-xs hover:underline">Trocar</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-background text-muted-foreground px-3 py-2.5 rounded-lg text-sm border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
            >
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Upload className="h-4 w-4" /> Foto</>}
            </button>
          )}
        </div>
      </div>
      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={form.description}
        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
      />

      {availableCategories.length > 1 && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground/70">Categoria do produto</label>
          <select
            value={effectiveCategory || ""}
            onChange={(e) => setForm((p) => ({ ...p, metadata: { ...(p.metadata || {}), product_category: e.target.value } }))}
            className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
          >
            {availableCategories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">Escolha a qual categoria da loja este produto pertence.</p>
        </div>
      )}

      {effectiveCategory && (
        <CategoryProductFields
          category={effectiveCategory}
          metadata={form.metadata || {}}
          onChange={(metadata: Record<string, any>) => setForm((p) => ({ ...p, metadata }))}
          onNameChange={(name: string) => {
            // Só preenche o nome se estiver vazio (não sobrescreve edição manual)
            setForm((p) => ({ ...p, name: p.name.trim() ? p.name : name }));
          }}

          storeId={storeId}
        />
      )}

      {/* Vender por peso agora é exclusivo do PDV — criar pela tela do PDV (botão "Novo produto por peso"). */}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onSave(form)} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
          Salvar Produto
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
};

// ---------- Product Card ----------
interface ProductCardProps {
  product: any;
  sections: any[];
  addonGroups: any[];
  linkedGroups: any[];
  storeAddonGroups: any[];
  linkedGroupIds: string[];
  selected: boolean;
  onToggleSelect: () => void;
  onLinkGroup: (gId: string) => void;
  onUnlinkGroup: (gId: string) => void;
  showLinkAddon: boolean;
  setShowLinkAddon: (v: boolean) => void;
  onToggleAvailable: () => void;
  onToggleOutOfStock: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate?: () => void;
  onCopyLink?: () => void;
  isEditing: boolean;
  initialEditForm?: ProductFormData;
  onSaveEdit: (data: ProductFormData) => void;
  onCancelEdit: () => void;
  showAddonForm: boolean;
  setShowAddonForm: (v: boolean) => void;
  addonGroupForm: { name: string; min_select: string; max_select: string };
  setAddonGroupForm: (f: any) => void;
  onAddAddonGroup: () => void;
  onDeleteAddonGroup: (id: string) => void;
  showAddonItemForm: string | null;
  setShowAddonItemForm: (v: string | null) => void;
  addonItemForm: { name: string; price: string };
  setAddonItemForm: (f: any) => void;
  onAddAddonItem: (groupId: string) => void;
  onDeleteAddonItem?: (id: string) => void;
  storeCategory?: string;
  storeId?: string;
  isMoving: boolean;
  onStartMove: () => void;
  onCancelMove: () => void;
  onMoveProduct: (productId: string, targetSectionId: string | null) => void;
}

const ProductCardImpl = (props: ProductCardProps) => {
  const {
    product, sections, addonGroups, linkedGroups, storeAddonGroups, linkedGroupIds,
    selected, onToggleSelect, onLinkGroup, onUnlinkGroup, showLinkAddon, setShowLinkAddon,
    onToggleAvailable, onToggleOutOfStock, onDelete, onEdit, onDuplicate, isEditing, initialEditForm, onSaveEdit, onCancelEdit,
    onCopyLink,
    showAddonForm, setShowAddonForm, addonGroupForm, setAddonGroupForm,
    onAddAddonGroup, onDeleteAddonGroup, showAddonItemForm, setShowAddonItemForm,
    addonItemForm, setAddonItemForm, onAddAddonItem, onDeleteAddonItem,
    storeCategory, storeId, isMoving, onStartMove, onCancelMove, onMoveProduct,
  } = props;

  const isOOS = !!product?.metadata?.out_of_stock;
  const [showAddonActions, setShowAddonActions] = useState(false);
  const hasAnyAddons = (linkedGroups?.length || 0) + (addonGroups?.length || 0) > 0;

  if (isEditing) {
    return (
      <ProductFormInline
        initial={initialEditForm}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
        storeCategory={storeCategory}
        storeId={storeId}
      />
    );
  }

  return (
    <div className={`bg-background rounded-xl p-3 border transition-all ${selected ? "border-primary ring-1 ring-primary" : isOOS ? "border-destructive/40" : "border-border"} ${!product.is_available ? "opacity-60" : ""} ${isMoving ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 accent-primary cursor-pointer flex-shrink-0"
          aria-label="Selecionar produto"
        />
        {product.image_url ? (
          <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
            {!product.is_available && (
              <span className="text-[10px] font-bold uppercase bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">Pausado</span>
            )}
            {isOOS && product.is_available && (
              <span className="text-[10px] font-bold uppercase bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded">Esgotado</span>
            )}
          </div>
          {product.description && <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>}
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-black text-primary">{formatBRL(Number(product.price))}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Editar">
                <Edit2 className="h-4 w-4 text-foreground" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Mais ações">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={onToggleAvailable}>
                    {product.is_available
                      ? <><Pause className="h-4 w-4 mr-2 text-yellow-500" /> Pausar produto</>
                      : <><Play className="h-4 w-4 mr-2 text-primary" /> Reativar produto</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleOutOfStock}>
                    {isOOS
                      ? <><Package className="h-4 w-4 mr-2 text-primary" /> Repor estoque</>
                      : <><PackageX className="h-4 w-4 mr-2 text-destructive" /> Marcar esgotado</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onStartMove}>
                    <ArrowRightLeft className="h-4 w-4 mr-2 text-muted-foreground" /> Mover de seção
                  </DropdownMenuItem>
                  {onDuplicate && (
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className="h-4 w-4 mr-2 text-muted-foreground" /> Duplicar produto
                    </DropdownMenuItem>
                  )}
                  {onCopyLink && (
                    <DropdownMenuItem onClick={onCopyLink}>
                      <LinkIcon className="h-4 w-4 mr-2 text-muted-foreground" /> Copiar link público
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir produto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Move to section picker */}
      {isMoving && sections && sections.length > 0 && (
        <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-primary">Mover para:</p>
          <div className="flex flex-wrap gap-1.5">
            {product.section_id && (
              <button onClick={() => onMoveProduct(product.id, null)} className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors">
                Sem Seção
              </button>
            )}
            {sections.filter((s: any) => s.id !== product.section_id).map((s: any) => (
              <button key={s.id} onClick={() => onMoveProduct(product.id, s.id)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-medium">
                {s.name}
              </button>
            ))}
          </div>
          <button onClick={onCancelMove} className="text-xs text-muted-foreground hover:text-foreground mt-1">Cancelar</button>
        </div>
      )}

      {/* Linked addon groups */}
      {linkedGroups && linkedGroups.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-primary/30 space-y-1">
          <span className="text-[10px] text-primary font-bold uppercase">🔗 Vinculados</span>
          {linkedGroups.map((group: any) => (
            <div key={group.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/80 font-bold">{group.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/70">{group.min_select > 0 ? `mín ${group.min_select}` : "opcional"}, máx {group.max_select}</span>
                  <button onClick={() => onUnlinkGroup(group.id)} className="text-yellow-500 p-0.5"><X className="h-3 w-3" /></button>
                </div>
              </div>
              {group.addon_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between pl-2 py-0.5">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="text-muted-foreground/70">+{formatBRL(Number(item.price))}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Direct addon groups */}
      {addonGroups.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-border space-y-1">
          {addonGroups.map((group: any) => (
            <div key={group.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/80 font-bold">{group.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/70">{group.min_select > 0 ? `mín ${group.min_select}` : "opcional"}, máx {group.max_select}</span>
                  <button onClick={() => onDeleteAddonGroup(group.id)} className="text-destructive/70 p-0.5"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
              {group.addon_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between pl-2 py-0.5">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground/70">+{formatBRL(Number(item.price))}</span>
                    <button onClick={() => onDeleteAddonItem?.(item.id)} className="text-destructive/70 p-0.5"><X className="h-2.5 w-2.5" /></button>
                  </div>
                </div>
              ))}
              {showAddonItemForm === group.id ? (
                <div className="flex gap-1 mt-1">
                  <input type="text" placeholder="Nome" value={addonItemForm.name}
                    onChange={(e: any) => setAddonItemForm({ ...addonItemForm, name: e.target.value })}
                    className="flex-1 bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus:outline-none" autoFocus />
                  <div className="w-20 flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus-within:border-primary">
                    <span className="text-muted-foreground font-bold">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={formatBRLDisplay(Number(addonItemForm.price))}
                      onChange={(e) => {
                        const n = parseBRLCentsInput(e.target.value);
                        setAddonItemForm({ ...addonItemForm, price: n.toFixed(2) });
                      }}
                      className="flex-1 min-w-0 bg-transparent focus:outline-none"
                      inputMode="numeric"
                    />
                  </div>
                  <button onClick={() => onAddAddonItem(group.id)} className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">+</button>
                  <button onClick={() => setShowAddonItemForm(null)} className="text-muted-foreground px-1 text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => setShowAddonItemForm(group.id)} className="text-primary text-xs mt-0.5 hover:underline">+ adicional</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link / Create addon */}
      {showLinkAddon ? (
        <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2 space-y-1">
          <p className="text-xs text-primary font-bold">🔗 Vincular Grupo</p>
          {storeAddonGroups.filter((g: any) => !linkedGroupIds.includes(g.id)).length > 0 ? (
            storeAddonGroups.filter((g: any) => !linkedGroupIds.includes(g.id)).map((g: any) => (
              <button key={g.id} onClick={() => { onLinkGroup(g.id); setShowLinkAddon(false); }}
                className="w-full text-left bg-background hover:bg-muted text-foreground px-3 py-2 rounded-lg text-xs transition-colors border border-border">
                <span className="font-bold">{g.name}</span>
                <span className="text-muted-foreground ml-2">({(g.addon_items as any[])?.length || 0} itens)</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-2">Nenhum grupo disponível. Crie na aba "Adicionais".</p>
          )}
          <button onClick={() => setShowLinkAddon(false)} className="text-muted-foreground text-xs">Cancelar</button>
        </div>
      ) : null}

      {/* Action row */}
      {!hasAnyAddons && !showAddonActions && !showLinkAddon && !showAddonForm && (
        <button
          onClick={() => setShowAddonActions(true)}
          className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ChevronDown className="h-3 w-3" /> Adicionais deste produto
        </button>
      )}
      {(hasAnyAddons || showAddonActions || showLinkAddon || showAddonForm) && (
      <div className="mt-2 flex flex-wrap gap-3">
        <button onClick={() => setShowLinkAddon(true)} className="text-xs text-primary hover:underline flex items-center gap-1" title="Reutiliza um grupo de adicionais já criado em outro produto">
          <Link2 className="h-3 w-3" /> Usar adicional existente
        </button>
        {showAddonForm ? (
          <div className="flex-1 bg-muted/30 rounded-lg p-2 space-y-1">
            <input type="text" placeholder="Nome do grupo (ex: Molhos)" value={addonGroupForm.name}
              onChange={(e) => setAddonGroupForm({ ...addonGroupForm, name: e.target.value })}
              className="w-full bg-background text-foreground px-2 py-1.5 rounded text-xs border border-border focus:outline-none" autoFocus />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Mín</label>
                <input type="number" value={addonGroupForm.min_select}
                  onChange={(e) => setAddonGroupForm({ ...addonGroupForm, min_select: e.target.value })}
                  className="w-full bg-background text-foreground px-2 py-1 rounded text-xs border border-border" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Máx</label>
                <input type="number" value={addonGroupForm.max_select}
                  onChange={(e) => setAddonGroupForm({ ...addonGroupForm, max_select: e.target.value })}
                  className="w-full bg-background text-foreground px-2 py-1 rounded text-xs border border-border" />
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={onAddAddonGroup} className="flex-1 bg-primary text-primary-foreground py-1.5 rounded text-xs font-bold">Criar</button>
              <button onClick={() => setShowAddonForm(false)} className="px-3 text-muted-foreground text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddonForm(true)} className="text-xs text-muted-foreground hover:underline" title="Cria adicionais que só aparecem neste produto">+ Criar adicional só deste produto</button>
        )}
      </div>
      )}
    </div>
  );
};

export const ProductCard = memo(ProductCardImpl);
