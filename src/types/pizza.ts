/**
 * Tipos do catálogo profissional de pizzas (tamanhos + categorias + matriz de preço).
 * Tudo guardado em `stores.settings` — sem nova tabela.
 *
 * Convivência com o modelo legado (`product.metadata.sizes`):
 *  - Se a loja tiver `pizza_sizes_catalog` populado, ele é a fonte da verdade.
 *  - Caso contrário, o sistema cai no modo legado (compatibilidade total).
 */

export type PizzaSizeId = string;
export type PizzaCategoryId = string;

export interface PizzaSizeCatalogItem {
  /** ID estável (slug do nome, ex.: "grande"). */
  id: PizzaSizeId;
  /** Nome exibido (ex.: "Grande 35cm"). */
  name: string;
  /** Descrição curta (ex.: "8 fatias · serve 3 pessoas"). */
  description?: string;
  /** Sobrescreve o máximo global de sabores neste tamanho. */
  maxFlavors?: 1 | 2 | 3 | 4;
  /** Se false, não aparece no cliente. */
  active: boolean;
}

export interface PizzaFlavorCategory {
  id: PizzaCategoryId;
  name: string;
  /** Cor opcional para o badge (hex). */
  color?: string;
}

/** matrix[categoryId][sizeId] = preço base do sabor naquele tamanho. */
export type PizzaPriceMatrix = Record<PizzaCategoryId, Record<PizzaSizeId, number>>;

/** Configuração agregada lida de `stores.settings`. */
export interface PizzaCatalogConfig {
  sizes: PizzaSizeCatalogItem[];
  categories: PizzaFlavorCategory[];
  priceMatrix: PizzaPriceMatrix;
}

/** Metadata adicional do produto quando o catálogo está ativo. */
export interface PizzaFlavorMeta {
  pizza_category_id?: PizzaCategoryId;
  /** Override pontual de preço para este sabor: { sizeId: price }. */
  pizza_size_overrides?: Record<PizzaSizeId, number>;
  /** Lista de tamanhos em que ESTE sabor não está disponível. */
  pizza_unavailable_sizes?: PizzaSizeId[];
  /** Legado: usado quando o catálogo não existe. */
  sizes?: Array<{ name: string; price: number }>;
}

export const slugifySizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || `s${Date.now().toString(36)}`;

/** Lê a config do catálogo a partir de `stores.settings`, normalizando defaults. */
export function readPizzaCatalogConfig(settings: Record<string, any> | null | undefined): PizzaCatalogConfig {
  const s = settings || {};
  const sizes = Array.isArray(s.pizza_sizes_catalog) ? (s.pizza_sizes_catalog as PizzaSizeCatalogItem[]) : [];
  const categories = Array.isArray(s.pizza_flavor_categories) ? (s.pizza_flavor_categories as PizzaFlavorCategory[]) : [];
  const priceMatrix = (s.pizza_price_matrix && typeof s.pizza_price_matrix === "object")
    ? (s.pizza_price_matrix as PizzaPriceMatrix)
    : {};
  return { sizes, categories, priceMatrix };
}

/** Indica se a loja já adotou o catálogo profissional. */
export function hasPizzaCatalog(cfg: PizzaCatalogConfig | Record<string, any> | null | undefined): boolean {
  if (!cfg) return false;
  const sizes = Array.isArray((cfg as any).sizes) ? (cfg as any).sizes : [];
  const categories = Array.isArray((cfg as any).categories) ? (cfg as any).categories : [];
  return sizes.length > 0 && categories.length > 0;
}