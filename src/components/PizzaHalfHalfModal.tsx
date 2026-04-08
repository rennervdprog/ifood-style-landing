import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pizza, ShoppingCart, Check, Minus, Plus } from "lucide-react";
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
}

interface Props {
  open: boolean;
  onClose: () => void;
  storeName: string;
  storeId: string;
  products: Product[];
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

const sizeLabels: Record<string, string> = { broto: "Broto", media: "Média", grande: "Grande", familia: "Família" };
const sizeOrder = ["broto", "media", "grande", "familia"];

const getDisplayPrice = (p: Product): number => {
  const sizes = p.metadata?.pizza_sizes as Record<string, number> | undefined;
  if (sizes) {
    return sizes.grande ?? sizes.media ?? sizes.familia ?? sizes.broto ?? Object.values(sizes)[0] ?? p.price;
  }
  return p.price;
};

const PizzaHalfHalfModal = ({ open, onClose, storeName, storeId, products, priceMode, onAdd }: Props) => {
  const [product1Id, setProduct1Id] = useState<string | null>(null);
  const [product2Id, setProduct2Id] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const reset = () => {
    setProduct1Id(null);
    setProduct2Id(null);
    setSelectedSize(null);
    setObservations("");
    setQuantity(1);
    setStep(1);
  };

  const pizzaProducts = useMemo(() =>
    products.filter(p => !p.metadata?.is_beverage),
    [products]
  );

  const p1 = pizzaProducts.find(p => p.id === product1Id);
  const p2 = pizzaProducts.find(p => p.id === product2Id);

  // Common sizes between both products
  const availableSizes = useMemo(() => {
    if (!p1 || !p2) return [];
    const s1 = p1.metadata?.pizza_sizes as Record<string, number> | undefined;
    const s2 = p2.metadata?.pizza_sizes as Record<string, number> | undefined;
    if (!s1 && !s2) return [];
    if (!s1 || !s2) return [];
    const common = sizeOrder.filter(k => k in s1 && k in s2);
    return common.map(k => ({ key: k, label: sizeLabels[k] || k, price1: s1[k], price2: s2[k] }));
  }, [p1, p2]);

  const hasSizes = availableSizes.length > 0;

  const calcPrice = (): number => {
    if (!p1 || !p2) return 0;
    if (hasSizes && selectedSize) {
      const size = availableSizes.find(s => s.key === selectedSize);
      if (size) {
        if (priceMode === "media") return (size.price1 + size.price2) / 2;
        return Math.max(size.price1, size.price2);
      }
    }
    // Fallback to base price
    const pr1 = getDisplayPrice(p1);
    const pr2 = getDisplayPrice(p2);
    if (priceMode === "media") return (pr1 + pr2) / 2;
    return Math.max(pr1, pr2);
  };

  const unitPrice = calcPrice();
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    if (!p1 || !p2) return;
    const sizeSuffix = selectedSize ? ` (${sizeLabels[selectedSize] || selectedSize})` : "";
    const name = `Pizza Meio a Meio${sizeSuffix}: ${p1.name} / ${p2.name}`;
    const addons: CartAddon[] = [
      { name: `½ ${p1.name}`, price: 0 },
      { name: `½ ${p2.name}`, price: 0 },
    ];
    onAdd(
      {
        id: `half-${p1.id}-${p2.id}-${selectedSize || "def"}`,
        store_id: storeId,
        name,
        description: null,
        price: unitPrice,
        image_url: null,
        metadata: { is_half_half: true, size: selectedSize },
      },
      addons,
      observations,
      quantity,
      unitPrice
    );
    onClose();
    reset();
  };

  const selectProduct = (id: string) => {
    if (step === 1) {
      setProduct1Id(id);
      setStep(2);
    } else if (step === 2) {
      if (id === product1Id) return;
      setProduct2Id(id);
      setStep(3);
    }
  };

  const readyToAdd = !!p1 && !!p2 && (hasSizes ? !!selectedSize : true);
  const stepTitle = step === 1 ? "Escolha o 1º sabor" : step === 2 ? "Escolha o 2º sabor" : hasSizes && !selectedSize ? "Escolha o tamanho" : "Finalize seu pedido";

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
                    if (s === 1) { setStep(1); setProduct1Id(null); setProduct2Id(null); setSelectedSize(null); }
                    else if (s === 2 && product1Id) { setStep(2); setProduct2Id(null); setSelectedSize(null); }
                    else if (s === 3 && product2Id) { setStep(3); setSelectedSize(null); }
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    (s === 1 && product1Id) || (s === 2 && product2Id) || (s === 3 && selectedSize)
                      ? "bg-primary text-primary-foreground"
                      : step === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {(s === 1 && product1Id) || (s === 2 && product2Id) || (s === 3 && selectedSize) ? <Check className="h-3.5 w-3.5" /> : s}
                </button>
                {s < 3 && <div className={`flex-1 h-0.5 rounded-full ${
                  (s === 1 && product1Id) || (s === 2 && product2Id) ? "bg-primary" : "bg-muted"
                }`} />}
              </div>
            ))}
          </div>

          {/* Selected summary */}
          {(p1 || p2) && (
            <div className="flex items-center gap-2 mt-3 bg-card/80 rounded-xl px-3 py-2">
              <span className="text-lg">🍕</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-xs">
                  {p1 && <span className="font-bold text-foreground truncate">½ {p1.name}</span>}
                  {p1 && p2 && <span className="text-muted-foreground">+</span>}
                  {p2 && <span className="font-bold text-foreground truncate">½ {p2.name}</span>}
                </div>
                {selectedSize && (
                  <span className="text-[10px] text-muted-foreground">
                    {sizeLabels[selectedSize]} • R$ {unitPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">{stepTitle}</h3>

          {/* Product selection list (step 1 & 2) */}
          {(step === 1 || step === 2) && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {pizzaProducts.map(product => {
                const isSelected = product.id === product1Id || product.id === product2Id;
                const isDisabled = step === 2 && product.id === product1Id;
                const displayPrice = getDisplayPrice(product);

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectProduct(product.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : isSelected
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
                    {displayPrice > 0 && (
                      <span className="text-xs font-black text-primary">
                        R$ {displayPrice.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
              {pizzaProducts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum sabor cadastrado ainda.</p>
              )}
            </div>
          )}

          {/* Size selection (step 3, if sizes exist) */}
          {step === 3 && hasSizes && !selectedSize && (
            <div className="space-y-2">
              {availableSizes.map(size => {
                const price = priceMode === "media" ? (size.price1 + size.price2) / 2 : Math.max(size.price1, size.price2);
                return (
                  <button
                    key={size.key}
                    type="button"
                    onClick={() => setSelectedSize(size.key)}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-background border-2 border-transparent hover:bg-muted transition-all"
                  >
                    <span className="text-sm font-bold text-foreground">{size.label}</span>
                    <span className="text-sm font-black text-primary">R$ {price.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Final: observations + add to cart */}
          {step === 3 && readyToAdd && (
            <div className="space-y-4">
              <p className="text-[10px] text-muted-foreground text-center">
                {priceMode === "maior"
                  ? "💡 O valor cobrado é do sabor mais caro"
                  : "💡 O valor cobrado é a média dos dois sabores"}
              </p>

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
                  onClick={handleAdd}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-primary text-primary-foreground shadow-lg"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Adicionar • R$ {lineTotal.toFixed(2)}
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
