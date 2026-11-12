import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  splitCartItemId,
  extractApparelMetadata,
} from "../../splitCartItemId";
import { usePdvCart } from "../usePdvCart";

// UUIDs reais da Demonstração (Vestido Floral G/Estampado) — os mesmos da
// mensagem de erro viva do N1.
const PARENT = "e9015658-740f-4e32-a59d-db85d828bcb3";
const VARIANT = "6e62206f-0985-4f73-b4a7-8820c083ee6e";
const COMPOSITE = `${PARENT}::${VARIANT}`;
const FOOD = "25854384-3dc1-4cb2-b5ee-4dcab8517741";

const apparelMeta = {
  apparel_variant_id: VARIANT,
  apparel_parent_product_id: PARENT,
  apparel_size: "G",
  apparel_color: "Estampado",
};

describe("splitCartItemId (N1 F1)", () => {
  it("composto com metadata completa → uuid pai + variante + metadata intacta", () => {
    const r = splitCartItemId({ id: COMPOSITE, metadata: { ...apparelMeta } });
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata).toEqual(apparelMeta);
  });

  it("composto sem metadata → reconstrói a identidade da variante (nunca 'pai sem variante')", () => {
    const r = splitCartItemId({ id: COMPOSITE });
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata?.apparel_variant_id).toBe(VARIANT);
    expect(r.metadata?.apparel_parent_product_id).toBe(PARENT);
  });

  it("composto com metadata vazia → reconstrói a identidade da variante", () => {
    const r = splitCartItemId({ id: COMPOSITE, metadata: {} });
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata?.apparel_variant_id).toBe(VARIANT);
  });

  it("composto com metadata sem chaves apparel → preserva as chaves e injeta a identidade", () => {
    const r = splitCartItemId({
      id: COMPOSITE,
      metadata: { weight_grams: 500 },
    });
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata?.weight_grams).toBe(500);
    expect(r.metadata?.apparel_variant_id).toBe(VARIANT);
  });

  it("simples sem metadata → id intacto, sem variante, metadata null", () => {
    const r = splitCartItemId({ id: FOOD });
    expect(r).toEqual({ productId: FOOD, variantId: null, metadata: null });
  });

  it("simples com metadata de peso → preserva o metadata (regressão alimentos)", () => {
    const meta = { weight_grams: 500, price_per_kg: 40, weight_unit: "kg" };
    const r = splitCartItemId({ id: FOOD, metadata: meta });
    expect(r).toEqual({ productId: FOOD, variantId: null, metadata: meta });
  });

  it("metadata.apparel_parent_product_id vence o split do id", () => {
    const r = splitCartItemId({
      id: `outro-pai::${VARIANT}`,
      metadata: { ...apparelMeta },
    });
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
  });

  it("id simples com metadata de variante → pai e variante vêm do metadata", () => {
    const r = splitCartItemId({ id: PARENT, metadata: { ...apparelMeta } });
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata).toEqual(apparelMeta);
  });

  it("metadata null explícito comporta-se como ausente", () => {
    expect(splitCartItemId({ id: FOOD, metadata: null }).metadata).toBeNull();
    const r = splitCartItemId({ id: COMPOSITE, metadata: null });
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata?.apparel_variant_id).toBe(VARIANT);
  });
});

describe("extractApparelMetadata (N1 F2)", () => {
  it("recorta só as 4 chaves apparel, descartando sizes/builders do modelo", () => {
    const r = extractApparelMetadata({
      sizes: ["P", "M", "G"],
      builder_type: "pizza",
      ...apparelMeta,
    });
    expect(r).toEqual(apparelMeta);
  });

  it("sem apparel_variant_id → undefined (alimento: sem metadata no carrinho)", () => {
    expect(extractApparelMetadata({ sizes: ["P"] })).toBeUndefined();
    expect(extractApparelMetadata({})).toBeUndefined();
    expect(extractApparelMetadata(null)).toBeUndefined();
    expect(extractApparelMetadata(undefined)).toBeUndefined();
  });

  it("completa tamanho/cor ausentes com null", () => {
    expect(
      extractApparelMetadata({
        apparel_variant_id: VARIANT,
        apparel_parent_product_id: PARENT,
      }),
    ).toEqual({
      apparel_variant_id: VARIANT,
      apparel_parent_product_id: PARENT,
      apparel_size: null,
      apparel_color: null,
    });
  });
});

describe("cadeia modal → carrinho → fronteira (N1 F2+F3/F4)", () => {
  // Simula exatamente o que ProductDetailModal passa após o F2: o 6º
  // argumento de handleModalAdd = extractApparelMetadata(product.metadata).
  it("handleModalAdd com metadata extraída do modal preserva a variante até o split", () => {
    const { result } = renderHook(() => usePdvCart());
    const pseudo: any = {
      id: COMPOSITE,
      name: "Vestido Floral (G · Estampado)",
      price: 129.9,
      image_url: null,
      metadata: { ...(apparelMeta as any) },
    };
    act(() =>
      result.current.handleModalAdd(
        pseudo,
        [],
        "",
        1,
        129.9,
        extractApparelMetadata(pseudo.metadata),
      ),
    );
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].id).toBe(COMPOSITE);
    expect(result.current.cart[0].metadata?.apparel_variant_id).toBe(VARIANT);
    const r = splitCartItemId(result.current.cart[0]);
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata?.apparel_variant_id).toBe(VARIANT);
  });

  it("addScannedProduct (caminho direto) também chega ao split com pai + variante", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.addScannedProduct({
        id: COMPOSITE,
        name: "Vestido Floral (G · Estampado)",
        price: 129.9,
        image_url: null,
        section_id: null,
        is_available: true,
        metadata: { ...apparelMeta },
      } as any),
    );
    const r = splitCartItemId(result.current.cart[0]);
    expect(r.productId).toBe(PARENT);
    expect(r.variantId).toBe(VARIANT);
    expect(r.metadata?.apparel_variant_id).toBe(VARIANT);
  });

  it("alimento via modal segue sem variante e com id intacto", () => {
    const { result } = renderHook(() => usePdvCart());
    act(() =>
      result.current.handleModalAdd(
        { id: FOOD, name: "Produto Teste Desconto", price: 10, image_url: null } as any,
        [],
        "",
        2,
        10,
        extractApparelMetadata(undefined),
      ),
    );
    const r = splitCartItemId(result.current.cart[0]);
    expect(r).toEqual({ productId: FOOD, variantId: null, metadata: null });
  });
});
