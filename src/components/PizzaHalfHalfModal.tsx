import { useState } from "react";
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
  section_id?: string | null;
}

interface MenuSection {
  id: string;
  name: string;
  sort_order: number;
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

const PizzaHalfHalfModal = ({ open, onClose, storeName, storeId, products, sections, priceMode, onAdd }: Props) => {
  const [product1Id, setProduct1Id] = useState<string | null>(null);
  const [product2Id, setProduct2Id] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);

  const reset = () => {
    setProduct1Id(null);
    setProduct2Id(null);
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
  const bothSelected = !!p1 && !!p2;

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
      [
        { name: `½ ${p1.name}`, price: 0 },
        { name: `½ ${p2.name}`, price: 0 },
      ],
      observations,
      quantity,
      unitPrice
    );
    onClose();
    reset();
  };

  const toggleProduct = (id: string) => {
    if (id === product1Id) {
      setProduct1Id(null);
      setProduct2Id(null);
      return;
    }
    if (id === product2Id) {
      setProduct2Id(null);
      return;
    }
    if (!product1Id) {
      setProduct1Id(id);
    } else if (!product2Id) {
      setProduct2Id(id);
    }
  };

  const selectedCount = (product1Id ? 1 : 0) + (product2Id ? 1 : 0);

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
      if (items && items.length > 0) {
        groups.push({ section: sec, items });
      }
    }
    if (unsectioned.length > 0) {
      groups.push({ section: null, items: unsectioned });
    }

    return groups;
  })();

  const renderProductButton = (product: Product) => {
    const isSelected = product.id === product1Id || product.id === product2Id;
    const isDisabled = selectedCount >= 2 && !isSelected;

    return (
      <button
        key={product.id}
        type="button"
        disabled={isDisabled}
        onClick={() => toggleProduct(product.id)}
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
        <span className="text-xs font-black text-primary whitespace-nowrap">
          R$ {product.price.toFixed(2)}
        </span>
      </button>
    );
  };

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

          <p className="text-xs text-muted-foreground mt-3">
            Selecione <strong>2 sabores</strong> ({selectedCount}/2)
          </p>

          {/* Selected summary */}
          {(p1 || p2) && (
            <div className="flex items-center gap-2 mt-2 bg-card/80 rounded-xl px-3 py-2">
              <span className="text-lg">🍕</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-xs">
                  {p1 && <span className="font-bold text-foreground truncate">½ {p1.name}</span>}
                  {p1 && p2 && <span className="text-muted-foreground">+</span>}
                  {p2 && <span className="font-bold text-foreground truncate">½ {p2.name}</span>}
                </div>
                {bothSelected && (
                  <span className="text-[10px] text-muted-foreground">
                    {priceMode === "maior" ? "Valor do maior" : "Média dos valores"} • R$ {unitPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Product list grouped by section */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {groupedProducts.map((group, idx) => (
              <div key={group.section?.id || `unsectioned-${idx}`}>
                {group.section && (
                  <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 px-1 mb-1">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {group.section.name}
                    </h3>
                  </div>
                )}
                <div className="space-y-1.5">
                  {group.items.map(renderProductButton)}
                </div>
              </div>
            ))}
            {pizzaProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum sabor cadastrado ainda.</p>
            )}
          </div>

          {/* Observations + Add (when both selected) */}
          {bothSelected && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-[10px] text-muted-foreground text-center">
                {priceMode === "maior"
                  ? "💡 Valor cobrado: sabor mais caro"
                  : "💡 Valor cobrado: média dos dois sabores"}
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
