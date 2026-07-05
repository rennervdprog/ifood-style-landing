import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePdvCart } from "../usePdvCart";

const prod = (over: Partial<any> = {}): any => ({
  id: "p1",
  name: "Coca 2L",
  price: 10,
  image_url: null,
  section_id: "s1",
  is_available: true,
  ...over,
});

describe("usePdvCart — cobertura extra", () => {
  it("desconto em R$ é aplicado literalmente", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod({ price: 100 })));
    act(() => {
      result.current.setDiscountType("R$");
      result.current.setDiscountInput("25,00");
    });
    expect(result.current.discountAmount).toBeCloseTo(25, 2);
    expect(result.current.finalTotal).toBeCloseTo(75, 2);
  });

  it("desconto R$ não excede subtotal", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod({ price: 30 })));
    act(() => {
      result.current.setDiscountType("R$");
      result.current.setDiscountInput("999");
    });
    expect(result.current.discountAmount).toBe(30);
    expect(result.current.finalTotal).toBe(0);
  });

  it("itens vendidos por peso NUNCA agregam (linha nova por pesagem)", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.handleModalAdd(prod(), [], "", 1, 12.5, {
        weight_grams: 500,
      }),
    );
    act(() =>
      result.current.handleModalAdd(prod(), [], "", 1, 12.5, {
        weight_grams: 500,
      }),
    );
    expect(result.current.cart).toHaveLength(2);
  });

  it("mesma linha só agrega quando addons E observations casam", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.handleModalAdd(prod(), [{ name: "Gelo", price: 0 }], "sem canudo", 1, 10),
    );
    act(() =>
      result.current.handleModalAdd(prod(), [{ name: "Gelo", price: 0 }], "com canudo", 1, 10),
    );
    expect(result.current.cart).toHaveLength(2);
    act(() =>
      result.current.handleModalAdd(prod(), [{ name: "Gelo", price: 0 }], "sem canudo", 2, 10),
    );
    expect(result.current.cart).toHaveLength(2);
    const merged = result.current.cart.find((i) => i.observations === "sem canudo");
    expect(merged?.quantity).toBe(3);
  });

  it("addonKey é agnóstico à ordem dos addons", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.handleModalAdd(
        prod(),
        [
          { name: "A", price: 0 },
          { name: "B", price: 0 },
        ],
        "",
        1,
        10,
      ),
    );
    act(() =>
      result.current.handleModalAdd(
        prod(),
        [
          { name: "B", price: 0 },
          { name: "A", price: 0 },
        ],
        "",
        2,
        10,
      ),
    );
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
  });

  it("scanned item não agrega com linha que tem addons/obs", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.handleModalAdd(prod(), [{ name: "Gelo", price: 0 }], "", 1, 10),
    );
    act(() => result.current.addScannedProduct(prod()));
    expect(result.current.cart).toHaveLength(2);
  });

  it("removeItem remove pela posição (não apaga todas as linhas do produto)", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.handleModalAdd(prod(), [{ name: "A", price: 0 }], "", 1, 10),
    );
    act(() =>
      result.current.handleModalAdd(prod(), [{ name: "B", price: 0 }], "", 1, 10),
    );
    expect(result.current.cart).toHaveLength(2);
    act(() => result.current.removeItem(0));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].addons?.[0].name).toBe("B");
  });

  it("decItem em item inexistente é no-op", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.decItem("ghost"));
    expect(result.current.cart).toEqual([]);
  });

  it("getQty devolve 0 quando o produto não está no carrinho", () => {
    const { result } = renderHook(() => usePdvCart());
    expect(result.current.getQty("nada")).toBe(0);
    act(() => result.current.addScannedProduct(prod()));
    expect(result.current.getQty("p1")).toBe(1);
  });

  it("troco = 0 e não negativo quando cashReceived está vazio", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod({ price: 30 })));
    expect(result.current.troco).toBe(0);
    expect(result.current.trocoNegativo).toBe(false);
  });

  it("openProduct/setProductModal expõem o produto ativo", () => {
    const { result } = renderHook(() => usePdvCart());
    const p = prod();
    act(() => result.current.openProduct(p));
    expect(result.current.productModal).toEqual(p);
    act(() => result.current.setProductModal(null));
    expect(result.current.productModal).toBeNull();
  });

  it("split e método de pagamento persistem até clearSale", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => {
      result.current.setSplitMode(true);
      result.current.setSplitPayments([
        { method: "dinheiro", amount: 10 } as any,
        { method: "maquininha_credito", amount: 20 } as any,
      ]);
    });
    expect(result.current.splitMode).toBe(true);
    expect(result.current.splitPayments).toHaveLength(2);
    act(() => result.current.clearSale());
    expect(result.current.splitMode).toBe(false);
    expect(result.current.splitPayments).toEqual([]);
  });
});