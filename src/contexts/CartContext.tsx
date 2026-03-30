import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  id: string;
  store_id: string;
  store_name: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
}

interface CartContextType {
  items: CartItem[];
  neighborhood: string | null;
  neighborhoodFee: number;
  setNeighborhood: (name: string, fee: number) => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

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

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
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
