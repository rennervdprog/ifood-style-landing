/**
 * offlineDeliveryQueue
 * Fila local de confirmações de entrega quando sem sinal.
 *
 * Fluxo:
 * 1. Motoboy digita PIN sem internet
 * 2. Confirmação salva localmente via localStorage + Capacitor Preferences
 * 3. Quando sinal voltar → envia automaticamente
 * 4. Sucesso → remove da fila
 * 5. Falha → mantém na fila para tentar de novo
 */
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "itasuper_delivery_queue";
const DEVICE_ID = (() => {
  let id = localStorage.getItem("itasuper_device_id");
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("itasuper_device_id", id);
  }
  return id;
})();

export interface QueuedDelivery {
  order_id: string;
  pin: string;
  attempted_at: string;
  order_number?: string; // para exibir ao motoboy
  retries: number;
}

// ── Leitura / escrita da fila ────────────────────────────────────────────────

export const getQueue = (): QueuedDelivery[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveQueue = (queue: QueuedDelivery[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("[offlineQueue] Erro ao salvar fila:", e);
  }
};

export const addToQueue = (item: Omit<QueuedDelivery, "retries">): void => {
  const queue = getQueue();
  // Evitar duplicatas do mesmo pedido
  const exists = queue.find(q => q.order_id === item.order_id);
  if (exists) {
    exists.pin = item.pin; // atualizar PIN se tentou de novo
    exists.attempted_at = item.attempted_at;
    saveQueue(queue);
  } else {
    saveQueue([...queue, { ...item, retries: 0 }]);
  }
};

export const removeFromQueue = (order_id: string): void => {
  saveQueue(getQueue().filter(q => q.order_id !== order_id));
};

// ── Tentar confirmar um item da fila ────────────────────────────────────────

const tryConfirm = async (item: QueuedDelivery): Promise<"success" | "invalid_pin" | "retry"> => {
  try {
    const { data, error } = await supabase.rpc(
      "driver_finish_delivery_offline" as any,
      {
        _order_id: item.order_id,
        _pin: item.pin,
        _attempted_at: item.attempted_at,
        _device_id: DEVICE_ID,
      }
    );

    if (error) {
      console.warn("[offlineQueue] RPC error:", error.message);
      return "retry";
    }

    const result = data as any;
    if (result?.success || result?.already_done) return "success";
    if (result?.error === "invalid_pin") return "invalid_pin";

    return "retry";
  } catch (e) {
    console.warn("[offlineQueue] Network error:", e);
    return "retry";
  }
};

// ── Processar fila completa ──────────────────────────────────────────────────

export interface SyncResult {
  confirmed: string[]; // order_ids confirmados com sucesso
  failed: string[];    // order_ids com PIN inválido (não tentar mais)
  pending: string[];   // order_ids que ainda precisam de retry
}

export const syncQueue = async (): Promise<SyncResult> => {
  const queue = getQueue();
  if (queue.length === 0) return { confirmed: [], failed: [], pending: [] };

  const confirmed: string[] = [];
  const failed: string[] = [];
  const remaining: QueuedDelivery[] = [];

  for (const item of queue) {
    const result = await tryConfirm(item);

    if (result === "success") {
      confirmed.push(item.order_id);
    } else if (result === "invalid_pin") {
      failed.push(item.order_id); // PIN errado — não tentar mais
    } else {
      // Retry — incrementar contador, manter na fila (max 20 tentativas)
      if (item.retries < 20) {
        remaining.push({ ...item, retries: item.retries + 1 });
      } else {
        failed.push(item.order_id); // Desistir após 20 tentativas
      }
    }
  }

  saveQueue(remaining);
  return { confirmed, failed, pending: remaining.map(r => r.order_id) };
};

// ── GPS offline queue ────────────────────────────────────────────────────────

const GPS_QUEUE_KEY = "itasuper_gps_queue";

interface GpsPoint { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number; ts: number; }

export const addGpsToQueue = (point: Omit<GpsPoint, "ts">) => {
  try {
    const raw = localStorage.getItem(GPS_QUEUE_KEY);
    const queue: GpsPoint[] = raw ? JSON.parse(raw) : [];
    // Manter máximo 50 pontos (não explodir o storage)
    if (queue.length >= 50) queue.shift();
    queue.push({ ...point, ts: Date.now() });
    localStorage.setItem(GPS_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const flushGpsQueue = async (storeId: string, driverId: string): Promise<void> => {
  try {
    const raw = localStorage.getItem(GPS_QUEUE_KEY);
    if (!raw) return;
    const queue: GpsPoint[] = JSON.parse(raw);
    if (queue.length === 0) return;

    // Enviar em lote — só o mais recente importa para o mapa em tempo real
    const latest = queue[queue.length - 1];
    await supabase.from("driver_locations" as any).upsert({
      store_id: storeId,
      driver_id: driverId,
      lat: latest.lat,
      lng: latest.lng,
      accuracy: latest.accuracy,
      speed: latest.speed,
      heading: latest.heading,
      updated_at: new Date(latest.ts).toISOString(),
    }, { onConflict: "driver_id,store_id" });

    localStorage.removeItem(GPS_QUEUE_KEY);
  } catch (e) {
    console.warn("[offlineQueue] GPS flush error:", e);
  }
};
