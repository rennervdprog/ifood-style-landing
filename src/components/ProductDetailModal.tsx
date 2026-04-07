import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, ShoppingCart, Pizza } from "lucide-react";
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

const ProductDetailModal = ({ product, storeName, storeCategory, open, onClose, onAdd }: Props) => {
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [observations, setObservations] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const resetState = () => {
    setSelectedAddons({});
    setObservations("");
    setQuantity(1);
    setSelectedSize(null);
  };

  const isPizza = storeCategory === "pizzas" && !product?.metadata?.is_beverage;
  const sizes: Array<{ name: string; price: number }> = product?.metadata?.sizes || [];
  const hasSizes = isPizza && sizes.length > 0;

  // Fetch direct addon groups (product_id = product.id)
  const { data: directAddonGroups } = useQuery({
    queryKey: ["addon-groups", product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("*")
        .eq("product_id", product!.id)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as AddonGroup[];
    },
    enabled: !!product?.id && open,
  });

  // Fetch linked addon group IDs via junction table
  const { data: linkedGroupLinks } = useQuery({
    queryKey: ["product-addon-links", product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("addon_group_id")
        .eq("product_id", product!.id);
      if (error) throw error;
      return (data || []).map((l: any) => l.addon_group_id as string);
    },
    enabled: !!product?.id && open,
  });

  // Fetch linked addon groups details
  const { data: linkedAddonGroups } = useQuery({
    queryKey: ["linked-addon-groups", linkedGroupLinks],
    queryFn: async () => {
      if (!linkedGroupLinks || linkedGroupLinks.length === 0) return [];
      const { data, error } = await supabase
        .from("addon_groups")
        .select("*")
        .in("id", linkedGroupLinks)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as AddonGroup[];
    },
    enabled: !!linkedGroupLinks && linkedGroupLinks.length > 0,
  });

  // Combine direct + linked groups
  const addonGroups = useMemo(() => {
    const direct = directAddonGroups || [];
    const linked = linkedAddonGroups || [];
    const seen = new Set(direct.map(g => g.id));
    return [...direct, ...linked.filter(g => !seen.has(g.id))];
  }, [directAddonGroups, linkedAddonGroups]);

  // Fetch all addon items for combined groups
  const allGroupIds = addonGroups.map(g => g.id);
  const { data: addonItems } = useQuery({
    queryKey: ["addon-items", allGroupIds],
    queryFn: async () => {
      if (allGroupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("addon_items")
        .select("*")
        .in("group_id", allGroupIds)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as AddonItem[];
    },
    enabled: allGroupIds.length > 0,
  });

  const toggleAddon = (groupId: string, itemId: string, maxSelect: number) => {
    setSelectedAddons(prev => {
      const current = prev[groupId] || [];
      if (current.includes(itemId)) {
        return { ...prev, [groupId]: current.filter(id => id !== itemId) };
      }
      if (current.length >= maxSelect) {
        if (maxSelect === 1) return { ...prev, [groupId]: [itemId] };
        return prev;
      }
      return { ...prev, [groupId]: [...current, itemId] };
    });
  };

  const allRequiredMet = useMemo(() => {
    if (!addonGroups) return true;
    const addonsMet = addonGroups.every(g => {
      if (g.min_select === 0) return true;
      return (selectedAddons[g.id]?.length || 0) >= g.min_select;
    });
    // For pizza with sizes, a size must be selected
    if (hasSizes && !selectedSize) return false;
    return addonsMet;
  }, [addonGroups, selectedAddons, hasSizes, selectedSize]);

  const selectedAddonsList: CartAddon[] = useMemo(() => {
    if (!addonItems) return [];
    const allSelected = Object.values(selectedAddons).flat();
    return addonItems
      .filter(ai => allSelected.includes(ai.id))
      .map(ai => ({ name: ai.name, price: ai.price }));
  }, [addonItems, selectedAddons]);

  const addonsTotal = selectedAddonsList.reduce((s, a) => s + a.price, 0);
  
  // For pizza: use selected size price; otherwise use product.price
  const basePrice = hasSizes && selectedSize
    ? (sizes.find(s => s.name === selectedSize)?.price || product?.price || 0)
    : (product?.price || 0);
  
  const unitPrice = basePrice + addonsTotal;
  const lineTotal = unitPrice * quantity;

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetState(); } }}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-y-auto rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Product image */}
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-56 object-cover rounded-t-2xl" />
        ) : (
          <div className="w-full h-56 bg-muted flex items-center justify-center rounded-t-2xl">
            <span className="text-6xl">{isPizza ? "🍕" : "🍴"}</span>
          </div>
        )}

        <div className="p-5 space-y-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-black text-foreground">{product.name}</DialogTitle>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
            {!hasSizes && (
              <p className="text-lg font-black text-primary mt-2">R$ {product.price.toFixed(2)}</p>
            )}
          </DialogHeader>

          {/* Pizza size selector */}
          {hasSizes && (
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Pizza className="h-4 w-4 text-primary" />
                <h4 className="font-bold text-sm text-foreground">Escolha o tamanho</h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  Obrigatório
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
                        isSelected
                          ? "bg-primary/10 border-2 border-primary ring-1 ring-primary/20"
                          : "bg-background border-2 border-transparent hover:bg-muted"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? "border-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <span className={`flex-1 text-sm ${isSelected ? "font-bold text-foreground" : "text-foreground"}`}>
                        {size.name}
                      </span>
                      <span className={`text-sm font-black ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                        R$ {size.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Addon groups */}
          {addonGroups && addonGroups.length > 0 && (
            <div className="space-y-4">
              {addonGroups.map(group => {
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
                          currentSelected >= group.min_select
                            ? "bg-green-100 text-green-700"
                            : "bg-destructive/10 text-destructive"
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
                              isChecked
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/40 bg-background"
                            }`}>
                              {isChecked && (
                                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`flex-1 text-sm ${isChecked ? "font-bold text-foreground" : "text-foreground"}`}>{item.name}</span>
                            {item.price > 0 && (
                              <span className={`text-sm font-bold ${isChecked ? "text-primary" : "text-muted-foreground"}`}>+ R$ {item.price.toFixed(2)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Observations */}
          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">Observações</label>
            <Textarea
              placeholder="Ex: Sem cebola, bem passado..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="resize-none h-20 rounded-xl"
              maxLength={200}
              autoFocus={false}
              tabIndex={-1}
            />
          </div>

          {/* Quantity + Add button */}
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
              disabled={!allRequiredMet}
              onClick={() => {
                const addonsList = [...selectedAddonsList];
                // Add size as an addon for display in cart
                if (hasSizes && selectedSize) {
                  addonsList.unshift({ name: `Tamanho: ${selectedSize}`, price: 0 });
                }
                onAdd(product, addonsList, observations, quantity, unitPrice);
                onClose();
                resetState();
              }}
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                allRequiredMet
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              {hasSizes && !selectedSize
                ? "Selecione o tamanho"
                : `Adicionar • R$ ${lineTotal.toFixed(2)}`
              }
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;