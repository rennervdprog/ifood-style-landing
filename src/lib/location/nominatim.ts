/**
 * Fila serializada para o Nominatim (1 req/s) — evita 429.
 */

const MIN_INTERVAL_MS = 1100;
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

export function nominatimQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastCall));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next as Promise<T>;
}

export const NOMINATIM_HEADERS = {
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
} as const;
