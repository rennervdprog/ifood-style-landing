import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Minus, Plus, Trash2, MapPin, ShoppingBag, ChevronRight, Truck, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const CartPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border flex items-center h-14 px-4 gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Carrinho</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-5">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">Seu carrinho está vazio</h2>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Explore as lojas e adicione itens deliciosos ao seu pedido
          </p>
          <button
            onClick={() => navigate("/inicio")}
            className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
          >
            Ver lojas
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Group items by store
  const storeGroups = items.reduce((acc, item) => {
    if (!acc[item.store_id]) acc[item.store_id] = { name: item.store_name, items: [] };
    acc[item.store_id].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: typeof items }>);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-background pb-44 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Carrinho</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
        </div>
        <button onClick={clearCart} className="text-xs text-destructive font-bold flex items-center gap-1">
          <Trash2 className="h-3 w-3" />
          Limpar
        </button>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Items grouped by store */}
        {Object.entries(storeGroups).map(([storeId, group]) => (
          <section key={storeId} className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Store header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 border-b border-border/50">
              <Store className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">{group.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {group.items.length} {group.items.length === 1 ? "item" : "itens"}
              </span>
            </div>

            <div className="divide-y divide-border/50">
              {group.items.map((item) => (
                <div key={item.cartKey} className="flex items-center gap-3 p-4">
                  {/* Item info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2">{item.name}</h3>
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        + {item.addons.map(a => a.name).join(", ")}
                      </p>
                    )}
                    {item.observations && (
                      <p className="text-[11px] text-muted-foreground/70 italic truncate">
                        "{item.observations}"
                      </p>
                    )}
                    <span className="text-sm font-black text-primary block pt-0.5">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-card border border-border/50 flex items-center justify-center active:scale-95 transition-transform"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-foreground" />
                      )}
                    </button>
                    <span className="text-sm font-bold w-7 text-center text-foreground">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Fixed bottom summary + CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40">
        <div className="px-4 pt-3 pb-1 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-foreground">R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" /> Entrega
            </span>
            <span className="font-semibold text-foreground">
              {neighborhood ? `R$ ${neighborhoodFee.toFixed(2)}` : "Calculado no checkout"}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-border/50">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-xl font-black text-primary">R$ {total.toFixed(2)}</span>
          </div>
        </div>
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={() => navigate("/checkout")}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-primary/25 text-base flex items-center justify-center gap-2"
          >
            Finalizar pedido
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default CartPage;
