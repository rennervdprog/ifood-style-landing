// Saldo vivo na vitrine (bug do catálogo, E2E 15/11/2026): a flag
// `metadata.out_of_stock` pode estar ausente/desatualizada — a RPC
// `store_stock_flags` devolve o estado real por produto (só booleanos,
// sem quantidades) e a vitrine mescla esse estado no metadata em memória.
// A mescla SÓ ADICIONA a flag: nunca remove uma marcação manual do lojista
// (toggleProductOutOfStock no MenuBuilder) nem uma flag já gravada.

export interface StoreStockFlag {
  product_id: string;
  out_of_stock: boolean;
}

/** Conjunto de ids esgotados segundo o saldo vivo. */
export function buildOutOfStockSet(
  flags: StoreStockFlag[] | null | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const f of flags || []) {
    if (f.out_of_stock) set.add(f.product_id);
  }
  return set;
}

/**
 * Devolve a lista com `metadata.out_of_stock=true` nos produtos que o saldo
 * vivo aponta como esgotados. Produtos fora do conjunto voltam com a MESMA
 * referência (sem cópia); se o conjunto estiver vazio, volta a lista intacta.
 */
export function applyLiveStockFlags<
  T extends { id: string; metadata?: Record<string, any> | null },
>(products: T[], outOfStock: Set<string>): T[] {
  if (outOfStock.size === 0) return products;
  return products.map((p) =>
    outOfStock.has(p.id)
      ? { ...p, metadata: { ...(p.metadata || {}), out_of_stock: true } }
      : p,
  );
}
