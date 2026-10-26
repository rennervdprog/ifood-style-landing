// Fase 5 — rate limit no rastreio público (P1-3, decisão (d) do plano).
//
// Espelho das constantes e decisões da edge guest-order-status, com testes
// em Vitest. A edge é autocontida e NÃO importa este lib (o deploy não sobe
// subdiretórios) — o código lá dentro repete estes mesmos números. Se mudar
// um limite aqui, mudar na edge também (e vice-versa).
export const TRACKING_RATE_LIMIT_WINDOW_MINUTES = 10;
export const TRACKING_MAX_WRONG_PER_ORDER = 10;
export const TRACKING_MAX_WRONG_PER_IP = 30;
export const TRACKING_ATTEMPT_RETENTION_DAYS = 1;

/** Início da janela de contagem (10 min atrás, por padrão). */
export function rateLimitWindowStart(now: Date): Date {
  return new Date(now.getTime() - TRACKING_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
}

/**
 * O pedido está bloqueado? Com 10 erradas já registradas, a próxima
 * tentativa errada é a 11ª e volta 429 (critério de aceite do plano).
 */
export function isOrderRateLimited(wrongAttemptsInWindow: number): boolean {
  return wrongAttemptsInWindow >= TRACKING_MAX_WRONG_PER_ORDER;
}

/** O IP está bloqueado? Mesmo raciocínio, com o teto mais frouxo (30). */
export function isIpRateLimited(wrongAttemptsInWindow: number): boolean {
  return wrongAttemptsInWindow >= TRACKING_MAX_WRONG_PER_IP;
}
