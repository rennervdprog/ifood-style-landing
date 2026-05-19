import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { CartProvider, useCart } from "../CartContext";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const itemA = {
  id: "p1",
  store_id: "s1",
  store_name: "Loja A",
  name: "Pizza",
  price: 30,
  basePrice: 30,
};
const itemB = {
  id: "p2",
  store_id: "s2",
  store_name: "Loja B",
  name: "Burger",
  price: 20,
  basePrice: 20,
};

describe("CartContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("inicia vazio", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("adiciona item e soma subtotal", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 2));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.subtotal).toBe(60);
  });

  it("agrupa o mesmo item ao invés de duplicar", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    act(() => result.current.addItem(itemA, 2));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  it("updateQuantity remove ao chegar a zero", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    const key = result.current.items[0].cartKey;
    act(() => result.current.updateQuantity(key, 0));
    expect(result.current.items).toHaveLength(0);
  });

  it("removeItem remove pelo cartKey", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    const key = result.current.items[0].cartKey;
    act(() => result.current.removeItem(key));
    expect(result.current.items).toHaveLength(0);
  });

  it("clearCart esvazia tudo", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    act(() => result.current.clearCart());
    expect(result.current.items).toEqual([]);
  });

  it("bloqueia carrinho misto: mantém quando usuário cancela", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    act(() => result.current.addItem(itemB, 1));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].store_id).toBe("s1");
  });

  it("substitui carrinho quando usuário aceita trocar de loja", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    act(() => result.current.addItem(itemB, 2));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].store_id).toBe("s2");
    expect(result.current.items[0].quantity).toBe(2);
  });

  it("setNeighborhood atualiza taxa e total", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(itemA, 1));
    act(() => result.current.setNeighborhood("Centro", 5));
    expect(result.current.neighborhood).toBe("Centro");
    expect(result.current.neighborhoodFee).toBe(5);
    expect(result.current.total).toBe(35);
  });

  it("addons geram cartKeys distintos", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem({ ...itemA, addons: [{ name: "Bacon", price: 3 }] }, 1));
    act(() => result.current.addItem({ ...itemA, addons: [{ name: "Cheddar", price: 3 }] }, 1));
    expect(result.current.items).toHaveLength(2);
  });
});
