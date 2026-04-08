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

const PizzaHalfHalfModal = ({ open, onClose, storeName, storeId, products, priceMode, onAdd }: Props) => {
  const [product1Id, setProduct1Id] = useState<string | null>(null);
  const [product2Id, setProduct2Id] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<1 | 2>(1);

  const reset = () => {
    setProduct1Id(null);
    setProduct2Id(null);
    setObservations("");
    setQuantity(1);
    setStep(1);
  };

  // Filter only non-beverage pizza products
  const pizzaProducts = useMemo(() =>
    products.filter(p => !p.metadata?.is_beverage && p.price > 0),
    [products]
  );

  const p1 = pizzaProducts.find(p => p.id === product1Id);
  const p2 = pizzaProducts.find(p => p.id === product2Id);

  const calcPrice = (): number => {
    if (!p1 || !p2) return 0;
    if (priceMode === "media") return (p1.price + p2.price) / 2;
    return Math.max(p1.price, p2.price);
  };

  const unitPrice = calcPrice();
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    if (!p1 || !p2) return;
    const name = `Pizza Meio a Meio: ${p1.name} / ${p2.name}`;
    const addons: CartAddon[] = [
      { name: `½ ${p1.name}`, price: 0 },
      { name: `½ ${p2.name}`, price: 0 },
    ];
    onAdd(
      {
        id: `half-${p1.id}-${p2.id}`,
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

  const selectProduct = (id: string) => {
    if (step === 1) {
      setProduct1Id(id);
      setStep(2);
    } else if (step === 2) {
      if (id === product1Id) return;
      setProduct2Id(id);
    }
  };

  const bothSelected = !!p1 && !!p2;
  const stepTitle = step === 1 ? "Escolha o 1º sabor" : !p2 ? "Escolha o 2º sabor" : "Finalize seu pedido";

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
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => {
                    if (s === 1) { setStep(1); setProduct1Id(null); setProduct2Id(null); }
                    else if (s === 2 && product1Id) { setStep(2); setProduct2Id(null); }
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    (s === 1 && product1Id) || (s === 2 && product2Id)
                      ? "bg-primary text-primary-foreground"
                      : step === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {(s === 1 && product1Id) || (s === 2 && product2Id) ? <Check className="h-3.5 w-3.5" /> : s}
                </button>
                {s < 2 && <div className={`flex-1 h-0.5 rounded-full ${product1Id ? "bg-primary" : "bg-muted"}`} />}
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
                {bothSelected && (
                  <span className="text-[10px] text-muted-foreground">R$ {unitPrice.toFixed(2)}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">{stepTitle}</h3>

          {/* Product selection list */}
          {!bothSelected && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {pizzaProducts.map(product => {
                const isSelected = product.id === product1Id || product.id === product2Id;
                const isDisabled = step === 2 && product.id === product1Id;

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
                    <span className="text-xs font-black text-primary">
                      R$ {product.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Both selected: show final details */}
          {bothSelected && (
            <div className="space-y-4">
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
