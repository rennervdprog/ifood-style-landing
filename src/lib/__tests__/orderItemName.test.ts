import { describe, it, expect } from "vitest";
import { getOrderItemDisplayName } from "@/lib/orderItemName";

describe("getOrderItemDisplayName", () => {
  it("retorna nome do produto quando não é meio-a-meio", () => {
    expect(getOrderItemDisplayName({ products: { name: "Coca 350ml" }, addons: [] })).toBe("Coca 350ml");
  });

  it("detecta pizza meio-a-meio e formata corretamente", () => {
    const item = {
      products: { name: "Pizza Grande" },
      addons: [{ name: "½ Calabresa" }, { name: "½ Frango" }],
    };
    expect(getOrderItemDisplayName(item)).toBe("Pizza Meio a Meio: Calabresa / Frango");
  });

  it("aceita addons como string JSON", () => {
    const item = {
      products: { name: "Pizza" },
      addons: JSON.stringify([{ name: "½ Marguerita" }, { name: "½ Portuguesa" }]),
    };
    expect(getOrderItemDisplayName(item)).toBe("Pizza Meio a Meio: Marguerita / Portuguesa");
  });

  it("tolera addons inválidos", () => {
    expect(getOrderItemDisplayName({ products: { name: "X" }, addons: "not-json" })).toBe("X");
    expect(getOrderItemDisplayName({ products: { name: "X" }, addons: null })).toBe("X");
  });

  it("fallback para 'Item' quando produto não tem nome", () => {
    expect(getOrderItemDisplayName({ products: null, addons: [] })).toBe("Item");
  });
});