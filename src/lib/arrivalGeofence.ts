/**
 * Geofence de chegada (Fase 4 — fluxo "Navegar e Retornar").
 *
 * Observa o GPS do entregador e dispara o callback quando ele entra em
 * um raio de N metros do destino. Usado para abrir automaticamente o
 * card de "Digite o PIN" assim que o motoboy chega no cliente.
 */

const DEFAULT_RADIUS_M = 50;

export interface ArrivalTarget {
  orderId: string;
  lat: number;
  lng: number;
  radiusM?: number;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let watchId: number | null = null;
let currentTarget: ArrivalTarget | null = null;
let triggeredOrderIds = new Set<string>();
let onArrival: ((orderId: string) => void) | null = null;

export function startArrivalWatch(target: ArrivalTarget, callback: (orderId: string) => void) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  // Evita refire duplicado
  if (triggeredOrderIds.has(target.orderId)) return;

  currentTarget = target;
  onArrival = callback;

  if (watchId !== null) return; // já há um watcher ativo

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!currentTarget || !onArrival) return;
      const d = haversineMeters(
        pos.coords.latitude,
        pos.coords.longitude,
        currentTarget.lat,
        currentTarget.lng,
      );
      const radius = currentTarget.radiusM ?? DEFAULT_RADIUS_M;
      if (d <= radius && !triggeredOrderIds.has(currentTarget.orderId)) {
        triggeredOrderIds.add(currentTarget.orderId);
        const oid = currentTarget.orderId;
        const cb = onArrival;
        // Limpa antes de chamar pra evitar double-fire
        stopArrivalWatch();
        cb(oid);
      }
    },
    () => { /* erros silenciosos — não bloqueia UI */ },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

export function stopArrivalWatch() {
  if (watchId !== null && navigator.geolocation) {
    try { navigator.geolocation.clearWatch(watchId); } catch { /* noop */ }
  }
  watchId = null;
  currentTarget = null;
  onArrival = null;
}

/** Permite re-armar a chegada para um pedido (útil em testes/dev). */
export function resetArrivalTrigger(orderId?: string) {
  if (orderId) triggeredOrderIds.delete(orderId);
  else triggeredOrderIds = new Set();
}
