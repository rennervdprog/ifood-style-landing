import { formatBRL, cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Minus, Plus, ShoppingCart, Pizza, AlertTriangle, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CartAddon } from "@/contexts/CartContext";
import { getEffectivePrice, isPromoActive, getPromoDiscountPct } from "@/lib/promoPrice";
import { readPizzaCatalogConfig, hasPizzaCatalog } from "@/types/pizza";
import { priceForFlavorInSize, isFlavorAvailableInSize } from "@/lib/pizzaPricing";

interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  metadata?: Record<string, any>;
}

interface AddonGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  price_replaces_base?: boolean;
}

interface AddonItem {
  id: string;
  group_id: string;
  name: string;
  price: number;
  sort_order: number;
}

interface Props {
  product: Product | null;
  storeName: string;
  storeCategory?: string;
  singleSize?: boolean;
  storeSettings?: Record<string, any> | null;
  open: boolean;
  onClose: () => void;
  onAdd: (product: Product, addons: CartAddon[], observations: string, quantity: number, totalUnitPrice: number) => void;
}

const categoryEmoji: Record<string, string> = {
  pizzas: "🍕",
  lanches: "🍔",
  farmacias: "💊",
  japonesa: "🍣",
  cafeteria: "☕",
  churrasco: "🥩",
  adegas: "🍷",
  sobremesas: "🍰",
  docerias: "🧁",
  saudavel: "🥗",
};

const ProductDetailModal = ({ product, storeName, storeCategory, singleSize = false, storeSettings, open, onClose, onAdd }: Props) => {
  // itemId → quantidade (0 = não selecionado)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, Record<string, number>>>({});
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedMeatDoneness, setSelectedMeatDoneness] = useState<string | null>(null);
  const [selectedBread, setSelectedBread] = useState<string | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [selectedDrinkSize, setSelectedDrinkSize] = useState<string | null>(null);
  const [selectedMilk, setSelectedMilk] = useState<string | null>(null);
  const [wantIced, setWantIced] = useState(false);
  // Para adegas com temp_option === "both": cliente escolhe gelado ou quente
  const [selectedTemp, setSelectedTemp] = useState<"cold" | "warm" | null>(null);
  const [showRequiredWarning, setShowRequiredWarning] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const resetState = () => {
    setSelectedAddons({});  // Record<groupId, Record<itemId, qty>>
    setObservations("");
    setQuantity(1);
    setSelectedSize(null);
    setSelectedMeatDoneness(null);
    setSelectedBread(null);
    setSelectedFlavor(null);
    setSelectedDrinkSize(null);
    setSelectedMilk(null);
    setWantIced(false);
    setShowRequiredWarning(false);
    setStep(1);
  };

  useEffect(() => {
    if (open) setStep(1);
  }, [open, product?.id]);

  const meta = product?.metadata || {};
  const cat = storeCategory || "";
  const isBeverage = !!meta.is_beverage;
  const emoji = categoryEmoji[cat] || "🍴";

  const isPizza = cat === "pizzas" && !isBeverage;
  const pizzaCatalogConfig = useMemo(() => readPizzaCatalogConfig(storeSettings || {}), [storeSettings]);
  const catalogSizes = useMemo(() => {
    if (!isPizza || singleSize) return [] as Array<{ name: string; price: number }>;
    if (!hasPizzaCatalog(pizzaCatalogConfig)) return [];
    const flavor = { id: product?.id || "", price: Number(product?.price) || 0, metadata: meta };
    return pizzaCatalogConfig.sizes
      .filter((s) => s.active && isFlavorAvailableInSize(flavor as any, s.id))
      .map((s) => ({ name: s.name, price: priceForFlavorInSize(flavor as any, s, pizzaCatalogConfig) }));
  }, [isPizza, singleSize, pizzaCatalogConfig, product?.id, product?.price, meta]);
  const legacySizes: Array<{ name: string; price: number }> = meta.sizes || [];
  const sizes: Array<{ name: string; price: number }> = catalogSizes.length > 0 ? catalogSizes : legacySizes;
  const hasSizes = isPizza && !singleSize && sizes.some((s) => Number(s.price) > 0);

  const isLanche = cat === "lanches" && !isBeverage;
  const meatOptions: string[] = meta.meat_doneness || [];
  const breadTypes: string[] = meta.bread_types || [];

  const isPharmacy = cat === "farmacias";
  const isJapanese = cat === "japonesa" && !isBeverage;

  const isCafe = cat === "cafeteria" && !isBeverage;
  const drinkSizes: string[] = meta.drink_sizes || [];
  const milkOptions: string[] = meta.milk_options || [];
  const cafeFlavors: string[] = meta.flavors || [];
  const isCafeDrink = meta.cafe_product_type === "Café / Bebida Quente" || meta.cafe_product_type === "Suco / Bebida Fria";
  const isCakeLike = meta.cafe_product_type === "Bolo / Fatia" || meta.cafe_product_type === "Torta (fatia)";

  const isBBQ = cat === "churrasco" && !isBeverage;
  const bbqMeatOptions: string[] = meta.meat_doneness || [];

  const isDessert = (cat === "sobremesas" || cat === "docerias") && !isBeverage;
  const flavors: string[] = meta.flavors || [];

  const { data: addonData } = useQuery({
    queryKey: ["addon-all", product?.id],
    queryFn: async () => {
      const [directRes, linksRes] = await Promise.all([
        supabase.from("addon_groups").select("id,name,min_select,max_select,sort_order,price_replaces_base").eq("product_id", product!.id).order("sort_order"),
        supabase.from("product_addon_groups").select("addon_group_id").eq("product_id", product!.id),
      ]);
      if (directRes.error) throw directRes.error;
      if (linksRes.error) throw linksRes.error;

      const direct = (directRes.data || []) as AddonGroup[];
      const linkedIds = (linksRes.data || []).map((l: any) => l.addon_group_id as string);
      const directIds = new Set(direct.map((g) => g.id));

      let linked: AddonGroup[] = [];
      if (linkedIds.length > 0) {
        const linkedRes = await supabase
          .from("addon_groups")
          .select("id,name,min_select,max_select,sort_order,price_replaces_base")
          .in("id", linkedIds)
          .order("sort_order");
        if (linkedRes.error) throw linkedRes.error;
        linked = ((linkedRes.data || []) as AddonGroup[]).filter((g) => !directIds.has(g.id));
      }

      const allGroups = [...direct, ...linked];
      const allIds = allGroups.map((g) => g.id);

      let items: AddonItem[] = [];
      if (allIds.length > 0) {
        const itemsRes = await supabase.from("addon_items").select("id,group_id,name,price,sort_order").in("group_id", allIds).order("sort_order");
        if (itemsRes.error) throw itemsRes.error;
        items = (itemsRes.data || []) as AddonItem[];
      }

      return { groups: allGroups, items };
    },
    enabled: !!product?.id && open,
  });

  const addonGroups = addonData?.groups || [];
  const addonItems = addonData?.items || [];

  const requiredAddonGroups = useMemo(() => addonGroups.filter((g) => g.min_select > 0), [addonGroups]);
  const optionalAddonGroups = useMemo(() => addonGroups.filter((g) => g.min_select === 0), [addonGroups]);

  const hasSyntheticRequired =
    hasSizes ||
    (isLanche && meatOptions.length > 0) ||
    (isLanche && breadTypes.length > 0) ||
    (isBBQ && bbqMeatOptions.length > 0) ||
    (isDessert && flavors.length > 0) ||
    (isCafe && isCakeLike && cafeFlavors.length > 0);

  const calculateTotalSteps = () => {
    if (requiredAddonGroups.length > 0 || hasSyntheticRequired) return 2;
    return 1;
  };

  const totalSteps = calculateTotalSteps();

  // Total de itens selecionados num grupo (soma das quantidades)
  const groupTotal = (groupId: string) =>
    Object.values(selectedAddons[groupId] || {}).reduce((s, q) => s + q, 0);

  const getAddonQty = (groupId: string, itemId: string) =>
    selectedAddons[groupId]?.[itemId] || 0;

  const addAddon = (groupId: string, itemId: string, maxSelect: number) => {
    setSelectedAddons((prev) => {
      const groupQtys = prev[groupId] || {};
      const currentQty = groupQtys[itemId] || 0;
      const total = Object.values(groupQtys).reduce((s, q) => s + q, 0);
      // max_select 0 ou nulo = ilimitado
      const cap = maxSelect && maxSelect > 0 ? maxSelect : Infinity;
      // Atingiu o máximo do grupo
      if (total >= cap) {
        // Máximo 1: substitui o atual pelo novo
        if (cap === 1) return { ...prev, [groupId]: { [itemId]: 1 } };
        return prev;
      }
      return { ...prev, [groupId]: { ...groupQtys, [itemId]: currentQty + 1 } };
    });
  };

  /** Incrementa quantidade do MESMO item ignorando o cap do grupo (usado em max_select=1 para permitir 2x do item já escolhido). */
  const bumpAddonQty = (groupId: string, itemId: string) => {
    setSelectedAddons((prev) => {
      const groupQtys = prev[groupId] || {};
      const currentQty = groupQtys[itemId] || 0;
      return { ...prev, [groupId]: { ...groupQtys, [itemId]: currentQty + 1 } };
    });
  };

  const removeAddon = (groupId: string, itemId: string) => {
    setSelectedAddons((prev) => {
      const groupQtys = { ...(prev[groupId] || {}) };
      const currentQty = groupQtys[itemId] || 0;
      if (currentQty <= 1) {
        delete groupQtys[itemId];
      } else {
        groupQtys[itemId] = currentQty - 1;
      }
      return { ...prev, [groupId]: groupQtys };
    });
  };

  // Manter toggleAddon para compatibilidade (max_select=1 usa toggle simples)
  const toggleAddon = (groupId: string, itemId: string, maxSelect: number) => {
    const qty = getAddonQty(groupId, itemId);
    if (qty > 0) removeAddon(groupId, itemId);
    else addAddon(groupId, itemId, maxSelect);
  };

  const allRequiredMet = useMemo(() => {
    const addonsMet = addonGroups.every((g) => {
      if (g.min_select === 0) return true;
      return groupTotal(g.id) >= g.min_select;
    });
    if (hasSizes && !selectedSize) return false;
    if (isLanche && meatOptions.length > 0 && !selectedMeatDoneness) return false;
    if (isLanche && breadTypes.length > 0 && !selectedBread) return false;
    if (isBBQ && bbqMeatOptions.length > 0 && !selectedMeatDoneness) return false;
    if (isDessert && flavors.length > 0 && !selectedFlavor) return false;
    if (isCafe && isCakeLike && cafeFlavors.length > 0 && !selectedFlavor) return false;
    return addonsMet;
  }, [addonGroups, selectedAddons, hasSizes, selectedSize, isLanche, meatOptions, selectedMeatDoneness, breadTypes, selectedBread, isBBQ, bbqMeatOptions, isDessert, flavors, selectedFlavor, isCafe, isCakeLike, cafeFlavors]);

  const selectedAddonsList: CartAddon[] = useMemo(() => {
    return addonGroups.flatMap((group) => {
      const groupQtys = selectedAddons[group.id] || {};
      return addonItems
        .filter((ai) => ai.group_id === group.id && (groupQtys[ai.id] || 0) > 0)
        .flatMap((ai) => {
          const qty = groupQtys[ai.id] || 1;
          // Repete o addon N vezes para manter compatibilidade com CartAddon[]
          // ou usa qty como multiplicador no preço
          return Array.from({ length: qty }, () => ({
            name: ai.name,
            price: ai.price,
            required: group.min_select > 0,
            groupName: group.name,
          }));
        });
    });
  }, [addonItems, addonGroups, selectedAddons]);

  const priceReplacingGroups = addonGroups.filter((g) => g.price_replaces_base);
  const hasPriceReplacingGroup = priceReplacingGroups.length > 0;
  const priceReplacingSelected = priceReplacingGroups.flatMap((g) =>
    addonItems
      .filter((ai) => ai.group_id === g.id && (selectedAddons[g.id]?.[ai.id] || 0) > 0)
      .map((ai) => ({ ...ai, qty: selectedAddons[g.id]?.[ai.id] || 0 })),
  );
  const replacementPrice = priceReplacingSelected.reduce(
    (s, a) => s + Number(a.price || 0) * (a.qty || 1),
    0,
  );

  const replacingGroupIds = new Set(priceReplacingGroups.map((g) => g.id));
  const addonsTotal = selectedAddonsList
    .filter((a) => {
      const group = addonGroups.find((g) => g.name === a.groupName);
      return !group || !replacingGroupIds.has(group.id);
    })
    .reduce((s, a) => s + a.price, 0);

  const basePrice = hasPriceReplacingGroup
    ? priceReplacingSelected.length > 0
      ? replacementPrice
      : 0
    : hasSizes && selectedSize
      ? sizes.find((s) => s.name === selectedSize)?.price || getEffectivePrice(product as any) || 0
      : getEffectivePrice(product as any) || 0;
  const unitPrice = basePrice + addonsTotal;
  const lineTotal = unitPrice * quantity;

  if (!product) return null;

  const isOutOfStock = !!(product as any).metadata?.out_of_stock;

  const closeAndReset = () => {
    onClose();
    resetState();
  };

  const buildCartAddons = (): CartAddon[] => {
    const list = [...selectedAddonsList];
    if (hasSizes && selectedSize) list.unshift({ name: `Tamanho: ${selectedSize}`, price: 0 });
    if (selectedMeatDoneness) list.push({ name: `Ponto: ${selectedMeatDoneness}`, price: 0 });
    if (selectedBread) list.push({ name: `Pão: ${selectedBread}`, price: 0 });
    if (selectedFlavor) list.push({ name: `Sabor: ${selectedFlavor}`, price: 0 });
    if (selectedDrinkSize) list.push({ name: `Tamanho: ${selectedDrinkSize}`, price: 0 });
    if (selectedMilk) list.push({ name: `Leite: ${selectedMilk}`, price: 0 });
    if (wantIced) list.push({ name: "Gelado", price: 0 });
    return list;
  };

  const renderRadioSelector = (
    label: string,
    icon: string,
    options: string[],
    selected: string | null,
    onSelect: (value: string) => void,
    required = false,
  ) => (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          <h4 className="text-sm font-bold leading-tight text-foreground">{label}</h4>
        </div>
        {required && (
          <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-bold", selected ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
            {selected ? "Selecionado" : "Obrigatório"}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                "flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99]",
                isSelected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/60",
              )}
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", isSelected ? "border-primary" : "border-muted-foreground/40")}>
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <span className={cn("min-w-0 flex-1 text-sm text-foreground", isSelected && "font-bold")}>{option}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderToggleOption = (label: string, icon: string, value: boolean, onChange: (value: boolean) => void) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex min-h-[52px] w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
        value ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/60",
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className={cn("flex-1 text-sm text-foreground", value && "font-bold")}>{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", value ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform", value ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  );

  const renderAddonGroup = (group: AddonGroup) => {
    const items = addonItems.filter((ai) => ai.group_id === group.id);
    const isRequired = group.min_select > 0;
    const currentSelected = Object.values(selectedAddons[group.id] || {}).reduce((s, q) => s + q, 0);

    return (
      <section key={group.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-bold leading-tight text-foreground">{group.name}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRequired ? `Escolha ${group.min_select}` : "Opcional"}
              {group.max_select > 1 ? ` • máximo ${group.max_select}` : ""}
            </p>
          </div>
          {isRequired && (
            <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-bold", currentSelected >= group.min_select ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
              {currentSelected >= group.min_select ? "Selecionado" : "Obrigatório"}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {items.map((item) => {
            const qty = getAddonQty(group.id, item.id);
            const isChecked = qty > 0;
            // max_select === 1 → seleção única (checkbox). Qualquer outro (0=ilimitado ou >1) → stepper.
            const allowMultiple = group.max_select !== 1;
            const groupCap = group.max_select && group.max_select > 0 ? group.max_select : Infinity;
            const atCap = groupTotal(group.id) >= groupCap;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                  isChecked ? "border-primary bg-primary/10" : "border-border bg-background",
                )}
              >
                {/* Checkbox (para seleção única) ou ícone de checked (para múltiplos) */}
                {!allowMultiple ? (
                  <button
                    type="button"
                    onClick={() => toggleAddon(group.id, item.id, group.max_select)}
                    className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2", isChecked ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background")}
                  >
                    {isChecked && (
                      <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => removeAddon(group.id, item.id)}
                      disabled={qty === 0}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border-2 transition active:scale-90",
                        qty > 0 ? "border-primary bg-primary text-white" : "border-muted-foreground/20 text-muted-foreground/30"
                      )}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className={cn("w-5 text-center text-sm font-black", qty > 0 ? "text-primary" : "text-muted-foreground/40")}>
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => addAddon(group.id, item.id, group.max_select)}
                      disabled={atCap}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border-2 transition active:scale-90",
                        !atCap ? "border-primary bg-primary text-white" : "border-muted-foreground/20 text-muted-foreground/30"
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Nome — clicável para toggle no modo único */}
                <button
                  type="button"
                  onClick={() => !allowMultiple && toggleAddon(group.id, item.id, group.max_select)}
                  className={cn("min-w-0 flex-1 text-sm text-left text-foreground", isChecked && "font-bold", !allowMultiple && "cursor-pointer")}
                >
                  {item.name}
                  {allowMultiple && qty > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{qty}x</span>
                  )}
                </button>

                {item.price > 0 && (
                  <span className={cn("shrink-0 text-sm font-bold", isChecked ? "text-primary" : "text-muted-foreground")}>
                    + {formatBRL(item.price * (qty > 1 ? qty : 1))}
                  </span>
                )}

                {/* Stepper de quantidade para grupos de escolha única, após selecionado (ex: 2x Coca) */}
                {!allowMultiple && isChecked && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeAddon(group.id, item.id); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-primary bg-primary text-white transition active:scale-90"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-black text-primary">{qty}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); bumpAddonQty(group.id, item.id); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-primary bg-primary text-white transition active:scale-90"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const Step1Content = (
    <div className="space-y-5">
      <div className="relative -mx-4 -mt-4 aspect-video overflow-hidden bg-muted sm:-mx-6 sm:-mt-6">
        {product.image_url ? (
          <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-7xl">{emoji}</span>
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">{product.name}</h2>
        {!hasSizes && (() => {
          const promo = isPromoActive(product as any);
          const eff = getEffectivePrice(product as any);
          const pct = getPromoDiscountPct(product as any);
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-2xl font-black ${promo ? "text-orange-600" : "text-primary"}`}>{formatBRL(eff)}</p>
              {promo && (
                <>
                  <p className="text-base font-bold line-through text-destructive">{formatBRL(Number(product.price))}</p>
                  {pct && <span className="text-[10px] font-black bg-foreground text-background px-2 py-1 rounded-full">Promoção! -{pct}%</span>}
                </>
              )}
            </div>
          );
        })()}
        {product.description && <p className="text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">{product.description}</p>}
      </section>

      {isPharmacy && (
        <section className="space-y-2">
          {meta.requires_prescription && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="text-xs font-bold text-destructive">Este produto exige receita médica</span>
            </div>
          )}
          <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
            {meta.active_ingredient && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Princípio ativo</span><span className="text-right font-bold text-foreground">{meta.active_ingredient}</span></div>}
            {meta.dosage && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Dosagem</span><span className="text-right font-bold text-foreground">{meta.dosage}</span></div>}
            {meta.manufacturer && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Fabricante</span><span className="text-right font-bold text-foreground">{meta.manufacturer}</span></div>}
            {meta.pharma_type && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Tipo</span><span className="text-right font-bold text-foreground">{meta.pharma_type}</span></div>}
            {meta.is_generic && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Genérico</span><span className="text-right font-bold text-primary">Sim</span></div>}
          </div>
        </section>
      )}

      {isJapanese && (
        <div className="flex flex-wrap gap-1.5">
          {meta.pieces_count && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">🍣 {meta.pieces_count} peças</span>}
          {meta.shareable && <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">👥 Para compartilhar</span>}
          {meta.proteins?.length > 0 && meta.proteins.map((p: string) => <span key={p} className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{p}</span>)}
        </div>
      )}

      {isBBQ && meta.portion_weight && (
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold text-foreground">⚖️ Porção: {meta.portion_weight}</span>
          {meta.shareable && <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">👥 Para compartilhar</span>}
        </div>
      )}

      {isLanche && meta.is_combo && meta.combo_items?.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-bold text-foreground">🎁 Itens do combo</p>
          <div className="flex flex-wrap gap-1">
            {meta.combo_items.map((item: string) => <span key={item} className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{item}</span>)}
          </div>
        </section>
      )}

      {cat === "adegas" && (
        <div className="space-y-3">
          {/* Info da bebida — marca e volume */}
          {(meta.brand || meta.volume) && (
            <p className="text-xs text-muted-foreground">
              {meta.brand && <strong className="text-foreground">{meta.brand}</strong>}
              {meta.brand && meta.volume && " · "}
              {meta.volume && <span>{meta.volume}</span>}
              {meta.alcohol_content && <span className="ml-1 text-amber-600">· {meta.alcohol_content}</span>}
            </p>
          )}

          {/* Temperatura — só mostra se for "both" (lojista vende dos dois) */}
          {meta.temp_option === "both" && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-foreground">Temperatura</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTemp("cold")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedTemp === "cold"
                      ? "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-400"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ❄️ Gelado
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTemp("warm")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedTemp === "warm"
                      ? "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-400"
                      : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🔥 Quente
                </button>
              </div>
            </div>
          )}

          {/* Temperatura fixa — apenas informativo */}
          {meta.temp_option === "cold" || (meta.serve_cold && meta.temp_option !== "both" && meta.temp_option !== "ambient") ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-600 px-2.5 py-1 text-xs font-bold">
              ❄️ Gelado
            </span>
          ) : meta.temp_option === "ambient" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-1 text-xs font-semibold">
              🌡️ Temperatura ambiente
            </span>
          ) : null}
        </div>
      )}

      {isDessert && meta.size_weight && <div><span className="rounded-full bg-muted px-2 py-1 text-xs font-bold text-foreground">📏 {meta.size_weight}</span></div>}

      {cat === "restaurante" && !isBeverage && (
        <div className="space-y-2">
          {/* Porção e badges */}
          <div className="flex flex-wrap gap-1.5">
            {meta.portion_size && <span className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-bold">🍽️ {meta.portion_size}</span>}
            {meta.shareable && <span className="rounded-full bg-green-500/10 text-green-600 px-2.5 py-1 text-xs font-bold">👥 Para compartilhar</span>}
            {meta.is_gluten_free && <span className="rounded-full bg-amber-500/10 text-amber-600 px-2.5 py-1 text-xs font-bold">Sem glúten</span>}
            {meta.is_lactose_free && <span className="rounded-full bg-blue-500/10 text-blue-600 px-2.5 py-1 text-xs font-bold">Sem lactose</span>}
          </div>
          {/* Acompanhamentos */}
          {meta.sides && (
            <div className="bg-muted/30 rounded-xl px-3 py-2">
              <p className="text-xs font-bold text-muted-foreground mb-1">🥗 Acompanhamentos</p>
              <p className="text-xs text-foreground">{meta.sides}</p>
            </div>
          )}
          {/* Combo */}
          {meta.is_combo && meta.combo_items?.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-bold text-foreground">🎁 Itens do combo</p>
              <div className="flex flex-wrap gap-1">
                {meta.combo_items.map((item: string, i: number) => (
                  <span key={i} className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{item}</span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {cat === "pizzas" && !isBeverage && (meta.slice_count || meta.has_stuffed_crust || meta.shareable || meta.is_combo) && (
        <div className="flex flex-wrap gap-1.5">
          {meta.slice_count && <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">🍕 {meta.slice_count} fatias</span>}
          {meta.has_stuffed_crust && <span className="rounded-full bg-amber-500/10 text-amber-600 px-2.5 py-1 text-xs font-bold">Borda recheada</span>}
          {meta.shareable && <span className="rounded-full bg-green-500/10 text-green-600 px-2.5 py-1 text-xs font-bold">👥 Para compartilhar</span>}
          {meta.is_combo && <span className="rounded-full bg-amber-500/10 text-amber-600 px-2.5 py-1 text-xs font-bold">🎁 Combo</span>}
        </div>
      )}

      {isBeverage && (meta.drink_type || meta.drink_volume) && (
        <div className="flex flex-wrap gap-1.5">
          {meta.drink_type && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">🥤 {meta.drink_type}</span>}
          {meta.drink_volume && <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">{meta.drink_volume}</span>}
          {meta.serve_cold && <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">❄️ Gelado</span>}
        </div>
      )}

      {cat === "saudavel" && !isBeverage && (
        <div className="space-y-2">
          {/* Badges de dieta */}
          <div className="flex flex-wrap gap-1.5">
            {meta.is_vegan && <span className="rounded-full bg-green-500/15 text-green-700 dark:text-green-400 px-2.5 py-1 text-xs font-bold">🌱 Vegano</span>}
            {meta.is_vegetarian && !meta.is_vegan && <span className="rounded-full bg-green-500/10 text-green-700 dark:text-green-400 px-2.5 py-1 text-xs font-bold">🥦 Vegetariano</span>}
            {meta.is_gluten_free && <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-xs font-bold">🌾 Sem glúten</span>}
            {meta.is_lactose_free && <span className="rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2.5 py-1 text-xs font-bold">🥛 Sem lactose</span>}
            {meta.is_low_carb && <span className="rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2.5 py-1 text-xs font-bold">Low carb</span>}
            {meta.is_organic && <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 text-xs font-bold">🍃 Orgânico</span>}
          </div>
          {/* Tabela nutricional */}
          {(meta.calories || meta.protein_grams || meta.carbs_grams || meta.size_weight) && (
            <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-2">
              {meta.size_weight && (
                <div className="text-center">
                  <p className="text-sm font-black text-foreground">{meta.size_weight}</p>
                  <p className="text-[10px] text-muted-foreground">Porção</p>
                </div>
              )}
              {meta.calories && (
                <div className="text-center">
                  <p className="text-sm font-black text-orange-500">{meta.calories}</p>
                  <p className="text-[10px] text-muted-foreground">Calorias</p>
                </div>
              )}
              {meta.protein_grams && (
                <div className="text-center">
                  <p className="text-sm font-black text-foreground">{meta.protein_grams}g</p>
                  <p className="text-[10px] text-muted-foreground">Proteína</p>
                </div>
              )}
              {meta.carbs_grams && (
                <div className="text-center">
                  <p className="text-sm font-black text-foreground">{meta.carbs_grams}g</p>
                  <p className="text-[10px] text-muted-foreground">Carboidratos</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isCafe && meta.cafe_product_type && (
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">☕ {meta.cafe_product_type}</span>
          {meta.cafe_custom_type && <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">{meta.cafe_custom_type}</span>}
          {meta.can_heat && <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">🔥 Pode aquecer</span>}
        </div>
      )}

      {isCafe && isCafeDrink && drinkSizes.length > 0 && renderRadioSelector("Tamanho", "☕", drinkSizes, selectedDrinkSize, setSelectedDrinkSize)}
      {isCafe && isCafeDrink && milkOptions.length > 0 && renderRadioSelector("Tipo de leite", "🥛", milkOptions, selectedMilk, setSelectedMilk)}
      {isCafe && meta.can_be_iced && renderToggleOption("Quero gelado", "❄️", wantIced, setWantIced)}

      {optionalAddonGroups.map((group) => renderAddonGroup(group))}

      {cat !== "adegas" && !isBeverage && (
        <section>
          <label className="mb-2 block text-sm font-bold text-foreground">Observações</label>
          <Textarea
            placeholder={isPharmacy ? "Informações adicionais..." : "Ex: Sem cebola, bem passado..."}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            className="min-h-24 resize-none rounded-2xl border-border bg-card text-base"
            maxLength={200}
          />
        </section>
      )}
    </div>
  );

  const Step2Content = (
    <div className="space-y-5">
      <section className="space-y-1">
        <p className="text-xs font-bold uppercase text-primary">Personalização</p>
        <h3 className="text-2xl font-extrabold leading-tight text-foreground">Escolha os obrigatórios</h3>
        <p className="text-sm text-muted-foreground">Selecione as opções necessárias para finalizar.</p>
      </section>

      {hasSizes && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Pizza className="h-4 w-4 shrink-0 text-primary" />
            <h4 className="text-sm font-bold text-foreground">Escolha o tamanho</h4>
            <span className={cn("ml-auto shrink-0 rounded-full px-2 py-1 text-[11px] font-bold", selectedSize ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
              {selectedSize ? "Selecionado" : "Obrigatório"}
            </span>
          </div>
          <div className="space-y-2">
            {sizes.filter((s) => Number(s.price) > 0).map((size) => {
              const isSelected = selectedSize === size.name;
              return (
                <button
                  key={size.name}
                  type="button"
                  onClick={() => setSelectedSize(size.name)}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99]",
                    isSelected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/60",
                  )}
                >
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", isSelected ? "border-primary" : "border-muted-foreground/40")}>
                    {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className={cn("min-w-0 flex-1 text-sm text-foreground", isSelected && "font-bold")}>{size.name}</span>
                  <span className={cn("shrink-0 text-sm font-black", isSelected ? "text-primary" : "text-muted-foreground")}>{formatBRL(size.price)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isLanche && breadTypes.length > 0 && renderRadioSelector("Tipo de pão", "🍞", breadTypes, selectedBread, setSelectedBread, true)}
      {isLanche && meatOptions.length > 0 && renderRadioSelector("Ponto da carne", "🥩", meatOptions, selectedMeatDoneness, setSelectedMeatDoneness, true)}
      {isBBQ && bbqMeatOptions.length > 0 && renderRadioSelector("Ponto da carne", "🔥", bbqMeatOptions, selectedMeatDoneness, setSelectedMeatDoneness, true)}
      {isDessert && flavors.length > 0 && renderRadioSelector("Escolha o sabor", "🍰", flavors, selectedFlavor, setSelectedFlavor, true)}
      {isCafe && isCakeLike && cafeFlavors.length > 0 && renderRadioSelector("Escolha o sabor", "🍰", cafeFlavors, selectedFlavor, setSelectedFlavor, true)}

      {requiredAddonGroups.map((group) => renderAddonGroup(group))}

      {showRequiredWarning && !allRequiredMet && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-xs font-bold text-destructive">Selecione todos os obrigatórios para continuar</span>
        </div>
      )}
    </div>
  );

  const handlePrimary = () => {
    if (isOutOfStock) return;
    if (totalSteps === 2 && step === 1) {
      setStep(2);
      return;
    }
    // Validar temperatura quando lojista oferece gelado e quente
    if (storeCategory === "adegas" && (product as any).metadata?.temp_option === "both" && !selectedTemp) {
      setShowRequiredWarning(true);
      window.setTimeout(() => setShowRequiredWarning(false), 3000);
      return;
    }

    if (!allRequiredMet) {
      setShowRequiredWarning(true);
      window.setTimeout(() => setShowRequiredWarning(false), 3000);
      return;
    }
    // Incluir temperatura nas observações para adegas com temp_option === "both"
    const tempNote = (storeCategory === "adegas" && selectedTemp)
      ? `[${selectedTemp === "cold" ? "❄️ Gelado" : "🔥 Quente"}]`
      : "";
    const fullObservations = [tempNote, observations.trim()].filter(Boolean).join(" ");
    onAdd(product, buildCartAddons(), fullObservations, quantity, unitPrice);
    closeAndReset();
  };

  const primaryLabel = totalSteps === 2 && step === 1
    ? "Próximo: Personalizar"
    : isOutOfStock
      ? "Esgotado"
      : `Adicionar • ${formatBRL(lineTotal)}`;

  const primaryEnabled = totalSteps === 2 && step === 1 ? !isOutOfStock : allRequiredMet && !isOutOfStock;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closeAndReset(); }}>
      <DialogContent
        aria-describedby="product-detail-description"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          "left-0 top-0 z-[110] m-0 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-none bg-background p-0 shadow-2xl outline-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 md:left-[50%] md:top-[50%] md:h-[90vh] md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-3xl [&>button.absolute]:hidden",
          cat === "adegas" && "adega-theme"
        )}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription id="product-detail-description" className="sr-only">
          Detalhes do produto {product.name} em {storeName}
        </DialogDescription>

        <header className="sticky top-0 z-[70] shrink-0 border-b border-border bg-background/95 backdrop-blur-lg">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                if (step === 2) setStep(1);
                else closeAndReset();
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
              aria-label={step === 2 ? "Voltar" : "Fechar"}
            >
              {step === 2 ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              {totalSteps > 1 && <p className="mb-0.5 text-[11px] font-bold uppercase text-muted-foreground">Etapa {step} de {totalSteps}</p>}
              <p className="truncate text-sm font-bold leading-tight text-foreground">{step === 1 ? product.name : "Personalizar"}</p>
            </div>
          </div>
          {totalSteps > 1 && <Progress value={(step / totalSteps) * 100} className="h-1 rounded-none bg-muted" />}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-6 sm:px-6 sm:py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: step === 2 ? 36 : -36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: step === 2 ? -36 : 36 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {step === 1 ? Step1Content : Step2Content}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="sticky bottom-0 z-[60] shrink-0 border-t border-border bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border bg-muted p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-foreground shadow-sm transition active:scale-95 disabled:opacity-40"
                aria-label="Diminuir"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-base font-black text-foreground">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition active:scale-95"
                aria-label="Aumentar"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrimary}
              disabled={!primaryEnabled}
              className={cn(
                "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black shadow-lg transition active:scale-[0.98] disabled:shadow-none",
                primaryEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {!(totalSteps === 2 && step === 1) && <ShoppingCart className="h-5 w-5 shrink-0" />}
              <span className="truncate">{primaryLabel}</span>
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;
