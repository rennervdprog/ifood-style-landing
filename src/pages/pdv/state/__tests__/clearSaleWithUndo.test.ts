import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import {
  clearSaleWithUndo,
  CLEARED_SALE_TOAST_DURATION_MS,
  type ClearSaleWithUndoArgs,
} from "../../clearSaleWithUndo";
import type { CartItem } from "../../types";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn() },
}));

const warningMock = vi.mocked(toast.warning);

const TAB = "b788c5bc-573e-4eb5-9e0b-0b4741479130";
const TABLE = { id: "dddf9e4b-f8bc-4858-97b4-6e010f3c9cef", label: "Teste Varredura" };

const item = (over: Partial<CartItem> = {}): CartItem => ({
  id: "e9015658-740f-4e32-a59d-db85d828bcb3",
  name: "Vestido Floral",
  price: 119.9,
  basePrice: 119.9,
  quantity: 1,
  ...over,
});

function makeArgs(over: Partial<ClearSaleWithUndoArgs> = {}) {
  return {
    cart: [item()],
    tableId: "Mesa Teste Varredura",
    selectedTable: TABLE,
    selectedTabId: TAB,
    discountType: "%" as const,
    discountInput: "5",
    cancelEmptyTab: vi.fn().mockResolvedValue(true),
    clearSale: vi.fn(),
    restoreCart: vi.fn(),
    ...over,
  };
}

function lastWarningOptions() {
  const calls = warningMock.mock.calls;
  return calls[calls.length - 1][1] as unknown as {
    action?: { label: string; onClick: () => void };
    duration?: number;
  };
}

describe("clearSaleWithUndo (F1/F2, 2c)", () => {
  beforeEach(() => {
    warningMock.mockClear();
  });

  it("comanda cancelada → snapshot SEM destino (Balcão) e Desfazer restaura os itens", async () => {
    const a = makeArgs();
    await clearSaleWithUndo(a);

    expect(a.cancelEmptyTab).toHaveBeenCalledWith(TAB);
    expect(a.clearSale).toHaveBeenCalledTimes(1);
    expect(warningMock).toHaveBeenCalledTimes(1);
    expect(warningMock.mock.calls[0][0]).toBe("Venda limpa");

    const opts = lastWarningOptions();
    expect(opts.duration).toBe(10000);
    expect(opts.action?.label).toBe("Desfazer");
    opts.action!.onClick();

    expect(a.restoreCart).toHaveBeenCalledTimes(1);
    const snapshot = vi.mocked(a.restoreCart).mock.calls[0][0];
    expect(snapshot.items).toEqual([item()]);
    expect(snapshot.tableId).toBe("");
    expect(snapshot.selectedTable).toBeNull();
    expect(snapshot.selectedTabId).toBeNull();
    expect(snapshot.discountType).toBe("%");
    expect(snapshot.discountInput).toBe("5");
    expect(snapshot.paymentMethod).toBe("");
    expect(snapshot.cashReceived).toBe("");
    expect(snapshot.splitMode).toBe(false);
    expect(snapshot.splitPayments).toEqual([]);
  });

  it("comanda preservada (itens enviados) → snapshot mantém o destino original", async () => {
    const a = makeArgs({ cancelEmptyTab: vi.fn().mockResolvedValue(false) });
    await clearSaleWithUndo(a);

    lastWarningOptions().action!.onClick();
    const snapshot = vi.mocked(a.restoreCart).mock.calls[0][0];
    expect(snapshot.tableId).toBe("Mesa Teste Varredura");
    expect(snapshot.selectedTable).toEqual(TABLE);
    expect(snapshot.selectedTabId).toBe(TAB);
  });

  it("sem restoreCart → toast sem ação, venda limpa igual", async () => {
    const a = makeArgs({ restoreCart: undefined });
    await clearSaleWithUndo(a);

    expect(a.clearSale).toHaveBeenCalledTimes(1);
    expect(lastWarningOptions().action).toBeUndefined();
  });

  it("carrinho vazio (2a) → snapshot com 0 itens, cancelamento consultado no banco", async () => {
    const a = makeArgs({ cart: [] });
    await clearSaleWithUndo(a);

    expect(a.cancelEmptyTab).toHaveBeenCalledWith(TAB);
    expect(a.clearSale).toHaveBeenCalledTimes(1);
    lastWarningOptions().action!.onClick();
    const snapshot = vi.mocked(a.restoreCart).mock.calls[0][0];
    expect(snapshot.items).toEqual([]);
  });

  it("snapshot copia os itens — mutação posterior do carrinho não o afeta", async () => {
    const cart = [item()];
    const a = makeArgs({ cart });
    await clearSaleWithUndo(a);

    cart.push(item({ id: "outro-produto", name: "Camiseta Básica" }));
    lastWarningOptions().action!.onClick();
    const snapshot = vi.mocked(a.restoreCart).mock.calls[0][0];
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items).not.toBe(cart);
  });

  it("F2: duração do toast é 10 s", () => {
    expect(CLEARED_SALE_TOAST_DURATION_MS).toBe(10000);
  });
});
