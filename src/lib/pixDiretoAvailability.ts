// Fase 5 — o checkout sabe se o Pix Direto existe sem ver a chave.
// stores_public devolve só o booleano pix_direto_key_configured (a chave
// saiu da vista pública); a chave em si só aparece no contexto do pedido
// (RPC get_store_pix_direto / edge guest-order-status).
export function isPixDiretoAvailable(
  store: {
    pix_direto_enabled?: unknown;
    pix_direto_key_configured?: unknown;
  } | null | undefined,
): boolean {
  return Boolean(store?.pix_direto_enabled) && Boolean(store?.pix_direto_key_configured);
}
