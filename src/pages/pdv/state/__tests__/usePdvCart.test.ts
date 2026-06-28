import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePdvCart } from "../usePdvCart";

const prod = (over: Partial<any> = {}) => ({
  id: "p1",
  name: "Coca 2L",
  price: 10,
  image_url: null,
  ...over,
});

describe("usePdvCart", () => {
  it("começa vazio com totais zerados", () => {
    const { result } = renderHook(() => usePdvCart());
    expect(result.current.cart).toEqual([]);
    expect(result.current.subtotal).toBe(0);
    expect(result.current.finalTotal).toBe(0);
    expect(result.current.totalItems).toBe(0);
  });

  it("addScannedProduct agrega quantidade do mesmo produto sem addons", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod()));
    act(() => result.current.addScannedProduct(prod()));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
    expect(result.current.subtotal).toBe(20);
    expect(result.current.totalItems).toBe(2);
  });

  it("handleModalAdd cria linha separada quando addons diferem", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.handleModalAdd(prod(), [{ name: "Gelo", price: 0 }], "", 1, 10));
    act(() => result.current.handleModalAdd(prod(), [{ name: "Limão", price: 0 }], "", 1, 10));
    expect(result.current.cart).toHaveLength(2);
  });

  it("decItem decrementa e remove ao chegar em zero", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod()));
    act(() => result.current.addScannedProduct(prod()));
    act(() => result.current.decItem("p1"));
    expect(result.current.cart[0].quantity).toBe(1);
    act(() => result.current.decItem("p1"));
    expect(result.current.cart).toHaveLength(0);
  });

  it("desconto percentual nunca excede o subtotal", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod({ price: 50 })));
    act(() => {
      result.current.setDiscountType("%");
      result.current.setDiscountInput("150");
    });
    expect(result.current.discountAmount).toBe(50);
    expect(result.current.finalTotal).toBe(0);
  });

  it("troco = recebido - total, e detecta valor insuficiente", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => result.current.addScannedProduct(prod({ price: 30 })));
    act(() => result.current.setCashReceived("5000")); // R$ 50,00
    expect(result.current.troco).toBeCloseTo(20, 2);
    expect(result.current.trocoNegativo).toBe(false);

    act(() => result.current.setCashReceived("1000")); // R$ 10,00
    expect(result.current.trocoNegativo).toBe(true);
  });

  it("clearSale zera tudo após finalização", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() => {
      result.current.addScannedProduct(prod());
      result.current.setPaymentMethod("dinheiro");
      result.current.setDiscountInput("500");
    });
    act(() => result.current.clearSale());
    expect(result.current.cart).toEqual([]);
    expect(result.current.paymentMethod).toBe("");
    expect(result.current.discountInput).toBe("");
  });
});