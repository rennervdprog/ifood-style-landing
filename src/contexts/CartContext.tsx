import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
export interface CartAddon {
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  cartKey: string; // unique key combining product id + addons + observations
  store_id: string;
  store_name: string;
  name: string;
  price: number; // unit price including addons
  basePrice: number;
  quantity: number;
  image_url?: string | null;
  addons?: CartAddon[];
  observations?: string;
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
    localStorage.setItem("cart_items", JSON.stringify(items));
  }, [items]);

  const setNeighborhood = useCallback((name: string, fee: number) => {
    setNeighborhoodState(name);
    setNeighborhoodFee(fee);
    localStorage.setItem("selected_neighborhood", name);
    localStorage.setItem("neighborhood_fee", fee.toString());
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity" | "cartKey">, qty = 1) => {
    const cartKey = generateCartKey(item);
    setItems(prev => {
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

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal + neighborhoodFee;

  return (
    <CartContext.Provider value={{
      items, neighborhood, neighborhoodFee, setNeighborhood,
      addItem, removeItem, updateQuantity, clearCart,
      totalItems, subtotal, total,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
