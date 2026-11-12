import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  cancelEmptyTab,
  CLEAR_SALE_CANCEL_REASON,
  type CancelEmptyTabDeps,
} from "../usePdvTables";
import { usePdvCart } from "../usePdvCart";

const TAB = "b788c5bc-573e-4eb5-9e0b-0b4741479130";

function deps(over: Partial<CancelEmptyTabDeps>): CancelEmptyTabDeps {
  return {
    countTabItems: vi.fn().mockResolvedValue(0),
    cancelTab: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("cancelEmptyTab (N2 Opção A)", () => {
  it("sem tab selecionada → não conta nem cancela", async () => {
    const d = deps({});
    expect(await cancelEmptyTab(null, CLEAR_SALE_CANCEL_REASON, d)).toBe(false);
    expect(d.countTabItems).not.toHaveBeenCalled();
    expect(d.cancelTab).not.toHaveBeenCalled();
  });

  it("0 itens no banco → cancela com o motivo de sistema e retorna true", async () => {
    const d = deps({});
    expect(await cancelEmptyTab(TAB, CLEAR_SALE_CANCEL_REASON, d)).toBe(true);
    expect(d.countTabItems).toHaveBeenCalledWith(TAB);
    expect(d.cancelTab).toHaveBeenCalledWith(TAB, CLEAR_SALE_CANCEL_REASON);
  });

  it("guarda 1: comanda COM itens → NÃO cancela e retorna false", async () => {
    const d = deps({ countTabItems: vi.fn().mockResolvedValue(3) });
    expect(await cancelEmptyTab(TAB, CLEAR_SALE_CANCEL_REASON, d)).toBe(false);
    expect(d.cancelTab).not.toHaveBeenCalled();
  });

  it("falha ao contar → fail-closed: NÃO cancela e retorna false", async () => {
    const d = deps({ countTabItems: vi.fn().mockRejectedValue(new Error("rede")) });
    expect(await cancelEmptyTab(TAB, CLEAR_SALE_CANCEL_REASON, d)).toBe(false);
    expect(d.cancelTab).not.toHaveBeenCalled();
  });

  it("guarda 3: tab já fechada/cancelada → tolera e retorna true (id morto, sem ressuscitar)", async () => {
    const d = deps({
      cancelTab: vi.fn().mockRejectedValue(new Error("tab_not_found_or_closed")),
    });
    expect(await cancelEmptyTab(TAB, CLEAR_SALE_CANCEL_REASON, d)).toBe(true);
  });

  it("outra falha no cancelamento → retorna false (comanda presumida aberta, destino mantido)", async () => {
    const d = deps({
      cancelTab: vi.fn().mockRejectedValue(new Error("permission denied")),
    });
    expect(await cancelEmptyTab(TAB, CLEAR_SALE_CANCEL_REASON, d)).toBe(false);
  });

  it("motivo padrão é o motivo de sistema documentado", () => {
    expect(CLEAR_SALE_CANCEL_REASON).toBe("Limpeza de venda sem itens enviados");
  });
});

describe("Desfazer após auto-cancelamento (N2 guarda 2)", () => {
  it("snapshot sem destino restaura os itens no Balcão, sem ressuscitar a tab", () => {
    const { result } = renderHook(() => usePdvCart());
    const item = { id: "p1", name: "Coca 2L", price: 10, quantity: 2 } as any;
    act(() =>
      result.current.restoreCart({
        items: [item],
        paymentMethod: "",
        tableId: "",
        selectedTable: null,
        selectedTabId: null,
        discountType: "R$",
        discountInput: "",
        cashReceived: "",
        splitMode: false,
        splitPayments: [],
      }),
    );
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
    expect(result.current.selectedTabId).toBeNull();
    expect(result.current.selectedTable).toBeNull();
    expect(result.current.tableId).toBe("");
  });

  it("snapshot com destino preservado restaura a comanda ainda aberta", () => {
    const { result } = renderHook(() => usePdvCart());
    const item = { id: "p1", name: "Coca 2L", price: 10, quantity: 1 } as any;
    act(() =>
      result.current.restoreCart({
        items: [item],
        paymentMethod: "",
        tableId: "Mesa Teste Varredura",
        selectedTable: { id: "t1", label: "Teste Varredura" },
        selectedTabId: TAB,
        discountType: "R$",
        discountInput: "",
        cashReceived: "",
        splitMode: false,
        splitPayments: [],
      }),
    );
    expect(result.current.selectedTabId).toBe(TAB);
    expect(result.current.selectedTable).toEqual({ id: "t1", label: "Teste Varredura" });
  });
});
