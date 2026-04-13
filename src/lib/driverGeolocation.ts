/**
 * Driver GPS tracking using Capacitor Geolocation.
 * Sends location updates to driver_locations table every 10s while active.
 * Works on both native (Capacitor) and web (browser Geolocation API).
 */
import { supabase } from "@/integrations/supabase/client";

let watchId: string | null = null;
let intervalId: number | null = null;
let currentOrderId: string | null = null;
let lastPosition: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number } | null = null;

const UPDATE_INTERVAL_MS = 10_000; // 10 seconds
const MIN_DISTANCE_METERS = 10; // Only send if moved > 10m

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sendLocation(position: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const driverUserId = session.user.id;

  const { error } = await supabase
    .from("driver_locations" as any)
    .upsert(
      {
        driver_user_id: driverUserId,
        order_id: currentOrderId,
        latitude: position.lat,
        longitude: position.lng,
        accuracy: position.accuracy ?? null,
        speed: position.speed ?? null,
        heading: position.heading ?? null,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "driver_user_id" }
    );

  if (error) {
    console.warn("[GeoTrack] Failed to send location:", error.message);
  } else {
    console.log(`[GeoTrack] 📍 Location sent: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`);
    lastPosition = position;
  }
}

async function requestAndWatch() {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");

    // Request permission
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      console.warn("[GeoTrack] Permission denied");
      return false;
    }

    // Get initial position
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const initial = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed ?? undefined,
        heading: pos.coords.heading ?? undefined,
      };
      await sendLocation(initial);
    } catch (e) {
      console.warn("[GeoTrack] Initial position failed:", e);
    }

    // Watch position changes
    const id = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (position, err) => {
        if (err || !position) return;
        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
        };

        // Only update if moved significantly
        if (lastPosition) {
          const dist = haversineDistance(lastPosition.lat, lastPosition.lng, newPos.lat, newPos.lng);
          if (dist < MIN_DISTANCE_METERS) return;
        }

        sendLocation(newPos);
      }
    );

    watchId = id;

    // Also send periodic updates even if standing still (heartbeat)
    intervalId = window.setInterval(async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
        await sendLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ?? undefined,
          heading: pos.coords.heading ?? undefined,
        });
      } catch {
        // Silent fail for periodic updates
      }
    }, UPDATE_INTERVAL_MS);

    console.log("[GeoTrack] ✅ Tracking started");
    return true;
  } catch (e) {
    console.error("[GeoTrack] Failed to start:", e);
    return false;
  }
}

/**
 * Start tracking driver location. Call when driver has active deliveries.
 * @param orderId - The current active order ID (optional, for client tracking)
 */
export async function startDriverTracking(orderId?: string): Promise<boolean> {
  if (watchId) {
    // Already tracking, just update order ID
    currentOrderId = orderId || null;
    return true;
  }

  currentOrderId = orderId || null;
  return requestAndWatch();
}

/**
 * Update the order ID being tracked (when driver picks up a new order).
 */
export function updateTrackingOrderId(orderId: string | null) {
  currentOrderId = orderId;
}

/**
 * Stop tracking driver location. Call when no more active deliveries.
 */
export async function stopDriverTracking() {
  if (watchId) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      await Geolocation.clearWatch({ id: watchId });
    } catch { /* noop */ }
    watchId = null;
  }

  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }

  currentOrderId = null;
  lastPosition = null;
  console.log("[GeoTrack] 🛑 Tracking stopped");
}

/**
 * Check if tracking is currently active.
 */
export function isTracking(): boolean {
  return watchId !== null;
}

/**
 * Clean up driver location from DB when going offline.
 */
export async function clearDriverLocation() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  await supabase
    .from("driver_locations" as any)
    .delete()
    .eq("driver_user_id", session.user.id);
}
