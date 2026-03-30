import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";

const CartFAB = () => {
  const { totalItems, total } = useCart();
  const navigate = useNavigate();

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => navigate("/carrinho")}
      className="fixed bottom-20 left-4 right-4 z-40 bg-primary text-primary-foreground rounded-2xl py-3.5 px-5 flex items-center justify-between shadow-lg active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingBag className="h-5 w-5" />
          <span className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
            {totalItems}
          </span>
        </div>
        <span className="font-bold text-sm">Ver carrinho</span>
      </div>
      <span className="font-black text-sm">R$ {total.toFixed(2)}</span>
    </button>
  );
};

export default CartFAB;
