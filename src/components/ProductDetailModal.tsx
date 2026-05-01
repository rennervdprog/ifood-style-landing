import { formatBRL } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Minus, Plus, ShoppingCart, Pizza, AlertTriangle, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CartAddon } from "@/contexts/CartContext";

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
  open: boolean;
  onClose: () => void;
  onAdd: (product: Product, addons: CartAddon[], observations: string, quantity: number, totalUnitPrice: number) => void;
}

const categoryEmoji: Record<string, string> = {
  pizzas: "🍕", lanches: "🍔", farmacias: "💊", japonesa: "🍣",
  cafeteria: "☕", churrasco: "🥩", adegas: "🍷", sobremesas: "🍰",
  docerias: "🧁", saudavel: "🥗",
};

const ProductDetailModal = ({ product, storeName, storeCategory, open, onClose, onAdd }: Props) => {
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedMeatDoneness, setSelectedMeatDoneness] = useState<string | null>(null);
  const [selectedBread, setSelectedBread] = useState<string | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [selectedDrinkSize, setSelectedDrinkSize] = useState<string | null>(null);
  const [selectedMilk, setSelectedMilk] = useState<string | null>(null);
  const [wantIced, setWantIced] = useState(false);
  const [showRequiredWarning, setShowRequiredWarning] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const resetState = () => {
    setSelectedAddons({});
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
  const sizes: Array<{ name: string; price: number }> = meta.sizes || [];
  const hasSizes = isPizza && sizes.length > 0;

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
        supabase.from("addon_groups").select("*").eq("product_id", product!.id).order("sort_order"),
        supabase.from("product_addon_groups").select("addon_group_id").eq("product_id", product!.id),
      ]);
      if (directRes.error) throw directRes.error;
      if (linksRes.error) throw linksRes.error;

      const direct = (directRes.data || []) as AddonGroup[];
      const linkedIds = (linksRes.data || []).map((l: any) => l.addon_group_id as string);
      const directIds = new Set(direct.map(g => g.id));

      let linked: AddonGroup[] = [];
      if (linkedIds.length > 0) {
        const linkedRes = await supabase.from("addon_groups").select("*").in("id", linkedIds).order("sort_order");
        if (linkedRes.error) throw linkedRes.error;
        linked = ((linkedRes.data || []) as AddonGroup[]).filter(g => !directIds.has(g.id));
      }

      const allGroups = [...direct, ...linked];
      const allIds = allGroups.map(g => g.id);

      let items: AddonItem[] = [];
      if (allIds.length > 0) {
        const itemsRes = await supabase.from("addon_items").select("*").in("group_id", allIds).order("sort_order");
        if (itemsRes.error) throw itemsRes.error;
        items = (itemsRes.data || []) as AddonItem[];
      }

      return { groups: allGroups, items };
    },
    enabled: !!product?.id && open,
  });

  const addonGroups = addonData?.groups || [];
  const addonItems = addonData?.items || [];

  const requiredAddonGroups = useMemo(() => addonGroups.filter(g => g.min_select > 0), [addonGroups]);
  const optionalAddonGroups = useMemo(() => addonGroups.filter(g => g.min_select === 0), [addonGroups]);

  // Sintéticos obrigatórios (size, ponto, pão, sabor) — entram na etapa de obrigatórios
  const hasSyntheticRequired =
    hasSizes ||
    (isLanche && meatOptions.length > 0) ||
    (isLanche && breadTypes.length > 0) ||
    (isBBQ && bbqMeatOptions.length > 0) ||
    (isDessert && flavors.length > 0) ||
    (isCafe && isCakeLike && cafeFlavors.length > 0);

  const hasAnyRequired = requiredAddonGroups.length > 0 || hasSyntheticRequired;
  const totalSteps = hasAnyRequired ? 2 : 1;

  // Nome do primeiro grupo obrigatório (para texto do botão)
  const firstRequiredGroupName = useMemo(() => {
    if (hasSizes) return "Tamanho";
    if (isLanche && breadTypes.length > 0) return "Pão";
    if (isLanche && meatOptions.length > 0) return "Ponto da Carne";
    if (isBBQ && bbqMeatOptions.length > 0) return "Ponto da Carne";
    if (isDessert && flavors.length > 0) return "Sabor";
    if (isCafe && isCakeLike && cafeFlavors.length > 0) return "Sabor";
    if (requiredAddonGroups[0]) return requiredAddonGroups[0].name;
    return "Opções";
  }, [hasSizes, isLanche, breadTypes, meatOptions, isBBQ, bbqMeatOptions, isDessert, flavors, isCafe, isCakeLike, cafeFlavors, requiredAddonGroups]);

  const toggleAddon = (groupId: string, itemId: string, maxSelect: number) => {
    setSelectedAddons(prev => {
      const current = prev[groupId] || [];
      if (current.includes(itemId)) return { ...prev, [groupId]: current.filter(id => id !== itemId) };
      if (current.length >= maxSelect) {
        if (maxSelect === 1) return { ...prev, [groupId]: [itemId] };
        return prev;
      }
      return { ...prev, [groupId]: [...current, itemId] };
    });
  };

  const allRequiredMet = useMemo(() => {
    const addonsMet = addonGroups.every(g => {
      if (g.min_select === 0) return true;
      return (selectedAddons[g.id]?.length || 0) >= g.min_select;
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
    return addonGroups.flatMap(group => {
      const groupSelected = selectedAddons[group.id] || [];
      return addonItems
        .filter(ai => ai.group_id === group.id && groupSelected.includes(ai.id))
        .map(ai => ({
          name: ai.name,
          price: ai.price,
          required: group.min_select > 0,
          groupName: group.name,
        }));
    });
  }, [addonItems, addonGroups, selectedAddons]);

  const priceReplacingGroups = addonGroups.filter(g => g.price_replaces_base);
  const hasPriceReplacingGroup = priceReplacingGroups.length > 0;
  const priceReplacingSelected = priceReplacingGroups.flatMap(g =>
    addonItems.filter(ai => ai.group_id === g.id && (selectedAddons[g.id] || []).includes(ai.id))
  );
  const replacementPrice = priceReplacingSelected.reduce((s, a) => s + Number(a.price || 0), 0);

  const replacingGroupIds = new Set(priceReplacingGroups.map(g => g.id));
  const addonsTotal = selectedAddonsList
    .filter(a => {
      const grp = addonGroups.find(g => g.name === a.groupName);
      return !grp || !replacingGroupIds.has(grp.id);
    })
    .reduce((s, a) => s + a.price, 0);

  const basePrice = hasPriceReplacingGroup
    ? (priceReplacingSelected.length > 0 ? replacementPrice : 0)
    : (hasSizes && selectedSize
        ? (sizes.find(s => s.name === selectedSize)?.price || product?.price || 0)
        : (product?.price || 0));
  const unitPrice = basePrice + addonsTotal;
  const lineTotal = unitPrice * quantity;

  if (!product) return null;

  const isOutOfStock = !!(product as any).metadata?.out_of_stock;

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
    onSelect: (v: string) => void,
    required: boolean = false
  ) => (
    <div className="bg-muted/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <h4 className="font-bold text-sm text-foreground">{label}</h4>
        {required && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            selected ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
          }`}>
            {selected ? "✓" : "Obrigatório"}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {options.map(opt => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-xl transition-all text-left ${
                isSelected
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-background border-2 border-transparent hover:bg-muted"
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                isSelected ? "border-primary" : "border-muted-foreground/40"
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className={`text-sm ${isSelected ? "font-bold text-foreground" : "text-foreground"}`}>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderToggleOption = (label: string, icon: string, value: boolean, onChange: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all w-full text-left ${
        value ? "bg-primary/10 border-2 border-primary" : "bg-muted/50 border-2 border-transparent hover:bg-muted"
      }`}
    >
      <span>{icon}</span>
      <span className={`text-sm flex-1 ${value ? "font-bold text-foreground" : "text-foreground"}`}>{label}</span>
      <div className={`w-10 h-5 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
    </button>
  );

  const renderAddonGroup = (group: AddonGroup) => {
    const items = addonItems?.filter(ai => ai.group_id === group.id) || [];
    const isRequired = group.min_select > 0;
    const currentSelected = selectedAddons[group.id]?.length || 0;
    return (
      <div key={group.id} className="bg-muted/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-bold text-sm text-foreground">{group.name}</h4>
            <p className="text-xs text-muted-foreground">
              {isRequired ? `Escolha ${group.min_select}` : "Opcional"}
              {group.max_select > 1 ? ` (máx. ${group.max_select})` : ""}
            </p>
          </div>
          {isRequired && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              currentSelected >= group.min_select ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
            }`}>
              {currentSelected >= group.min_select ? "✓" : "Obrigatório"}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {items.map(item => {
            const isChecked = selectedAddons[group.id]?.includes(item.id) || false;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleAddon(group.id, item.id, group.max_select)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAddon(group.id, item.id, group.max_select); } }}
                className={`flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all min-h-[48px] ${
                  isChecked
                    ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20"
                    : "bg-background border border-transparent hover:bg-muted"
                }`}
              >
                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background"
                }`}>
                  {isChecked && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`flex-1 text-sm ${isChecked ? "font-bold text-foreground" : "text-foreground"}`}>{item.name}</span>
                {item.price > 0 && (
                  <span className={`text-sm font-bold ${isChecked ? "text-primary" : "text-muted-foreground"}`}>+ {formatBRL(item.price)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Conteúdo da Etapa 1
  const Step1Content = (
    <div className="space-y-6">
      {/* IMAGEM HERO */}
      <div className="relative w-full aspect-video overflow-hidden -mt-6 -mx-6 mb-2" style={{ width: "calc(100% + 3rem)" }}>
        {product.image_url ? (
          <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-7xl">{emoji}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
          {product.name}
        </h2>
        {!hasSizes && (
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-primary">{formatBRL(product.price)}</span>
          </div>
        )}
        {product.description && (
          <p className="text-base text-muted-foreground font-medium leading-relaxed">
            {product.description}
          </p>
        )}
      </div>

      {/* Info cards (badges/specs) - mantidos na etapa 1 */}
      {isPharmacy && (
        <div className="space-y-2">
          {meta.requires_prescription && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-xs font-bold text-destructive">Este produto exige receita médica</span>
            </div>
          )}
          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
            {meta.active_ingredient && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Princípio ativo</span><span className="font-bold text-foreground">{meta.active_ingredient}</span></div>}
            {meta.dosage && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Dosagem</span><span className="font-bold text-foreground">{meta.dosage}</span></div>}
            {meta.manufacturer && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Fabricante</span><span className="font-bold text-foreground">{meta.manufacturer}</span></div>}
            {meta.pharma_type && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tipo</span><span className="font-bold text-foreground">{meta.pharma_type}</span></div>}
            {meta.is_generic && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Genérico</span><span className="font-bold text-blue-600">Sim</span></div>}
          </div>
        </div>
      )}

      {isJapanese && (
        <div className="flex flex-wrap gap-1.5">
          {meta.pieces_count && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">🍣 {meta.pieces_count} peças</span>}
          {meta.shareable && <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full font-bold">👥 Para compartilhar</span>}
          {meta.proteins?.length > 0 && meta.proteins.map((p: string) => (
            <span key={p} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">{p}</span>
          ))}
        </div>
      )}

      {isBBQ && meta.portion_weight && (
        <div>
          <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-bold">⚖️ Porção: {meta.portion_weight}</span>
          {meta.shareable && <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full font-bold ml-1.5">👥 Para compartilhar</span>}
        </div>
      )}

      {isLanche && meta.is_combo && meta.combo_items?.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-700 mb-1">🎁 Itens do combo:</p>
          <div className="flex flex-wrap gap-1">
            {meta.combo_items.map((item: string) => (
              <span key={item} className="text-[10px] bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full font-medium">{item}</span>
            ))}
          </div>
        </div>
      )}

      {cat === "adegas" && (
        <div className="flex flex-wrap gap-1.5">
          {meta.drink_type && <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1 rounded-full font-bold">{meta.drink_type}</span>}
          {meta.volume && <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">{meta.volume}</span>}
          {meta.alcohol_content && <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">🍷 {meta.alcohol_content}</span>}
          {meta.serve_cold && <span className="text-xs bg-sky-500/10 text-sky-600 px-2 py-1 rounded-full font-bold">❄️ Gelado</span>}
        </div>
      )}

      {isDessert && meta.size_weight && (
        <div><span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-bold">📏 {meta.size_weight}</span></div>
      )}

      {isBeverage && (meta.drink_type || meta.drink_volume) && (
        <div className="flex flex-wrap gap-1.5">
          {meta.drink_type && <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1 rounded-full font-bold">🥤 {meta.drink_type}</span>}
          {meta.drink_volume && <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">{meta.drink_volume}</span>}
          {meta.serve_cold && <span className="text-xs bg-sky-500/10 text-sky-600 px-2 py-1 rounded-full font-bold">❄️ Gelado</span>}
        </div>
      )}

      {cat === "saudavel" && !isBeverage && (
        <div className="flex flex-wrap gap-1.5">
          {meta.is_vegan && <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full font-bold">🌱 Vegano</span>}
          {meta.is_gluten_free && <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-1 rounded-full font-bold">🌾 Sem Glúten</span>}
          {meta.is_lactose_free && <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded-full font-bold">🥛 Sem Lactose</span>}
          {meta.is_organic && <span className="text-xs bg-green-600/10 text-green-700 px-2 py-1 rounded-full font-bold">🍃 Orgânico</span>}
          {meta.calories && <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">🔥 {meta.calories} kcal</span>}
          {meta.protein_grams && <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">💪 {meta.protein_grams}g proteína</span>}
        </div>
      )}

      {isCafe && meta.cafe_product_type && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">☕ {meta.cafe_product_type}</span>
          {meta.cafe_custom_type && <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">{meta.cafe_custom_type}</span>}
          {meta.can_heat && <span className="text-xs bg-orange-500/10 text-orange-600 px-2 py-1 rounded-full font-bold">🔥 Pode aquecer</span>}
        </div>
      )}

      {/* OPCIONAIS de cafeteria (drink) - tamanho/leite/gelado são opcionais */}
      {isCafe && isCafeDrink && drinkSizes.length > 0 && renderRadioSelector("Tamanho", "☕", drinkSizes, selectedDrinkSize, setSelectedDrinkSize, false)}
      {isCafe && isCafeDrink && milkOptions.length > 0 && renderRadioSelector("Tipo de leite", "🥛", milkOptions, selectedMilk, setSelectedMilk, false)}
      {isCafe && meta.can_be_iced && renderToggleOption("Quero gelado", "❄️", wantIced, setWantIced)}

      {/* GRUPOS DE ADICIONAIS OPCIONAIS */}
      {optionalAddonGroups.map(g => renderAddonGroup(g))}

      {/* Observações - sempre na etapa 1 */}
      <div>
        <label className="text-sm font-bold text-foreground mb-1.5 block">Observações</label>
        <Textarea
          placeholder={isPharmacy ? "Informações adicionais..." : "Ex: Sem cebola, bem passado..."}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          className="resize-none h-20 rounded-xl"
          maxLength={200}
          autoFocus={false}
          tabIndex={-1}
        />
      </div>
    </div>
  );

  // Conteúdo da Etapa 2 - apenas obrigatórios
  const Step2Content = (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Quase lá!</p>
        <h3 className="text-2xl font-extrabold tracking-tight text-foreground leading-tight">
          Personalize seu pedido
        </h3>
        <p className="text-sm text-muted-foreground">Selecione as opções obrigatórias para finalizar.</p>
      </div>

      {hasSizes && (
        <div className="bg-muted/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Pizza className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm text-foreground">Escolha o tamanho</h4>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              selectedSize ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
            }`}>
              {selectedSize ? "✓" : "Obrigatório"}
            </span>
          </div>
          <div className="space-y-1.5">
            {sizes.filter(s => s.price > 0).map(size => {
              const isSelected = selectedSize === size.name;
              return (
                <button
                  key={size.name}
                  type="button"
                  onClick={() => setSelectedSize(size.name)}
                  className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all text-left ${
                    isSelected ? "bg-primary/10 border-2 border-primary" : "bg-background border-2 border-transparent hover:bg-muted"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "border-primary" : "border-muted-foreground/40"
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className={`flex-1 text-sm ${isSelected ? "font-bold" : ""} text-foreground`}>{size.name}</span>
                  <span className={`text-sm font-black ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{formatBRL(size.price)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLanche && breadTypes.length > 0 && renderRadioSelector("Tipo de pão", "🍞", breadTypes, selectedBread, setSelectedBread, true)}
      {isLanche && meatOptions.length > 0 && renderRadioSelector("Ponto da carne", "🥩", meatOptions, selectedMeatDoneness, setSelectedMeatDoneness, true)}
      {isBBQ && bbqMeatOptions.length > 0 && renderRadioSelector("Ponto da carne", "🔥", bbqMeatOptions, selectedMeatDoneness, setSelectedMeatDoneness, true)}
      {isDessert && flavors.length > 0 && renderRadioSelector("Escolha o sabor", "🍰", flavors, selectedFlavor, setSelectedFlavor, true)}
      {isCafe && isCakeLike && cafeFlavors.length > 0 && renderRadioSelector("Escolha o sabor", "🍰", cafeFlavors, selectedFlavor, setSelectedFlavor, true)}

      {requiredAddonGroups.map(g => renderAddonGroup(g))}

      {showRequiredWarning && !allRequiredMet && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-xs font-bold text-destructive">
            Selecione todos os obrigatórios para continuar
          </span>
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
    if (!allRequiredMet) {
      setShowRequiredWarning(true);
      setTimeout(() => setShowRequiredWarning(false), 3000);
      return;
    }
    onAdd(product, buildCartAddons(), observations, quantity, unitPrice);
    onClose();
    resetState();
  };

  const primaryLabel = totalSteps === 2 && step === 1
    ? `Próximo: ${firstRequiredGroupName}`
    : isOutOfStock
      ? "Esgotado"
      : `Adicionar • ${formatBRL(lineTotal)}`;

  const primaryEnabled = totalSteps === 2 && step === 1
    ? true
    : allRequiredMet && !isOutOfStock;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetState(); } }}>
      <DialogContent
        className="p-0 gap-0 border-none bg-background shadow-2xl overflow-hidden
                   w-screen h-[100dvh] max-w-none rounded-none inset-0 translate-x-0 translate-y-0 fixed
                   md:w-full md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-3xl md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col h-full md:h-[90vh] relative bg-background">
          {/* HEADER COM STEPPER */}
          <div className="sticky top-0 z-[55] bg-background/95 backdrop-blur-md border-b">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => {
                  if (step === 2) setStep(1);
                  else { onClose(); resetState(); }
                }}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                aria-label={step === 2 ? "Voltar" : "Fechar"}
              >
                {step === 2 ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </button>
              <div className="flex-1 min-w-0">
                {totalSteps > 1 && (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Etapa {step} de {totalSteps}
                  </p>
                )}
                <p className="text-sm font-bold text-foreground truncate">
                  {step === 1 ? product.name : firstRequiredGroupName}
                </p>
              </div>
            </div>
            {totalSteps > 1 && (
              <Progress value={(step / totalSteps) * 100} className="h-1 rounded-none bg-muted" />
            )}
          </div>

          {/* CONTEÚDO COM ANIMAÇÃO */}
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: step === 2 ? 40 : -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: step === 2 ? -40 : 40 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {step === 1 ? Step1Content : Step2Content}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* RODAPÉ STICKY */}
          <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t p-4 flex items-center gap-3 z-[60] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-1 bg-muted rounded-2xl p-1 border border-muted-foreground/10 flex-shrink-0">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-xl bg-background shadow-sm flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
                disabled={quantity <= 1}
                aria-label="Diminuir"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-bold text-base w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-sm flex items-center justify-center active:scale-90 transition-transform"
                aria-label="Aumentar"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handlePrimary}
              disabled={!primaryEnabled}
              className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg px-3 ${
                primaryEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {!(totalSteps === 2 && step === 1) && <ShoppingCart className="h-5 w-5" />}
              <span className="truncate">{primaryLabel}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;
