/**
 * Testes unitários da herança de cardápio (Fase 3, migration
 * 20261028170000). Espelham as regras do banco — o banco é quem aplica
 * de verdade; aqui vai a interpretação no app + a regra de preço próprio.
 */
import { describe, it, expect } from "vitest";
import {
  parseCloneMenuResult,
  parseResyncMenuResult,
  parseMenuDivergence,
  summarizeMenuDivergence,
  isOwnPrice,
  MENU_DIVERGENCE_LABELS,
} from "@/lib/networkUnits";

describe("parseCloneMenuResult — chaves novas + legadas", () => {
  it("lê as chaves novas (as que o painel usa)", () => {
    const r = parseCloneMenuResult({
      categories_copied: 3,
      products_copied: 12,
      products_skipped: 2,
      addon_groups_copied: 1,
      addon_items_copied: 4,
    });
    expect(r).toEqual({
      categoriesCopied: 3,
      productsCopied: 12,
      productsSkipped: 2,
      addonGroupsCopied: 1,
      addonItemsCopied: 4,
    });
  });

  it("aceita as chaves legadas da função antiga (compatibilidade)", () => {
    const r = parseCloneMenuResult({ sections: 2, products: 5, addon_groups: 1 });
    expect(r.categoriesCopied).toBe(2);
    expect(r.productsCopied).toBe(5);
    expect(r.addonGroupsCopied).toBe(1);
  });

  it("o bug '0 produtos copiados': chaves ausentes viram 0, não undefined", () => {
    const r = parseCloneMenuResult({});
    expect(r.productsCopied).toBe(0);
    expect(r.categoriesCopied).toBe(0);
  });

  it("valores inválidos viram 0 (nunca NaN/negativo na tela)", () => {
    const r = parseCloneMenuResult({ products_copied: -3, categories_copied: "x" });
    expect(r.productsCopied).toBe(0);
    expect(r.categoriesCopied).toBe(0);
  });
});

describe("parseResyncMenuResult", () => {
  it("lê todas as contagens do re-sync", () => {
    const r = parseResyncMenuResult({
      categories_copied: 1,
      categories_updated: 2,
      products_copied: 4,
      products_updated: 3,
      products_price_synced: 2,
      products_price_skipped: 1,
      products_price_overwritten: 0,
      addon_groups_copied: 0,
      addon_groups_updated: 1,
      addon_items_copied: 2,
      addon_items_updated: 0,
      products_removed_from_matriz: 1,
    });
    expect(r.productsCopied).toBe(4);
    expect(r.productsPriceSkipped).toBe(1);
    expect(r.productsRemovedFromMatriz).toBe(1);
  });
});

describe("parseMenuDivergence", () => {
  it("lê os itens e valida o status (desconhecido vira ok)", () => {
    const items = parseMenuDivergence({
      source_store_id: "s",
      target_store_id: "t",
      items: [
        {
          network_code: "c1",
          product_name: "Pizza",
          matriz_price: 50,
          subloja_price: 45,
          last_synced_price: 50,
          status: "preco_proprio",
          changed_fields: [],
        },
        {
          network_code: "c2",
          product_name: "Lanche",
          matriz_price: 20,
          subloja_price: null,
          last_synced_price: null,
          status: "status-que-nao-existe",
          changed_fields: ["name"],
        },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].status).toBe("preco_proprio");
    expect(items[1].status).toBe("ok");
    expect(items[1].changedFields).toEqual(["name"]);
  });

  it("sem items, devolve lista vazia", () => {
    expect(parseMenuDivergence({})).toEqual([]);
    expect(parseMenuDivergence(null)).toEqual([]);
  });
});

describe("summarizeMenuDivergence", () => {
  it("conta o que pede ação (tudo menos ok)", () => {
    const s = summarizeMenuDivergence([
      { networkCode: "a", productName: "A", matrizPrice: 10, sublojaPrice: 10, lastSyncedPrice: 10, status: "ok", changedFields: [] },
      { networkCode: "b", productName: "B", matrizPrice: 10, sublojaPrice: 12, lastSyncedPrice: 10, status: "preco_proprio", changedFields: [] },
      { networkCode: "c", productName: "C", matrizPrice: 10, sublojaPrice: null, lastSyncedPrice: null, status: "novo_na_matriz", changedFields: [] },
      { networkCode: "d", productName: "D", matrizPrice: null, sublojaPrice: 10, lastSyncedPrice: 10, status: "removido_na_matriz", changedFields: [] },
    ]);
    expect(s.total).toBe(4);
    expect(s.needsSync).toBe(3);
    expect(s.ownPrice).toBe(1);
    expect(s.newInMatriz).toBe(1);
    expect(s.removedFromMatriz).toBe(1);
  });
});

describe("isOwnPrice — regra de preço próprio do re-sync", () => {
  it("preço igual ao da matriz não é próprio", () => {
    expect(isOwnPrice({ matrizPrice: 50, sublojaPrice: 50, lastSyncedPrice: 40 })).toBe(false);
  });

  it("preço diferente do último sync (não-nulo) é próprio", () => {
    expect(isOwnPrice({ matrizPrice: 50, sublojaPrice: 45, lastSyncedPrice: 50 })).toBe(true);
  });

  it("preço igual ao último sync é desatualizado, não próprio", () => {
    expect(isOwnPrice({ matrizPrice: 50, sublojaPrice: 40, lastSyncedPrice: 40 })).toBe(false);
  });

  it("sem registro de sync, trata como desatualizado (não próprio)", () => {
    expect(isOwnPrice({ matrizPrice: 50, sublojaPrice: 40, lastSyncedPrice: null })).toBe(false);
  });
});

describe("rótulos de divergência", () => {
  it("todo status tem rótulo", () => {
    for (const s of ["ok", "divergente", "preco_proprio", "desatualizado", "novo_na_matriz", "removido_na_matriz"] as const) {
      expect(MENU_DIVERGENCE_LABELS[s]).toBeTruthy();
    }
  });
});
