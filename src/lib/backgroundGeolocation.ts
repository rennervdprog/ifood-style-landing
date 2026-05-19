/**
 * Background Geolocation usando @capacitor-community/background-geolocation.
 * Mantém o GPS do entregador ativo mesmo com app em background ou tela apagada,
 * via Foreground Service nativo no Android (notificação fixa de rastreamento).
 *
 * Este módulo SUBSTITUI o watchPosition padrão do @capacitor/geolocation
 * apenas para o perfil ENTREGADOR quando estiver em turno (online).
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { supabase } from "@/integrations/supabase/client";
import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  "BackgroundGeolocation"
);

let watcherId: string | null = null;
let currentOrderId: string | null = null;
let lastSentAt = 0;

// ── GPS adaptativo (modelo Uber) ─────────────────────────────────────────
// Velocidade alta (>10 km/h): atualiza a cada 3s — precisão máxima em movimento
// Velocidade baixa (2-10 km/h): atualiza a cada 8s — andando / tráfego lento
// Velocidade muito baixa (<2 km/h): atualiza a cada 20s — parado / esperando
function getAdaptiveInterval(speedMs: number | null | undefined): number {
  if (speedMs == null || speedMs < 0) return 8_000; // desconhecido → moderado
  const kmh = speedMs * 3.6;
  if (kmh >= 10) return 3_000;   // moto em movimento
  if (kmh >= 2)  return 8_000;   // andando / tráfego
  return 20_000;                  // parado — economiza bateria
}

async function sendLocation(lat: number, lng: number, accuracy?: number, speed?: number, heading?: number) {
  const now = Date.now();
  const interval = getAdaptiveInterval(speed ?? null);
  if (now - lastSentAt < interval) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from("driver_locations" as any)
    .upsert(
      {
        driver_user_id: session.user.id,
        order_id: currentOrderId,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "driver_user_id" }
    );

  if (error) {
    console.warn("[BgGeo] Falha ao enviar:", error.message);
  } else {
    lastSentAt = now;
    // loc enviada — sem log em produção para reduzir I/O
  }
}

/**
 * Inicia o rastreamento em background com Foreground Service ativo.
 * Mostra uma notificação persistente "Rastreamento ativo" no Android
 * para impedir que o sistema mate o processo.
 */
export async function startBackgroundTracking(orderId?: string): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  if (watcherId) {
    if (orderId) currentOrderId = orderId;
    return true;
  }

  currentOrderId = orderId || null;

  try {
    watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "ItaSuper está rastreando sua localização para entregas.",
        backgroundTitle: "Entrega em andamento",
        requestPermissions: true,
        stale: false,
        distanceFilter: 8, // 8m — menos callbacks quando parado
      },
      (location, error) => {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
            console.warn("[BgGeo] Usuário negou permissão de localização.");
          } else {
            console.warn("[BgGeo] Erro:", error);
          }
          return;
        }
        if (!location) return;
        sendLocation(
          location.latitude,
          location.longitude,
          location.accuracy,
          location.speed ?? undefined,
          location.bearing ?? undefined
        ).catch(() => {});
      }
    );

    console.log("[BgGeo] ✅ Rastreamento em background iniciado (Foreground Service ativo).");
    return true;
  } catch (e) {
    console.error("[BgGeo] Falha ao iniciar:", e);
    watcherId = null;
    return false;
  }
}

/**
 * Atualiza o pedido ativo sendo rastreado (sem interromper o watcher).
 */
export function setBackgroundTrackingOrderId(orderId: string | null) {
  currentOrderId = orderId;
}

/**
 * Para o rastreamento e remove a notificação fixa.
 */
export async function stopBackgroundTracking(): Promise<void> {
  if (!watcherId) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    console.log("[BgGeo] 🛑 Rastreamento em background parado.");
  } catch (e) {
    console.warn("[BgGeo] Erro ao parar:", e);
  } finally {
    watcherId = null;
    currentOrderId = null;
    lastSentAt = 0;
  }
}

export function isBackgroundTracking(): boolean {
  return watcherId !== null;
}