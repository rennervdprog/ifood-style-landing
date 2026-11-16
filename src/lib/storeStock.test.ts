// Bug do catálogo (E2E 15/11/2026): saldo vivo mesclado na vitrine.
// A RPC em si (SQL) não roda no Vitest — validada por revisão + prova ao vivo.
import { describe, it, expect } from "vitest";
import { buildOutOfStockSet, applyLiveStockFlags } from "./storeStock";

describe("buildOutOfStockSet", () => {
  it("coleta só os produtos com out_of_stock=true", () => {
    const set = buildOutOfStockSet([
      { product_id: "a", out_of_stock: true },
      { product_id: "b", out_of_stock: false },
      { product_id: "c", out_of_stock: true },
    ]);
    expect([...set].sort()).toEqual(["a", "c"]);
  });

  it("aceita null/undefined sem quebrar", () => {
    expect(buildOutOfStockSet(null).size).toBe(0);
    expect(buildOutOfStockSet(undefined).size).toBe(0);
    expect(buildOutOfStockSet([]).size).toBe(0);
  });
});

describe("applyLiveStockFlags", () => {
  const products = [
    { id: "combo", name: "Combo Casal", metadata: {} as Record<string, any> },
    { id: "dupla", name: "Porção Dupla", metadata: {} as Record<string, any> },
    { id: "camiseta", name: "Camiseta", metadata: null },
  ];

  it("marca esgotado só o produto zerado, sem tocar nos demais", () => {
    const out = applyLiveStockFlags(products, new Set(["combo"]));
    expect(out[0].metadata).toEqual({ out_of_stock: true });
    expect(out[1]).toBe(products[1]);
    expect(out[2]).toBe(products[2]);
  });

  it("preserva os demais campos do metadata", () => {
    const list = [
      { id: "x", metadata: { is_bestseller: true, min_stock: 2 } },
    ];
    const out = applyLiveStockFlags(list, new Set(["x"]));
    expect(out[0].metadata).toEqual({
      is_bestseller: true,
      min_stock: 2,
      out_of_stock: true,
    });
  });

  it("não remove flag já existente nem cria cópia quando vazio", () => {
    const list = [{ id: "y", metadata: { out_of_stock: true } }];
    expect(applyLiveStockFlags(list, new Set(["z"]))[0].metadata).toEqual({
      out_of_stock: true,
    });
    expect(applyLiveStockFlags(products, new Set())).toBe(products);
  });

  it("cria metadata quando o produto não tem", () => {
    const list = [{ id: "w", metadata: null }];
    expect(applyLiveStockFlags(list, new Set(["w"]))[0].metadata).toEqual({
      out_of_stock: true,
    });
  });
});
