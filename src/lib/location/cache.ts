/**
 * Cache unificado em memória + sessionStorage com TTL por chave.
 * Usado por GPS, reverse geocode, geocode e CEP.
 */

type Entry<T> = { value: T; ts: number; ttl: number };

const mem = new Map<string, Entry<unknown>>();

function readSession<T>(key: string): Entry<T> | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Entry<T>;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, entry: Entry<T>) {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

function fresh<T>(e: Entry<T> | null): T | null {
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) return null;
  return e.value;
}

export function cacheGet<T>(key: string, opts?: { persist?: boolean }): T | null {
  const m = mem.get(key) as Entry<T> | undefined;
  const hit = fresh(m ?? null);
  if (hit !== null) return hit;
  if (opts?.persist) {
    const s = readSession<T>(key);
    const sv = fresh(s);
    if (sv !== null && s) {
      mem.set(key, s as Entry<unknown>);
      return sv;
    }
  }
  return null;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number, opts?: { persist?: boolean }) {
  const entry: Entry<T> = { value, ts: Date.now(), ttl: ttlMs };
  mem.set(key, entry as Entry<unknown>);
  if (opts?.persist) writeSession(key, entry);
}

export function cacheClear(prefix?: string) {
  if (!prefix) {
    mem.clear();
    return;
  }
  for (const k of Array.from(mem.keys())) if (k.startsWith(prefix)) mem.delete(k);
}

/** TTLs padrão por categoria. */
export const TTL = {
  gps: 5 * 60 * 1000,
  reverse: 24 * 60 * 60 * 1000,
  geocode: 7 * 24 * 60 * 60 * 1000,
  cep: 30 * 24 * 60 * 60 * 1000,
} as const;
