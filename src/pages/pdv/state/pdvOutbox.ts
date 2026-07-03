/**
 * PDV Outbox — fila local de vendas para resiliência offline (Fase 3).
 *
 * API pura, sem React. Guarda payloads da RPC `pdv_finalize_sale` em
 * `localStorage` por loja. Cada entrada carrega um `client_uuid` gerado
 * no cliente; a RPC v2 é idempotente por esse UUID, então reenviar não
 * duplica vendas.
 */

const VERSION = "v1";
const MAX_ENTRIES = 200;

export interface OutboxEntry {
  client_uuid: string;
  store_id: string;
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  last_error?: string;
}

const FLAG_KEY = "pdv_offline_queue_enabled";

export function isOfflineQueueEnabled(): boolean {
  try {
    const v = localStorage.getItem(FLAG_KEY);
    return v === null ? true : v === "true";
  } catch {
    return false;
  }
}

function keyFor(storeId: string) {
  return `pdv_outbox_${VERSION}:${storeId}`;
}

function safeParse(raw: string | null): OutboxEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function list(storeId: string): OutboxEntry[] {
  try {
    return safeParse(localStorage.getItem(keyFor(storeId)));
  } catch {
    return [];
  }
}

function persist(storeId: string, entries: OutboxEntry[]) {
  try {
    localStorage.setItem(keyFor(storeId), JSON.stringify(entries));
  } catch (e) {
    console.warn("[pdvOutbox] persist failed", e);
  }
}

export function count(storeId: string): number {
  return list(storeId).length;
}

/** Enfileira. Retorna false se estourou o limite. */
export function enqueue(entry: Omit<OutboxEntry, "attempts" | "created_at">): boolean {
  const entries = list(entry.store_id);
  if (entries.length >= MAX_ENTRIES) return false;
  entries.push({ ...entry, attempts: 0, created_at: Date.now() });
  persist(entry.store_id, entries);
  return true;
}

export function remove(storeId: string, clientUuid: string) {
  const entries = list(storeId).filter((e) => e.client_uuid !== clientUuid);
  persist(storeId, entries);
}

export function markFailed(storeId: string, clientUuid: string, error: string) {
  const entries = list(storeId).map((e) =>
    e.client_uuid === clientUuid
      ? { ...e, attempts: e.attempts + 1, last_error: error }
      : e,
  );
  persist(storeId, entries);
}

export type FlushResult = {
  sent: number;
  failed: number;
  errors: string[];
};

/**
 * Tenta reenviar todas as entradas da fila.
 * `callRpc` recebe o payload já com `client_uuid` e deve devolver
 * `{ ok: true }` em sucesso (inclusive idempotente) ou `{ ok: false, error }`.
 */
export async function flush(
  storeId: string,
  callRpc: (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>,
): Promise<FlushResult> {
  const entries = list(storeId);
  const result: FlushResult = { sent: 0, failed: 0, errors: [] };
  for (const entry of entries) {
    try {
      const res = await callRpc(entry.payload);
      if (res.ok) {
        remove(storeId, entry.client_uuid);
        result.sent += 1;
      } else {
        markFailed(storeId, entry.client_uuid, res.error ?? "unknown");
        result.failed += 1;
        if (res.error) result.errors.push(res.error);
      }
    } catch (e: any) {
      markFailed(storeId, entry.client_uuid, e?.message ?? "throw");
      result.failed += 1;
      result.errors.push(e?.message ?? "throw");
    }
  }
  return result;
}