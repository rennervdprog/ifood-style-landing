import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pizza, ShoppingCart, Check, Minus, Plus, ChevronLeft, Circle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { CartAddon } from "@/contexts/CartContext";

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

type Step = 1 | 2 | 3;

const PizzaHalfHalfModal = ({ open, onClose, storeName, storeId, products, sections, priceMode, onAdd }: Props) => {
  const [step, setStep] = useState<Step>(1);
  const [product1Id, setProduct1Id] = useState<string | null>(null);
  const [product2Id, setProduct2Id] = useState<string | null>(null);
  const [selectedBorderId, setSelectedBorderId] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);

  const { data: borders = [] } = useQuery({
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

  const reset = () => {
    setStep(1);
    setProduct1Id(null);
    setProduct2Id(null);
    setSelectedBorderId(null);
    setObservations("");
    setQuantity(1);
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

  const p1 = pizzaProducts.find(p => p.id === product1Id);
  const p2 = pizzaProducts.find(p => p.id === product2Id);
  const selectedBorder = borders.find(b => b.id === selectedBorderId);

  const calcPizzaPrice = (): number => {
    if (!p1 || !p2) return 0;
    if (priceMode === "media") return (p1.price + p2.price) / 2;
    return Math.max(p1.price, p2.price);
  };

  const pizzaPrice = calcPizzaPrice();
  const borderPrice = selectedBorder?.price || 0;
  const unitPrice = pizzaPrice + borderPrice;
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    if (!p1 || !p2) return;
    const borderName = selectedBorder?.name || "Borda Tradicional";
    const name = `Pizza Meio a Meio: ${p1.name} / ${p2.name}`;
    const addons: CartAddon[] = [
      { name: `½ ${p1.name}`, price: 0 },
      { name: `½ ${p2.name}`, price: 0 },
    ];
    if (selectedBorder && selectedBorder.price > 0) {
      addons.push({ name: `Borda: ${borderName}`, price: borderPrice });
    } else {
      addons.push({ name: `Borda: ${borderName}`, price: 0 });
    }
    onAdd(
      {
        id: `half-${p1.id}-${p2.id}-${selectedBorderId || "trad"}`,
        store_id: storeId,
        name,
        description: null,
        price: unitPrice,
        image_url: null,
        metadata: { is_half_half: true, border: borderName },
      },
      addons,
      observations,
      quantity,
      unitPrice
    );
    onClose();
    reset();
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

  const stepLabels: Record<Step, string> = {
    1: "Escolha o 1º sabor",
    2: "Escolha o 2º sabor",
    3: "Escolha a borda",
  };

  const renderProductList = (onSelect: (id: string) => void, selectedId: string | null, excludeId?: string | null) => (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto">
      {groupedProducts.map((group, idx) => {
        const items = excludeId ? group.items.filter(p => p.id !== excludeId) : group.items;
        if (items.length === 0) return null;
        return (
          <div key={group.section?.id || `unsectioned-${idx}`}>
            {group.section && (
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 px-1 mb-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {group.section.name}
                </h3>
              </div>
            )}
            <div className="space-y-1.5">
              {items.map(product => {
                const isSelected = product.id === selectedId;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onSelect(product.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      isSelected
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-background border-2 border-transparent hover:bg-muted"
                    }`}
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
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
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{product.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-black text-primary whitespace-nowrap">
                      R$ {product.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {pizzaProducts.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum sabor cadastrado ainda.</p>
      )}
    </div>
  );

  const renderBorderList = () => (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
      {borders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma borda disponível.</p>
      ) : (
        borders.map(border => {
          const isSelected = border.id === selectedBorderId;
          return (
            <button
              key={border.id}
              type="button"
              onClick={() => setSelectedBorderId(border.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                isSelected
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-background border-2 border-transparent hover:bg-muted"
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
              <span className="text-xs font-black text-primary whitespace-nowrap">
                {border.price > 0 ? `+ R$ ${border.price.toFixed(2)}` : "Grátis"}
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  const canAdvance = () => {
    if (step === 1) return !!product1Id;
    if (step === 2) return !!product2Id;
    if (step === 3) return !!selectedBorderId;
    return false;
  };

  const handleNext = () => {
    if (step === 1 && product1Id) setStep(2);
    else if (step === 2 && product2Id) setStep(3);
  };

  const handleBack = () => {
    if (step === 2) { setProduct2Id(null); setStep(1); }
    else if (step === 3) { setSelectedBorderId(null); setStep(2); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-y-auto rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={handleBack} className="w-8 h-8 rounded-full bg-card/80 flex items-center justify-center">
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
              {step === 3 ? <Circle className="h-6 w-6 text-primary" /> : <Pizza className="h-6 w-6 text-primary" />}
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Monte sua Pizza</h2>
              <p className="text-xs text-muted-foreground">Etapa {step} de 3 • {storeName}</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= step ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-2 font-bold">
            {stepLabels[step]}
          </p>

          {/* Summary of selections */}
          {(p1 || p2 || selectedBorder) && (
            <div className="flex items-center gap-2 mt-2 bg-card/80 rounded-xl px-3 py-2">
              <span className="text-lg">🍕</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {p1 && <span className="font-bold text-foreground">½ {p1.name}</span>}
                  {p1 && p2 && <span className="text-muted-foreground">+</span>}
                  {p2 && <span className="font-bold text-foreground">½ {p2.name}</span>}
                  {selectedBorder && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-bold text-foreground">{selectedBorder.name}</span>
                    </>
                  )}
                </div>
                {p1 && p2 && (
                  <span className="text-[10px] text-muted-foreground">
                    Pizza R$ {pizzaPrice.toFixed(2)}
                    {borderPrice > 0 && ` + Borda R$ ${borderPrice.toFixed(2)}`}
                    {" = R$ " + unitPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: First flavor */}
          {step === 1 && renderProductList(
            (id) => setProduct1Id(id),
            product1Id
          )}

          {/* Step 2: Second flavor */}
          {step === 2 && renderProductList(
            (id) => setProduct2Id(id),
            product2Id,
            product1Id
          )}

          {/* Step 3: Border */}
          {step === 3 && renderBorderList()}

          {/* Navigation / Add button */}
          <div className="border-t pt-4">
            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance()}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  canAdvance()
                    ? "bg-primary text-primary-foreground shadow-lg active:scale-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                Próximo →
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-foreground mb-1.5 block">Observações</label>
                  <Textarea
                    placeholder="Ex: Sem cebola..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="resize-none h-16 rounded-xl"
                    maxLength={200}
                    autoFocus={false}
                    tabIndex={-1}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="font-black text-lg w-6 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleAdd}
                    disabled={!selectedBorderId}
                    className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      selectedBorderId
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Adicionar • R$ {lineTotal.toFixed(2)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PizzaHalfHalfModal;
