import { formatBRL } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pizza, ShoppingCart, Check, Minus, Plus, ChevronLeft, Circle, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { CartAddon } from "@/contexts/CartContext";
import { readPizzaCatalogConfig, hasPizzaCatalog, type PizzaSizeCatalogItem } from "@/types/pizza";
import { priceForFlavorInSize, isFlavorAvailableInSize, combinePricesByMode } from "@/lib/pizzaPricing";

type FlavorCount = 2 | 3 | 4;
const FRACTION_LABEL: Record<FlavorCount, string> = { 2: "½", 3: "⅓", 4: "¼" };

interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  metadata?: Record<string, any>;
  section_id?: string | null;
}

interface MenuSection {
  id: string;
  name: string;
  sort_order: number;
}

interface Border {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  storeName: string;
  storeId: string;
  products: Product[];
  sections?: MenuSection[];
  priceMode: "maior" | "media";
  maxFlavors?: FlavorCount;
  singleSize?: boolean;
  onAdd: (product: {
    id: string;
    store_id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    metadata?: Record<string, any>;
  }, addons: CartAddon[], observations: string, quantity: number, unitPrice: number) => void;
}

// Step 0 = choose flavor count. Steps 1..flavorCount = pick each flavor. Last step = borders/observations.
type Step = number;

const PizzaHalfHalfModal = ({ open, onClose, storeName, storeId, products, sections, priceMode, maxFlavors = 4, singleSize = false, onAdd }: Props) => {
  const [flavorCount, setFlavorCount] = useState<FlavorCount>(2);
  // If lojista only allows meio a meio (max=2), skip the count picker entirely.
  const [step, setStep] = useState<Step>(maxFlavors === 2 ? 1 : 0);
  const [productIds, setProductIds] = useState<(string | null)[]>([null, null]);
  const [selectedBorderId, setSelectedBorderId] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const { data: borders = [], isLoading: bordersLoading } = useQuery({
    queryKey: ["pizza-borders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_borders")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Border[];
    },
    enabled: open && !!storeId,
  });

  // Catálogo profissional (tamanhos + matriz). Quando ausente, cai no modo legado.
  const { data: storeSettingsRow } = useQuery({
    queryKey: ["pizza-modal-store-settings", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
    enabled: open && !!storeId,
  });
  const catalog = readPizzaCatalogConfig((storeSettingsRow as any)?.settings);
  const catalogActive = !singleSize && hasPizzaCatalog(catalog);
  // Tamanhos com maxFlavors === 1 não entram no "Monte sua pizza" (não permitem divisão).
  const catalogActiveSizes = catalog.sizes.filter((s) => s.active && (s.maxFlavors ?? 4) >= 2);

  // Auto-select "Tradicional" border by default when borders are loaded
  useEffect(() => {
    if (open && borders.length > 0 && !selectedBorderId) {
      const tradicional = borders.find(b => 
        b.name.toLowerCase().includes("tradicional") || b.price === 0
      );
      if (tradicional) {
        setSelectedBorderId(tradicional.id);
      }
    }
  }, [borders, open, selectedBorderId]);

  const hasBorders = borders.length > 0;
  // Visible step count in the progress bar: N flavor picks + (borders if any). Step 0 (count) hidden.
  const totalSteps = flavorCount + (hasBorders ? 1 : 0);
  const borderStep = flavorCount + 1; // step index when borders are shown

  const reset = () => {
    setStep(maxFlavors === 2 ? 1 : 0);
    setFlavorCount(2);
    setProductIds([null, null]);
    setSelectedBorderId(null);
    setObservations("");
    setQuantity(1);
    setSelectedSize(null);
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const beverageSectionKeywords = ["bebida", "drink", "suco", "refrigerante", "água", "cerveja", "energético"];
  const beverageSectionIds = new Set(
    (sections || [])
      .filter(s => beverageSectionKeywords.some(kw => s.name.toLowerCase().includes(kw)))
      .map(s => s.id)
  );
  const pizzaProducts = products.filter(p => {
    if (p.metadata?.is_beverage) return false;
    if (p.section_id && beverageSectionIds.has(p.section_id)) return false;
    return true;
  });

  // Lista de tamanhos exibidos no passo 1.
  // - Catálogo profissional: usa o catálogo da loja (nomes consistentes).
  // - Legado: união dos `metadata.sizes` dos sabores.
  const availableSizes: string[] = (() => {
    if (catalogActive) return catalogActiveSizes.map((s) => s.name);
    const order: string[] = [];
    const seen = new Set<string>();
    for (const p of pizzaProducts) {
      const sizes: Array<{ name: string; price: number }> = Array.isArray(p.metadata?.sizes) ? p.metadata!.sizes : [];
      for (const s of sizes) {
        if (s?.name && Number(s.price) > 0 && !seen.has(s.name)) {
          seen.add(s.name);
          order.push(s.name);
        }
      }
    }
    return order;
  })();
  const hasSizes = !singleSize && availableSizes.length > 0;

  // Auto-select first size when sizes exist and none chosen yet
  useEffect(() => {
    if (open && hasSizes && !selectedSize) setSelectedSize(availableSizes[0]);
  }, [open, hasSizes, selectedSize, availableSizes]);

  // Máx. de sabores efetivo: respeita o limite do tamanho escolhido (catálogo) E o limite global da loja.
  const sizeMaxFlavors: FlavorCount = (() => {
    if (!catalogActive || !selectedSize) return maxFlavors;
    const size = catalogActiveSizes.find((s) => s.name === selectedSize);
    const cap = (size?.maxFlavors ?? 4) as 2 | 3 | 4;
    return Math.min(cap, maxFlavors) as FlavorCount;
  })();

  // Clampa flavorCount se o tamanho escolhido não suporta a quantidade atual.
  useEffect(() => {
    if (flavorCount > sizeMaxFlavors) {
      setFlavorCount(sizeMaxFlavors);
      setProductIds(Array(sizeMaxFlavors).fill(null));
    }
  }, [sizeMaxFlavors, flavorCount]);

  const priceForFlavor = (p: Product): number => {
    if (catalogActive) {
      const sizeItem: PizzaSizeCatalogItem | null = selectedSize
        ? catalogActiveSizes.find((s) => s.name === selectedSize) || null
        : null;
      return priceForFlavorInSize(
        { id: p.id, price: p.price, metadata: p.metadata as any },
        sizeItem,
        catalog,
      );
    }
    const sizes: Array<{ name: string; price: number }> = Array.isArray(p.metadata?.sizes) ? p.metadata!.sizes : [];
    if (selectedSize) {
      const match = sizes.find(s => s.name === selectedSize && Number(s.price) > 0);
      if (match) return Number(match.price);
    }
    return Number(p.price) || 0;
  };

  const selectedFlavors = productIds.map(id => (id ? pizzaProducts.find(p => p.id === id) : undefined));
  const allChosen = selectedFlavors.every(Boolean) && selectedFlavors.length === flavorCount;
  const selectedBorder = borders.find(b => b.id === selectedBorderId);

  const calcPizzaPrice = (): number => {
    if (!allChosen) return 0;
    const prices = selectedFlavors.map(p => priceForFlavor(p!));
    return combinePricesByMode(prices, priceMode);
  };

  const pizzaPrice = calcPizzaPrice();
  const borderPrice = selectedBorder?.price || 0;
  const unitPrice = pizzaPrice + borderPrice;
  const lineTotal = unitPrice * quantity;

  // Aviso quando algum sabor escolhido não tem o tamanho selecionado cadastrado
  const flavorsMissingSize: string[] = (selectedSize && allChosen && !catalogActive)
    ? (selectedFlavors as Product[])
        .filter(p => {
          const sizes: Array<{ name: string; price: number }> = Array.isArray(p.metadata?.sizes) ? p.metadata!.sizes : [];
          return !sizes.some(s => s.name === selectedSize && Number(s.price) > 0);
        })
        .map(p => p.name)
    : [];

  const handleAdd = () => {
    if (!allChosen) return;
    const flavors = selectedFlavors as Product[];
    const frac = FRACTION_LABEL[flavorCount];
    const title = flavorCount === 2 ? "Pizza Meio a Meio" : `Pizza ${flavorCount} Sabores`;
    const name = `${title}: ${flavors.map(f => f.name).join(" / ")}`;
    const addons: CartAddon[] = flavors.map(f => ({ name: `${frac} ${f.name}`, price: 0 }));
    if (selectedSize) {
      addons.unshift({ name: `Tamanho: ${selectedSize}`, price: 0 });
    }
    if (selectedBorder) {
      addons.push({ name: `Borda: ${selectedBorder.name}`, price: borderPrice });
    }
    onAdd(
      {
        id: flavors[0].id,
        store_id: storeId,
        name: selectedSize ? `${name} (${selectedSize})` : name,
        description: null,
        price: unitPrice,
        image_url: null,
        metadata: {
          is_half_half: flavorCount === 2,
          is_multi_flavor: flavorCount > 2,
          flavor_count: flavorCount,
          flavor_ids: flavors.map(f => f.id),
          border: selectedBorder?.name || null,
          size: selectedSize || null,
        },
      },
      addons,
      observations,
      quantity,
      unitPrice
    );
    handleClose();
  };

  // Group products by section
  const groupedProducts = (() => {
    if (!sections || sections.length === 0) {
      return [{ section: null, items: pizzaProducts }];
    }
    const sectionMap = new Map<string, Product[]>();
    const unsectioned: Product[] = [];
    for (const p of pizzaProducts) {
      if (p.section_id) {
        const existing = sectionMap.get(p.section_id) || [];
        existing.push(p);
        sectionMap.set(p.section_id, existing);
      } else {
        unsectioned.push(p);
      }
    }
    const groups: { section: MenuSection | null; items: Product[] }[] = [];
    for (const sec of sections) {
      const items = sectionMap.get(sec.id);
      if (items && items.length > 0) groups.push({ section: sec, items });
    }
    if (unsectioned.length > 0) groups.push({ section: null, items: unsectioned });
    return groups;
  })();

  const ordinal = (n: number) => ["1º", "2º", "3º", "4º"][n - 1] || `${n}º`;
  const stepLabel = (s: Step): string => {
    if (s === 0) return "Quantos sabores?";
    if (s === borderStep) return "Escolha a borda";
    return `Escolha o ${ordinal(s)} sabor`;
  };

  const isFlavorStep = step >= 1 && step <= flavorCount;
  const currentFlavorIdx = isFlavorStep ? step - 1 : -1;

  const canAdvance = () => {
    if (step === 0) return true;
    if (isFlavorStep) return !!productIds[currentFlavorIdx];
    if (step === borderStep) return hasBorders ? !!selectedBorderId : true;
    return false;
  };

  const handleNext = () => {
    if (step === 0) { setStep(1); return; }
    if (isFlavorStep && productIds[currentFlavorIdx]) setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 0) { handleClose(); return; }
    if (step === 1) { setStep(0); return; }
    if (isFlavorStep) {
      // clear current selection before going back
      setProductIds(prev => {
        const next = [...prev];
        next[currentFlavorIdx] = null;
        return next;
      });
      setStep(step - 1);
      return;
    }
    if (step === borderStep) { setSelectedBorderId(null); setStep(flavorCount); }
  };

  const setCurrentFlavor = (id: string) => {
    setProductIds(prev => {
      const next = [...prev];
      next[currentFlavorIdx] = id;
      return next;
    });
  };

  const handleFlavorCountChange = (n: FlavorCount) => {
    setFlavorCount(n);
    setProductIds(Array(n).fill(null));
    setSelectedBorderId(null);
  };

  // Final step: borders step OR last flavor step when there are no borders
  const isFinalStep =
    step === borderStep ||
    (step === flavorCount && !hasBorders && !bordersLoading);

   useEffect(() => {
     if (open) {
       document.body.style.overflow = "hidden";
     } else {
       document.body.style.overflow = "";
     }
     return () => {
       document.body.style.overflow = "";
     };
   }, [open]);
 
   if (!open) return null;
 
   return (
     <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background sticky top-0 z-20">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-foreground truncate">Monte sua Pizza</h1>
          <p className="text-xs text-muted-foreground">{storeName}</p>
        </div>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
        >
          <X className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Progress bar + step label */}
      <div className="px-4 pt-4 pb-2 bg-background">
        {step > 0 && (
          <div className="flex gap-2 mb-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            {step === borderStep ? <Circle className="h-5 w-5 text-primary" /> : <Pizza className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {step === 0 ? "Comece por aqui" : `Etapa ${step} de ${totalSteps}`}
            </p>
            <p className="text-xs text-muted-foreground font-medium">{stepLabel(step)}</p>
          </div>
        </div>

        {/* Summary chip */}
        {(selectedFlavors.some(Boolean) || selectedBorder) && step > 0 && (
          <div className="flex items-center gap-2 mt-3 bg-muted/60 rounded-xl px-3 py-2.5">
            <span className="text-lg">🍕</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {selectedFlavors.map((f, i) =>
                  f ? (
                    <span key={i} className="font-bold text-foreground">
                      {i > 0 && <span className="text-muted-foreground mr-1">+</span>}
                      {FRACTION_LABEL[flavorCount]} {f.name}
                    </span>
                  ) : null
                )}
                {selectedBorder && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-bold text-foreground">{selectedBorder.name}</span>
                  </>
                )}
              </div>
              {allChosen && (
                <span className="text-[10px] text-muted-foreground">
                  Pizza {formatBRL(pizzaPrice)}
                  {borderPrice > 0 && ` + Borda ${formatBRL(borderPrice)}`}
                  {" = " + formatBRL(unitPrice)}
                </span>
              )}
              {flavorsMissingSize.length > 0 && (
                <div className="mt-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  ⚠ {flavorsMissingSize.join(", ")} sem preço para "{selectedSize}". Usando preço base.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        {/* Step 0: choose flavor count */}
        {step === 0 && (
          <div className="space-y-3 pt-4">
            {/* Tamanho primeiro, para limitar a quantidade de sabores conforme cadastro do tamanho */}
            {catalogActive && hasSizes && availableSizes.length > 1 && (
              <div className="bg-card border-2 border-border rounded-2xl p-3 space-y-2 shadow-sm">
                <p className="text-xs font-bold text-foreground/80">📏 Escolha o tamanho</p>
                <div className="flex flex-wrap gap-2">
                  {catalogActiveSizes.map((sz) => {
                    const isSel = selectedSize === sz.name;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setSelectedSize(sz.name)}
                        className={`px-3 py-2 rounded-xl border-2 text-left transition-all ${
                          isSel
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="text-sm font-bold leading-tight">{sz.name}</div>
                        <div className="text-[10px] opacity-80">
                          {sz.description ? `${sz.description} · ` : ""}até {sz.maxFlavors ?? 4} sabores
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">Escolha quantos sabores diferentes você quer na sua pizza:</p>
            <div className="grid grid-cols-3 gap-3">
              {([2, 3, 4] as FlavorCount[]).filter(n => n <= sizeMaxFlavors).map(n => {
                const isSel = flavorCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleFlavorCountChange(n)}
                    className={`flex flex-col items-center justify-center py-6 rounded-2xl border-2 transition-all ${
                      isSel
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-card border-transparent hover:bg-muted"
                    }`}
                  >
                    <span className="text-3xl font-black text-foreground">{n}</span>
                    <span className="text-xs font-bold text-muted-foreground mt-1">
                      {n === 2 ? "Meio a meio" : `${n} sabores`}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{FRACTION_LABEL[n]} cada</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Flavor pick step */}
        {isFlavorStep && (
          <div className="space-y-3 pt-2">
            {!catalogActive && hasSizes && step === 1 && (
              <div className="bg-card border-2 border-border rounded-2xl p-3 space-y-2 shadow-sm">
                <p className="text-xs font-bold text-foreground/80">📏 Escolha o tamanho</p>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map(size => {
                    const isSel = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                          isSel
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  O preço de cada sabor pode variar conforme o tamanho.
                </p>
              </div>
            )}
            {groupedProducts.map((group, idx) => {
              const chosenIds = new Set(
                productIds
                  .map((id, i) => (i !== currentFlavorIdx ? id : null))
                  .filter(Boolean) as string[]
              );
              const sizeId = catalogActive && selectedSize
                ? (catalogActiveSizes.find((s) => s.name === selectedSize)?.id || null)
                : null;
              const items = group.items.filter((p) => {
                if (chosenIds.has(p.id)) return false;
                if (catalogActive && sizeId) {
                  return isFlavorAvailableInSize({ id: p.id, price: p.price, metadata: p.metadata as any }, sizeId);
                }
                return true;
              });
              if (items.length === 0) return null;
              const selectedId = productIds[currentFlavorIdx];
              const onSelect = setCurrentFlavor;
              return (
                <div key={group.section?.id || `unsectioned-${idx}`}>
                  {group.section && (
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 px-1 mb-1">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {group.section.name}
                      </h3>
                    </div>
                  )}
                  <div className="space-y-2">
                    {items.map(product => {
                      const isSelected = product.id === selectedId;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => onSelect(product.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${
                            isSelected
                              ? "bg-primary/10 border-2 border-primary shadow-sm"
                              : "bg-card border-2 border-transparent hover:bg-muted shadow-sm"
                          }`}
                        >
                          {product.image_url ? (
                            <img loading="lazy" decoding="async" src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-foreground">{product.name}</span>
                            {product.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{product.description}</p>
                            )}
                          </div>
                          <span className="text-sm font-black text-primary whitespace-nowrap">
                            {formatBRL(priceForFlavor(product))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {pizzaProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhum sabor cadastrado ainda.</p>
            )}

            {/* When the store has no borders, show observations on the last flavor step (final step) */}
            {step === flavorCount && !hasBorders && !bordersLoading && productIds[currentFlavorIdx] && (
              <div className="pt-4">
                <label className="text-sm font-bold text-foreground mb-1.5 block">Observações</label>
                <Textarea
                  placeholder="Ex: Sem cebola..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="resize-none h-20 rounded-xl"
                  maxLength={200}
                  autoFocus={false}
                  tabIndex={-1}
                />
              </div>
            )}
          </div>
        )}

        {/* Border step + observations (only shown when store has borders) */}
        {step === borderStep && hasBorders && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              {borders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma borda disponível.</p>
              ) : (
                borders.map(border => {
                  const isSelected = border.id === selectedBorderId;
                  return (
                    <button
                      key={border.id}
                      type="button"
                      onClick={() => setSelectedBorderId(border.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border-2 border-primary shadow-sm"
                          : "bg-card border-2 border-transparent hover:bg-muted shadow-sm"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-foreground">{border.name}</span>
                      </div>
                      <span className="text-sm font-black text-primary whitespace-nowrap">
                        {border.price > 0 ? `+ ${formatBRL(border.price)}` : "Grátis"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">Observações</label>
              <Textarea
                placeholder="Ex: Sem cebola..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="resize-none h-20 rounded-xl"
                maxLength={200}
                autoFocus={false}
                tabIndex={-1}
              />
            </div>
          </div>
        )}
      </div>

       {/* Fixed bottom bar */}
       <div className="fixed bottom-0 left-0 right-0 z-[110] bg-background border-t px-4 py-3 pb-8 md:pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {!isFinalStep ? (
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="py-4 px-5 rounded-xl font-bold text-base bg-muted text-foreground active:scale-[0.98] transition-all"
              >
                ← Anterior
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className={`flex-1 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                canAdvance()
                  ? "bg-primary text-primary-foreground shadow-lg active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              Próximo →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="py-4 px-5 rounded-xl font-bold text-base bg-muted text-foreground active:scale-[0.98] transition-all"
              >
                ← Anterior
              </button>
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full bg-background flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-black text-lg w-7 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={hasBorders && !selectedBorderId}
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                (!hasBorders || selectedBorderId)
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              Adicionar • {formatBRL(lineTotal)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PizzaHalfHalfModal;
