import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Minus, Plus, Trash2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const CartPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Carrinho</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <span className="text-5xl mb-4">🛒</span>
          <h2 className="text-lg font-bold text-foreground mb-1">Carrinho vazio</h2>
          <p className="text-sm text-muted-foreground">Adicione itens para começar seu pedido.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Carrinho</h1>
        </div>
        <button onClick={clearCart} className="text-xs text-primary font-bold">
          Limpar
        </button>
      </header>

      <div className="px-4 py-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 bg-card rounded-2xl p-3 border border-border">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">{item.name}</h3>
              <span className="text-xs text-muted-foreground">{item.store_name}</span>
              <span className="text-sm font-black text-primary block mt-1">
                R$ {(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                {item.quantity === 1 ? (
                  <Trash2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-foreground" />
                )}
              </button>
              <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="px-4 py-4 border-t border-border space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-bold text-foreground">R$ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>Entrega {neighborhood ? `(${neighborhood})` : ""}</span>
          </div>
          <span className="font-bold text-foreground">
            {neighborhood ? `R$ ${neighborhoodFee.toFixed(2)}` : "Selecione o bairro"}
          </span>
        </div>
        <div className="flex justify-between text-lg pt-2 border-t border-border">
          <span className="font-bold text-foreground">Total</span>
          <span className="font-black text-primary">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="px-4 pt-2">
        <button className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform">
          Finalizar pedido
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default CartPage;
