/**
 * TELA 3 — CÓPIA DE TESTE (/admin-teste) de src/components/menu/ProductCard.tsx.
 * Idêntica ao original, EXCETO (só apresentação/usabilidade, sem mudar
 * dados, cálculos, preços nem o fluxo de salvar — o gate de validação
 * continua sendo o validateProductForm do MenuBuilderTeste):
 *  1. Selo de status SEMPRE visível no card (Ativo/Pausado/Esgotado) com
 *     o vocabulário de badges da Tela 1: Ativo = "entregue" (verde),
 *     Pausado = "aviso" (âmbar), Esgotado = "novo" (vermelho).
 *  2. Botão "Pausar"/"Reativar" VISÍVEL no card, em 1 toque direto em
 *     onToggleAvailable — sem abrir o menu "Mais ações" (o item do menu
 *     continua existindo, como antes).
 *  3. Botão "Editar" COM RÓTULO visível (não só o ícone de lápis).
 *  4. Foto em destaque no formulário (primeiro bloco, borda tracejada
 *     em destaque); card sem foto mostra o aviso "Adicionar foto".
 *  5. Campo de preço ROTULADO "Preço" (antes só "R$" solto) e nome com
 *     rótulo visível (antes só placeholder).
 *  6. Erro INLINE no campo: nome/preço sem valor mostra o erro junto ao
 *     campo na tentativa de salvar (o toast do MenuBuilderTeste continua
 *     existindo; o formulário continua chamando onSave como antes).
 *  7. Card mostra a seção do produto ("Seção: X" ou "Sem seção").
 *  8. Preço do card usa AdminMoneyTeste (fonte tabular, Tela 1) e o
 *     botão "Salvar Produto" usa AdminButtonTeste (h-12, Tela 1).
 * A seção obrigatória em si vive no ProductSheetTeste (modo criar).
 */
import { memo, useRef, useState, useEffect } from "react";
import { AdminBadgeTeste, AdminMoneyTeste, AdminButtonTeste } from "./AdminBaseTeste";
import { formatBRL } from "@/lib/utils";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import {
  Trash2, Edit2, Package, PackageX, Pause, Play, ArrowRightLeft, Link2, X, Upload, Loader2, MoreVertical, ChevronDown, Link as LinkIcon, Copy, ChefHat,
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
  farmacias: "💊 Farmácia",
  petshop: "🐾 Petshop",
  adegas: "🍷 Adegas",
  padaria: "🥖 Padaria",
  acai: "🍨 Açaí",
  sorvetes: "🍦 Sorvetes",
  hortifruti: "🥬 Hortifruti",
  salao: "💇 Salão",
  roupas: "👗 Roupas",
};

export const ProductFormInlineTeste = ({ initial, onSave, onCancel, storeCategory, storeId, storeCategories, onChange }: ProductFormInlineProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<ProductFormData>(initial || EMPTY_FORM);
  // Tela 3, item 7: erro INLINE. "attempted" marca que o lojista tentou
  // salvar; os erros aparecem junto aos campos, sem mudar o fluxo: o
  // onSave continua sendo chamado e o gate segue no MenuBuilderTeste.
  const [attempted, setAttempted] = useState(false);
  const nameError = attempted && !form.name.trim() ? "Preencha o nome do produto" : undefined;
  const priceError = attempted && (!form.price || Number(form.price) <= 0) ? "Preencha o preço do produto" : undefined;
  const weightError =
    attempted && (form.metadata as any)?.sold_by_weight && !(Number((form.metadata as any)?.price_per_kg ?? 0) > 0)
      ? "Defina o preço por kg para vender por peso"
      : undefined;
  const handleSave = () => {
    setAttempted(true);
    onSave(form);
  };

  const availableCategories = (storeCategories && storeCategories.length > 0)
    ? Array.from(new Set(storeCategories.filter(Boolean)))
    : (storeCategory ? [storeCategory] : []);
  const effectiveCategory: string | undefined =
    (form.metadata as any)?.product_category
    || (availableCategories.length > 0 ? availableCategories[0] : storeCategory);

  useEffect(() => { onChange?.(form); }, [form, onChange]);

  // Em lojas multi-categoria, garante que `metadata.product_category` seja
  // gravado no produto mesmo que o usuário NÃO abra o seletor — sem isso,
  // "Monte a Pizza" no PDV nunca acha produtos (o filtro exige a tag).
  useEffect(() => {
    if (availableCategories.length <= 1) return;
    const current = (form.metadata as any)?.product_category;
    if (current) return;
    const initialCat = availableCategories[0];
    if (!initialCat) return;
    setForm((p) => ({ ...p, metadata: { ...(p.metadata || {}), product_category: initialCat } }));
  }, [availableCategories, form.metadata]);
  
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
      {/* Tela 3, item 4: foto em DESTAQUE — primeiro bloco do formulário. */}
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
        <label className="text-sm font-bold text-foreground">Foto do produto</label>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} className="hidden" />
        {form.image_url ? (
          <div className="flex items-center gap-3">
            <img loading="lazy" decoding="async" src={form.image_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            <div className="flex flex-col items-start gap-1">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary text-sm font-bold hover:underline">Trocar foto</button>
              <button type="button" onClick={handleRemoveImage} className="text-destructive text-sm hover:underline">Remover foto</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 bg-background text-foreground px-3 py-3.5 rounded-xl text-sm font-bold border border-border hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Upload className="h-4 w-4" /> Adicionar foto do produto</>}
          </button>
        )}
        <p className="text-xs text-muted-foreground">A foto aparece para o cliente no cardápio. PNG, JPG ou WEBP.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="product-name-teste" className="text-sm font-bold text-foreground">Nome do produto *</label>
        <input
          id="product-name-teste"
          type="text"
          placeholder="Nome do produto *"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          aria-invalid={!!nameError}
          className={`w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border focus:border-primary focus:outline-none font-medium ${nameError ? "border-destructive" : "border-border"}`}
        />
        {nameError && <p role="alert" className="text-sm font-medium text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="product-price-teste" className="text-sm font-bold text-foreground">Preço</label>
        <div className={`flex items-center gap-1.5 bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border focus-within:border-primary ${priceError ? "border-destructive" : "border-border"}`}>
          <span className="text-muted-foreground font-bold">R$</span>
          <input
            id="product-price-teste"
            type="text"
            placeholder="0,00"
            value={priceDisplay}
            onChange={handlePriceChange}
            aria-invalid={!!priceError}
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            inputMode="numeric"
          />
        </div>
        {priceError && <p role="alert" className="text-sm font-medium text-destructive">{priceError}</p>}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="product-description-teste" className="text-sm font-bold text-foreground">Descrição</label>
        <input
          id="product-description-teste"
          type="text"
          placeholder="Ex.: Açaí 500ml com leite ninho e morango"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
        />
      </div>
      {availableCategories.length > 1 && (
        <div className="space-y-1">
          <label htmlFor="product-category" className="text-xs font-bold text-foreground/70">Categoria do produto</label>
          <select
            id="product-category"
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

      {weightError && <p role="alert" className="text-sm font-medium text-destructive">{weightError}</p>}

      {/* Vender por peso agora é exclusivo do PDV — criar pela tela do PDV (botão "Novo produto por peso"). */}

      {/* Controle de estoque - simples */}
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Controlar estoque?</p>
            <p className="text-xs text-muted-foreground">Baixa sozinho a cada venda</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!(form.metadata as any)?.track_stock}
            onClick={() => setForm((p) => ({
              ...p,
              metadata: { ...(p.metadata || {}), track_stock: !(p.metadata as any)?.track_stock }
            }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${!!(form.metadata as any)?.track_stock ? "bg-green-600" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${!!(form.metadata as any)?.track_stock ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {!!(form.metadata as any)?.track_stock && (
          <div className="space-y-2 pt-1">
            {(form.metadata as any)?.current_stock !== undefined ? (
              /* Modo edição: mostra estoque atual (somente leitura) */
              <div className="bg-background rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Estoque atual</p>
                <p className="text-2xl font-bold">
                  {(form.metadata as any).current_stock} <span className="text-sm font-normal">unidades</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Para ajustar, use a aba <strong>Estoque</strong> no menu Cardápio
                </p>
              </div>
            ) : (
              /* Modo criação: permite definir estoque inicial */
              <div>
                <label className="text-xs font-medium">Quantas tem agora?</label>
                <input
                  type="number"
                  min="0"
                  value={(form.metadata as any)?.initial_stock || ""}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    metadata: { ...(p.metadata || {}), initial_stock: e.target.value }
                  }))}
                  placeholder="Ex: 50"
                  className="w-full bg-background px-3 py-2.5 rounded-lg text-base border border-border focus:border-primary focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Avisar quando chegar em</label>
              <input
                type="number"
                min="0"
                value={(form.metadata as any)?.min_stock || ""}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  metadata: { ...(p.metadata || {}), min_stock: e.target.value }
                }))}
                placeholder="Ex: 10"
                className="w-full bg-background px-3 py-2.5 rounded-lg text-base border border-border focus:border-primary focus:outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Vamos avisar quando faltar pouco
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <AdminButtonTeste type="button" onClick={handleSave} className="flex-1">
          Salvar Produto
        </AdminButtonTeste>
        <AdminButtonTeste type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </AdminButtonTeste>
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
  onOpenRecipe?: () => void;
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
  storeCategories?: string[];
  isMoving: boolean;
  onStartMove: () => void;
  onCancelMove: () => void;
  onMoveProduct: (productId: string, targetSectionId: string | null) => void;
}

/** Selo de status do produto (Tela 3, item 1) no vocabulário da Tela 1:
 *  Ativo = "entregue" (verde), Pausado = "aviso" (âmbar),
 *  Esgotado = "novo" (vermelho). Precedência igual à original: pausado
 *  vence esgotado quando os dois estão marcados. */
const getProductStatusTeste = (product: any): { variant: "entregue" | "aviso" | "novo"; label: string } => {
  const isOOS = !!product?.metadata?.out_of_stock;
  if (isOOS && product.is_available) return { variant: "novo", label: "Esgotado" };
  if (!product.is_available) return { variant: "aviso", label: "Pausado" };
  return { variant: "entregue", label: "Ativo" };
};

const ProductCardTesteImpl = (props: ProductCardProps) => {
  const {
    product, sections, addonGroups, linkedGroups, storeAddonGroups, linkedGroupIds,
    selected, onToggleSelect, onLinkGroup, onUnlinkGroup, showLinkAddon, setShowLinkAddon,
    onToggleAvailable, onToggleOutOfStock, onDelete, onEdit, onDuplicate, onOpenRecipe, isEditing, initialEditForm, onSaveEdit, onCancelEdit,
    onCopyLink,
    showAddonForm, setShowAddonForm, addonGroupForm, setAddonGroupForm,
    onAddAddonGroup, onDeleteAddonGroup, showAddonItemForm, setShowAddonItemForm,
    addonItemForm, setAddonItemForm, onAddAddonItem, onDeleteAddonItem,
    storeCategory, storeId, storeCategories, isMoving, onStartMove, onCancelMove, onMoveProduct,
  } = props;

  const isOOS = !!product?.metadata?.out_of_stock;
  const [showAddonActions, setShowAddonActions] = useState(false);
  const hasAnyAddons = (linkedGroups?.length || 0) + (addonGroups?.length || 0) > 0;

  if (isEditing) {
    return (
      <ProductFormInlineTeste
        initial={initialEditForm}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
        storeCategory={storeCategory}
        storeId={storeId}
        storeCategories={storeCategories}
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
          <button
            type="button"
            onClick={onEdit}
            aria-label="Adicionar foto"
            title="Adicionar foto"
            className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-dashed border-border hover:bg-muted/70 transition-colors"
          >
            <Package className="h-5 w-5 text-muted-foreground/50" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
            {(() => {
              const status = getProductStatusTeste(product);
              return <AdminBadgeTeste variant={status.variant}>{status.label}</AdminBadgeTeste>;
            })()}
          </div>
          {product.description && <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>}
          {/* Tela 3, item 6: o card mostra a seção do produto. */}
          <p className="text-xs text-muted-foreground">
            Seção:{" "}
            <span className={sections?.find((s: any) => s.id === product.section_id) ? "font-bold text-foreground" : "font-bold text-amber-600"}>
              {sections?.find((s: any) => s.id === product.section_id)?.name || "Sem seção"}
            </span>
          </p>
          {!product.image_url && (
            <button type="button" onClick={onEdit} className="mt-0.5 text-xs font-bold text-primary hover:underline">
              Adicionar foto
            </button>
          )}
          <div className="flex items-center justify-between mt-1">
            <AdminMoneyTeste value={formatBRL(Number(product.price))} className="text-primary font-black" />
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Tela 3, item 2: pausar em 1 toque, sem abrir o menu. */}
              <button
                onClick={onToggleAvailable}
                className="inline-flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-xs font-bold text-foreground"
                title={product.is_available ? "Pausar produto" : "Reativar produto"}
              >
                {product.is_available ? (
                  <><Pause className="h-4 w-4 text-amber-600" /> Pausar</>
                ) : (
                  <><Play className="h-4 w-4 text-primary" /> Reativar</>
                )}
              </button>
              {/* Tela 3, item 3: "Editar" com rótulo visível. */}
              <button onClick={onEdit} className="inline-flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-xs font-bold text-foreground" title="Editar produto">
                <Edit2 className="h-4 w-4" /> Editar
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
                  {onOpenRecipe && (
                    <DropdownMenuItem onClick={onOpenRecipe}>
                      <ChefHat className="h-4 w-4 mr-2 text-orange-600" /> Ficha técnica
                    </DropdownMenuItem>
                  )}
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

export const ProductCardTeste = memo(ProductCardTesteImpl);
