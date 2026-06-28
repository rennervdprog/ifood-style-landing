import { describe, it, expect } from "vitest";
import { getOrderItemDisplayName, getOrderItemFlavors, getFractionAddonNames } from "@/lib/orderItemName";

describe("getOrderItemDisplayName", () => {
  it("retorna nome do produto quando não é meio-a-meio", () => {
    expect(getOrderItemDisplayName({ products: { name: "Coca 350ml" }, addons: [] })).toBe("Coca 350ml");
  });

  it("detecta pizza meio-a-meio e formata corretamente", () => {
    const item = {
      products: { name: "Pizza Grande" },
      addons: [{ name: "½ Calabresa" }, { name: "½ Frango" }],
    };
    expect(getOrderItemDisplayName(item)).toBe("Pizza Meio a Meio");
    expect(getOrderItemFlavors(item)).toEqual(["½ Calabresa", "½ Frango"]);
  });

  it("aceita addons como string JSON", () => {
    const item = {
      products: { name: "Pizza" },
      addons: JSON.stringify([{ name: "½ Marguerita" }, { name: "½ Portuguesa" }]),
    };
    expect(getOrderItemDisplayName(item)).toBe("Pizza Meio a Meio");
    expect(getOrderItemFlavors(item)).toEqual(["½ Marguerita", "½ Portuguesa"]);
  });

  it("tolera addons inválidos", () => {
    expect(getOrderItemDisplayName({ products: { name: "X" }, addons: "not-json" })).toBe("X");
    expect(getOrderItemDisplayName({ products: { name: "X" }, addons: null })).toBe("X");
  });

  it("fallback para 'Item' quando produto não tem nome", () => {
    expect(getOrderItemDisplayName({ products: null, addons: [] })).toBe("Item");
  });

  it("detecta pastel meio-a-meio quando product/addons mencionam 'Pastel'", () => {
    const item = {
      products: { name: "Pastel - Carne" },
      addons: [{ name: "½ Pastel - Carne" }, { name: "½ Pastel - Cheddar" }],
    };
    expect(getOrderItemDisplayName(item)).toBe("Pastel Meio a Meio");
    expect(getOrderItemFlavors(item)).toEqual(["½ Carne", "½ Cheddar"]);
  });

  it("detecta pizza 3 e 4 sabores", () => {
    const i3 = { products: { name: "Pizza" }, addons: [{ name: "⅓ A" }, { name: "⅓ B" }, { name: "⅓ C" }] };
    expect(getOrderItemDisplayName(i3)).toBe("Pizza 3 Sabores");
    const i4 = { products: { name: "Pizza" }, addons: [{ name: "¼ A" }, { name: "¼ B" }, { name: "¼ C" }, { name: "¼ D" }] };
    expect(getOrderItemDisplayName(i4)).toBe("Pizza 4 Sabores");
  });

  it("getFractionAddonNames retorna nomes originais para suprimir duplicação", () => {
    const item = { products: { name: "Pastel" }, addons: [{ name: "½ Pastel - Carne" }, { name: "½ Pastel - Cheddar" }, { name: "Complemento: Cebola" }] };
    const set = getFractionAddonNames(item);
    expect(set.has("½ Pastel - Carne")).toBe(true);
    expect(set.has("Complemento: Cebola")).toBe(false);
  });
});