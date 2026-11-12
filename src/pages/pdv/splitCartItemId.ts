/**
 * N1 (F1) — separa o id composto `produto::variante` no ponto de fronteira
 * com o banco, preservando a identidade da variante.
 *
 * O carrinho do PDV usa o id composto como chave de linha (é o que distingue
 * G de M na UI — `ApparelCatalogGrid.handleCellClick`). Mas nenhum argumento
 * ou coluna `uuid` do banco aceita o composto: o cast `::uuid` falha com
 * 22P02 (`pdv_add_tab_item`, `pdv_finalize_sale`, inserts em `order_items`).
 *
 * Regra: toda vez que um item cruza para o banco, envia-se uuid pai +
 * metadata com as chaves apparel. Separar SÓ o id não basta — sem o metadata,
 * a venda concluiria como alimento comum sem baixar a variante e sem alerta
 * (`stock_decrement_sale_internal` retorna `true` silencioso para o pai sem
 * linha em `product_stock`).
 *
 * Fonte do pai, em ordem: `metadata.apparel_parent_product_id` →
 * `id.split("::")[0]`. Fonte da variante: `metadata.apparel_variant_id` →
 * `id.split("::")[1]`. Quando o id é composto mas o metadata não carrega a
 * variante (rascunho antigo, caminho sem F2), o metadata é reconstruído com
 * a identidade da variante — nunca se envia "pai sem variante".
 *
 * Módulo puro, sem imports: pode ser importado pelos 4 pontos de fronteira
 * (comanda, checkout, pedido manual, modal) sem risco de ciclo.
 */

export interface SplitCartItemResult {
  /** uuid do produto pai — o único valor válido para colunas/args `uuid`. */
  productId: string;
  /** uuid da variante, ou `null` quando o item não é variante boutique. */
  variantId: string | null;
  /**
   * Metadata a enviar ao banco: a do item quando já carrega a variante
   * (ou outros dados, ex.: peso), reconstruída com as 4 chaves apparel
   * quando o id é composto e o metadata não as tem, `null` quando não há
   * nada a enviar (comportamento atual dos alimentos sem metadata).
   */
  metadata: Record<string, any> | null;
}

export type CartItemIdentity = {
  id: string;
  metadata?: Record<string, any> | null;
};

/**
 * Extrai SÓ as 4 chaves apparel do metadata de um produto — o mesmo recorte
 * que `addScannedProduct` faz (Fase 2, L-23). As demais chaves do metadata
 * do produto (sizes, builders etc.) NÃO vão para o carrinho.
 * Retorna `undefined` quando não há variante (alimentos: comportamento
 * atual, sem metadata no item do carrinho).
 */
export function extractApparelMetadata(
  metadata?: Record<string, any> | null,
): Record<string, any> | undefined {
  if (!metadata?.apparel_variant_id) return undefined;
  return {
    apparel_variant_id: metadata.apparel_variant_id,
    apparel_parent_product_id: metadata.apparel_parent_product_id ?? null,
    apparel_size: metadata.apparel_size ?? null,
    apparel_color: metadata.apparel_color ?? null,
  };
}

export function splitCartItemId(item: CartItemIdentity): SplitCartItemResult {
  const metadata = item.metadata ?? null;
  const parentFromMeta =
    typeof metadata?.apparel_parent_product_id === "string" &&
    metadata.apparel_parent_product_id
      ? metadata.apparel_parent_product_id
      : null;
  const variantFromMeta =
    typeof metadata?.apparel_variant_id === "string" &&
    metadata.apparel_variant_id
      ? metadata.apparel_variant_id
      : null;

  const sep = item.id.indexOf("::");
  const head = sep >= 0 ? item.id.slice(0, sep) : item.id;
  const tail = sep >= 0 ? item.id.slice(sep + 2) : "";

  const productId = parentFromMeta ?? head;
  const variantId = variantFromMeta ?? (tail ? tail : null);

  if (variantId) {
    // O metadata já carrega a variante: envia como está.
    if (metadata?.apparel_variant_id) {
      return { productId, variantId, metadata };
    }
    // Id composto sem identidade no metadata: reconstrói a identidade
    // preservando as demais chaves que porventura existam.
    return {
      productId,
      variantId,
      metadata: {
        ...(metadata ?? {}),
        apparel_variant_id: variantId,
        apparel_parent_product_id: productId,
        apparel_size: metadata?.apparel_size ?? null,
        apparel_color: metadata?.apparel_color ?? null,
      },
    };
  }

  // Alimento / produto simples: preserva o metadata (ex.: peso) ou null.
  if (metadata && Object.keys(metadata).length > 0) {
    return { productId, variantId: null, metadata };
  }
  return { productId, variantId: null, metadata: null };
}
