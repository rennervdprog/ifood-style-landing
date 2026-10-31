import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePdvCart } from "../usePdvCart";

// Item 11 (varredura 2026-10-30): reload do PDV ressuscitava a venda já
// concluída. O rascunho persistido (pdv_cart_draft_v1) é o mecanismo:
// - venda EM ABERTO sobrevive ao reload (recurso — queda de luz/deploy);
// - venda CONCLUÍDA não pode voltar: a conclusão chama clearSale()
//   (PdvPage.onSuccess) e o efeito de persistência apaga o rascunho.
// Estes testes provam as duas metades no nível do armazenamento.

const SCOPE = "store1:session1";
const KEY = `pdv_cart_draft_v1:${SCOPE}`;

const prod = (over: Partial<any> = {}): any => ({
  id: "p1",
  name: "Coca 2L",
  price: 25,
  image_url: null,
  section_id: "s1",
  is_available: true,
  ...over,
});

/** Monta o hook já no escopo da loja/turno (como o PdvPage faz). */
function mountScoped() {
  const h = renderHook(() => usePdvCart());
  act(() => h.result.current.setCartScope(SCOPE));
  return h;
}

/** Monta uma venda em aberto: 1 item + forma de pagamento escolhida. */
function mountOpenSale() {
  const h = mountScoped();
  act(() => h.result.current.addScannedProduct(prod()));
  act(() => h.result.current.setPaymentMethod("dinheiro"));
  return h;
}

describe("usePdvCart — rascunho persistido (item 11)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("venda em aberto é salva no rascunho a cada mudança", () => {
    mountOpenSale();
    const raw = localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data.items).toHaveLength(1);
    expect(parsed.data.paymentMethod).toBe("dinheiro");
  });

  it("venda em aberto SOBREVIVE ao reload (recurso preservado)", () => {
    const first = mountOpenSale();
    first.unmount(); // reload da página

    const second = mountScoped();
    expect(second.result.current.cart).toHaveLength(1);
    expect(second.result.current.cart[0].id).toBe("p1");
    expect(second.result.current.paymentMethod).toBe("dinheiro");
    expect(second.result.current.orderDone).toBe(false);
  });

  it("venda concluída (clearSale da conclusão) apaga o rascunho", () => {
    const h = mountOpenSale();
    expect(localStorage.getItem(KEY)).not.toBeNull();
    // É exatamente a chamada que PdvPage.onSuccess faz ao concluir.
    act(() => h.result.current.clearSale());
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("venda concluída NÃO ressuscita no reload", () => {
    const first = mountOpenSale();
    act(() => first.result.current.clearSale()); // conclusão da venda
    first.unmount(); // reload da página

    const second = mountScoped();
    expect(second.result.current.cart).toEqual([]);
    expect(second.result.current.paymentMethod).toBe("");
    expect(second.result.current.totalItems).toBe(0);
  });

  it("rascunho de outro turno não vaza para este escopo", () => {
    const first = mountOpenSale();
    first.unmount();

    const other = renderHook(() => usePdvCart());
    act(() => other.result.current.setCartScope("store1:outro-turno"));
    expect(other.result.current.cart).toEqual([]);
  });
});
