import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pizza, ShoppingCart, Check, Minus, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { CartAddon } from "@/contexts/CartContext";

interface PizzaFlavor {
  id: string;
  name: string;
  prices: Record<string, number>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  storeName: string;
  storeId: string;
  flavors: PizzaFlavor[];
  sizes: string[];
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

const PizzaHalfHalfModal = ({ open, onClose, storeName, storeId, flavors, sizes, priceMode, onAdd }: Props) => {
  const [flavor1, setFlavor1] = useState<string | null>(null);
  const [flavor2, setFlavor2] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const reset = () => {
    setFlavor1(null);
    setFlavor2(null);
    setSelectedSize(null);
    setObservations("");
    setQuantity(1);
    setStep(1);
  };

  const f1 = flavors.find(f => f.id === flavor1);
  const f2 = flavors.find(f => f.id === flavor2);

  const calcPrice = (size: string): number => {
    if (!f1 || !f2) return 0;
    const p1 = (f1.prices[size] || 0) / 100;
    const p2 = (f2.prices[size] || 0) / 100;
    if (priceMode === "media") return (p1 + p2) / 2;
    return Math.max(p1, p2);
  };

  const availableSizes = useMemo(() => {
    if (!f1 || !f2) return [];
    return sizes.filter(s => {
      const p1 = f1.prices[s] || 0;
      const p2 = f2.prices[s] || 0;
      return p1 > 0 && p2 > 0;
    });
  }, [f1, f2, sizes]);

  const unitPrice = selectedSize ? calcPrice(selectedSize) : 0;
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    if (!f1 || !f2 || !selectedSize) return;
    const name = `Pizza Meio a Meio: ${f1.name} / ${f2.name}`;
    const addons: CartAddon[] = [
      { name: `½ ${f1.name}`, price: 0 },
      { name: `½ ${f2.name}`, price: 0 },
      { name: `Tamanho: ${selectedSize}`, price: 0 },
    ];
    onAdd(
      {
        id: `half-${f1.id}-${f2.id}-${selectedSize}`,
        store_id: storeId,
        name,
        description: null,
        price: unitPrice,
        image_url: null,
        metadata: { is_half_half: true },
      },
      addons,
      observations,
      quantity,
      unitPrice
    );
    onClose();
    reset();
  };

  const selectFlavor = (id: string) => {
    if (step === 1) {
      setFlavor1(id);
      setStep(2);
    } else if (step === 2) {
      if (id === flavor1) return;
      setFlavor2(id);
      setStep(3);
    }
  };

  const stepTitle = step === 1 ? "Escolha o 1º sabor" : step === 2 ? "Escolha o 2º sabor" : "Escolha o tamanho";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-y-auto rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Pizza className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Monte sua Pizza</h2>
              <p className="text-xs text-muted-foreground">Meio a Meio • {storeName}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => {
                    if (s === 1) { setStep(1); setFlavor1(null); setFlavor2(null); setSelectedSize(null); }
                    else if (s === 2 && flavor1) { setStep(2); setFlavor2(null); setSelectedSize(null); }
                    else if (s === 3 && flavor1 && flavor2) setStep(3);
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="h-3.5 w-3.5" /> : s}
                </button>
                {s < 3 && <div className={`flex-1 h-0.5 rounded-full ${step > s ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {/* Selected summary */}
          {(f1 || f2) && (
            <div className="flex items-center gap-2 mt-3 bg-card/80 rounded-xl px-3 py-2">
              <span className="text-lg">🍕</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-xs">
                  {f1 && <span className="font-bold text-foreground truncate">½ {f1.name}</span>}
                  {f1 && f2 && <span className="text-muted-foreground">+</span>}
                  {f2 && <span className="font-bold text-foreground truncate">½ {f2.name}</span>}
                </div>
                {selectedSize && (
                  <span className="text-[10px] text-muted-foreground">{selectedSize} • R$ {unitPrice.toFixed(2)}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">{stepTitle}</h3>

          {/* Steps 1 & 2: Flavor selection */}
          {(step === 1 || step === 2) && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {flavors.map(flavor => {
                const isSelected = flavor.id === flavor1 || flavor.id === flavor2;
                const isDisabled = step === 2 && flavor.id === flavor1;
                const priceRange = sizes
                  .filter(s => flavor.prices[s] && flavor.prices[s] > 0)
                  .map(s => (flavor.prices[s] / 100));
                const minPrice = priceRange.length > 0 ? Math.min(...priceRange) : 0;

                return (
                  <button
                    key={flavor.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectFlavor(flavor.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : isSelected
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
                      <span className="text-sm font-bold text-foreground">{flavor.name}</span>
                    </div>
                    {minPrice > 0 && (
                      <span className="text-xs text-muted-foreground">
                        a partir de R$ {minPrice.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Size selection + observations + add */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                {availableSizes.map(size => {
                  const price = calcPrice(size);
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all text-left ${
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
                      <span className={`flex-1 text-sm ${isSelected ? "font-bold" : ""} text-foreground`}>{size}</span>
                      <span className={`text-sm font-black ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                        R$ {price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {availableSizes.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Nenhum tamanho disponível para esses sabores.
                </div>
              )}

              {/* Price mode info */}
              <p className="text-[10px] text-muted-foreground text-center">
                {priceMode === "maior"
                  ? "💡 O valor cobrado é do sabor mais caro"
                  : "💡 O valor cobrado é a média dos dois sabores"}
              </p>

              {/* Observations */}
              <div>
                <label className="text-sm font-bold text-foreground mb-1.5 block">Observações</label>
                <Textarea
                  placeholder="Ex: Sem cebola, borda recheada..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="resize-none h-20 rounded-xl"
                  maxLength={200}
                  autoFocus={false}
                  tabIndex={-1}
                />
              </div>

              {/* Quantity + Add */}
              <div className="flex items-center gap-4 pt-2">
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
                  disabled={!selectedSize}
                  onClick={handleAdd}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    selectedSize
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {selectedSize ? `Adicionar • R$ ${lineTotal.toFixed(2)}` : "Escolha o tamanho"}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PizzaHalfHalfModal;
