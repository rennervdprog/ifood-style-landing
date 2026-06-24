/**
 * Cálculo de preço da pizza — função pura, usada pelo modal do cliente e pelo PDV.
 *
 * Resolução do preço de um sabor em um tamanho:
 *  1. Override no sabor (metadata.pizza_size_overrides[sizeId])
 *  2. Matriz da loja (priceMatrix[categoryId][sizeId])
 *  3. Legado por nome (metadata.sizes[].name === sizeName)
 *  4. Fallback: product.price
 */
import type {
  PizzaCatalogConfig,
  PizzaFlavorMeta,
  PizzaSizeCatalogItem,
  PizzaSizeId,
} from "@/types/pizza";

export type PizzaPriceMode = "maior" | "media" | "soma";

export interface PricingFlavor {
  id: string;
  price: number;
  metadata?: PizzaFlavorMeta | Record<string, any> | null;
}

/** Preço de UM sabor em UM tamanho, considerando override → matriz → legado → fallback. */
export function priceForFlavorInSize(
  flavor: PricingFlavor,
  size: PizzaSizeCatalogItem | { id: PizzaSizeId; name: string } | null,
  catalog: PizzaCatalogConfig,
): number {
  const meta = (flavor.metadata || {}) as PizzaFlavorMeta;
  if (!size) return Number(flavor.price) || 0;

  // 1. override por sabor
  const override = meta.pizza_size_overrides?.[size.id];
  if (typeof override === "number" && override > 0) return override;

  // 2. matriz da loja por categoria
  const catId = meta.pizza_category_id;
  if (catId && catalog.priceMatrix[catId]) {
    const p = catalog.priceMatrix[catId][size.id];
    if (typeof p === "number" && p > 0) return p;
  }

  // 3. legado: metadata.sizes por nome
  const legacy = Array.isArray(meta.sizes) ? meta.sizes : [];
  const byName = legacy.find((s) => s?.name === size.name && Number(s.price) > 0);
  if (byName) return Number(byName.price);

  // 4. fallback
  return Number(flavor.price) || 0;
}

/** Aplica a regra da loja (maior / média / soma) sobre os preços dos sabores escolhidos. */
export function combinePricesByMode(prices: number[], mode: PizzaPriceMode): number {
  if (!prices.length) return 0;
  if (mode === "media" || mode === "soma") {
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }
  return Math.max(...prices);
}

/** Preço final da pizza para N sabores em um tamanho. */
export function computePizzaPrice(params: {
  flavors: PricingFlavor[];
  size: PizzaSizeCatalogItem | { id: PizzaSizeId; name: string } | null;
  catalog: PizzaCatalogConfig;
  mode: PizzaPriceMode;
}): number {
  const { flavors, size, catalog, mode } = params;
  if (!flavors.length) return 0;
  const prices = flavors.map((f) => priceForFlavorInSize(f, size, catalog));
  return combinePricesByMode(prices, mode);
}

/** Sabor disponível neste tamanho? */
export function isFlavorAvailableInSize(
  flavor: PricingFlavor,
  sizeId: PizzaSizeId | null,
): boolean {
  if (!sizeId) return true;
  const meta = (flavor.metadata || {}) as PizzaFlavorMeta;
  return !(meta.pizza_unavailable_sizes || []).includes(sizeId);
}