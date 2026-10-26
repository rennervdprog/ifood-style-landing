// Fase 6B (P2-3): chave de idempotência persistente do checkout guest.
//
// Antes, a página gerava um UUID novo a cada montagem (`useRef(crypto.randomUUID())`):
// sair e voltar e reenviar duplicava o pedido. Agora a chave vive no
// `sessionStorage`, uma por loja (`itasuper_guest_idem:<storeId>`), e é
// reutilizada até o pedido confirmar — a edge repassa a mesma chave à RPC
// `create_order_with_items`, que devolve o mesmo pedido no retry.
// A chave é limpa no sucesso (GuestCheckoutPage, antes de navegar para
// `/p/<id>`) e na página de acompanhamento, quando o pedido carrega.
//
// Testável sem React: nenhuma dependência de componente, só `sessionStorage`
// (com fallback silencioso quando indisponível — ex.: modo privado — e a
// chave vale só para a montagem atual).
export const GUEST_IDEMPOTENCY_KEY_PREFIX = "itasuper_guest_idem:";

export function guestIdempotencyStorageKey(storeId: string): string {
  return `${GUEST_IDEMPOTENCY_KEY_PREFIX}${storeId}`;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback para ambientes sem crypto.randomUUID — formato UUID v4.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readStoredKey(storageKey: string): string | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

/** Devolve a chave da loja — a guardada, ou uma nova (que fica guardada). */
export function getGuestIdempotencyKey(storeId: string | undefined | null): string {
  if (!storeId) return newIdempotencyKey();
  const storageKey = guestIdempotencyStorageKey(storeId);
  const existing = readStoredKey(storageKey);
  if (existing) return existing;
  const fresh = newIdempotencyKey();
  try {
    sessionStorage.setItem(storageKey, fresh);
  } catch {
    // Sem persistência: a chave vale só para esta montagem — o retry do
    // mesmo submit continua usando a mesma (o front a reutiliza).
  }
  return fresh;
}

/** Limpa a chave da loja — chamar quando o pedido confirmar. */
export function clearGuestIdempotencyKey(storeId: string | undefined | null): void {
  if (!storeId) return;
  try {
    sessionStorage.removeItem(guestIdempotencyStorageKey(storeId));
  } catch {
    // Nada a fazer: a chave some com a sessão de qualquer jeito.
  }
}
