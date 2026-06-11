import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addMoney, sumMoney } from "@/lib/utils";
export interface CartAddon {
  name: string;
  price: number;
  required?: boolean;
  groupName?: string;
}

export interface CartItem {
  id: string;
  cartKey: string;
  store_id: string;
  store_name: string;
  name: string;
  price: number;
  basePrice: number;
  quantity: number;
  image_url?: string | null;
  addons?: CartAddon[];
  observations?: string;
  metadata?: Record<string, any>;
}

interface CartContextType {
  items: CartItem[];
  neighborhood: string | null;
  neighborhoodFee: number;
  setNeighborhood: (name: string, fee: number) => void;
  addItem: (item: Omit<CartItem, "quantity" | "cartKey">, qty?: number) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function generateCartKey(item: { id: string; addons?: CartAddon[]; observations?: string }) {
  const addonStr = (item.addons || []).map(a => a.name).sort().join(",");
  const obsStr = item.observations || "";
  return `${item.id}__${addonStr}__${obsStr}`;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart_items");
    return saved ? JSON.parse(saved) : [];
  });
  const [neighborhood, setNeighborhoodState] = useState<string | null>(() => {
    return localStorage.getItem("selected_neighborhood");
  });
  const [neighborhoodFee, setNeighborhoodFee] = useState<number>(() => {
    const saved = localStorage.getItem("neighborhood_fee");
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    // Defer JSON.stringify off the critical path to avoid jank on quick qty taps
    const idle = (cb: () => void) =>
      typeof (window as any).requestIdleCallback === "function"
        ? (window as any).requestIdleCallback(cb, { timeout: 500 })
        : setTimeout(cb, 0);
    const cancel = (id: any) =>
      typeof (window as any).cancelIdleCallback === "function"
        ? (window as any).cancelIdleCallback(id)
        : clearTimeout(id);
    const id = idle(() => {
      try { localStorage.setItem("cart_items", JSON.stringify(items)); } catch {}
    });
    return () => cancel(id);
  }, [items]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setItems([]);
        setNeighborhoodState(null);
        setNeighborhoodFee(0);
        localStorage.removeItem("cart_items");
        localStorage.removeItem("selected_neighborhood");
        localStorage.removeItem("neighborhood_fee");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const setNeighborhood = useCallback((name: string, fee: number) => {
    setNeighborhoodState(name);
    setNeighborhoodFee(fee);
    localStorage.setItem("selected_neighborhood", name);
    localStorage.setItem("neighborhood_fee", fee.toString());
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity" | "cartKey">, qty = 1) => {
    const cartKey = generateCartKey(item);
    setItems(prev => {
      // Bloqueio de carrinho misto: só permite produtos da mesma loja
      const otherStore = prev.find(i => i.store_id !== item.store_id);
      if (otherStore) {
        const ok = typeof window !== "undefined"
          ? window.confirm(
              `Você já tem itens de "${otherStore.store_name}" no carrinho. Deseja limpar e iniciar um novo pedido em "${item.store_name}"?`
            )
          : false;
        if (!ok) return prev;
        return [{ ...item, cartKey, quantity: qty }];
      }
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { ...item, cartKey, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((cartKey: string) => {
    setItems(prev => prev.filter(i => i.cartKey !== cartKey));
  }, []);

  const updateQuantity = useCallback((cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.cartKey !== cartKey));
    } else {
      setItems(prev => prev.map(i => i.cartKey === cartKey ? { ...i, quantity } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // Memoize derived values to prevent re-renders in consumers
  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => sumMoney(items.map((item) => item.price * item.quantity)), [items]);
  const total = useMemo(() => addMoney(subtotal, neighborhoodFee), [subtotal, neighborhoodFee]);

  const value = useMemo(() => ({
    items, neighborhood, neighborhoodFee, setNeighborhood,
    addItem, removeItem, updateQuantity, clearCart,
    totalItems, subtotal, total,
  }), [items, neighborhood, neighborhoodFee, setNeighborhood, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal, total]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
