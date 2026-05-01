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

let watcherId: string | null = null;
let currentOrderId: string | null = null;
let lastSentAt = 0;
const MIN_SEND_INTERVAL_MS = 3_000;

async function sendLocation(lat: number, lng: number, accuracy?: number, speed?: number, heading?: number) {
  const now = Date.now();
  if (now - lastSentAt < MIN_SEND_INTERVAL_MS) return;

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
    console.log(`[BgGeo] 📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} (acc: ${accuracy?.toFixed(0)}m)`);
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
    const { BackgroundGeolocation } = await import("@capacitor-community/background-geolocation");

    watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "ItaSuper está rastreando sua localização para entregas.",
        backgroundTitle: "Entrega em andamento",
        requestPermissions: true,
        stale: false,
        distanceFilter: 5,
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
    const { BackgroundGeolocation } = await import("@capacitor-community/background-geolocation");
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