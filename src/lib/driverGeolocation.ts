/**
 * Driver GPS tracking using Capacitor Geolocation.
 * Sends location updates to driver_locations table every 8s while active.
 * Works on both native (Capacitor) and web (browser Geolocation API).
 */
import { supabase } from "@/integrations/supabase/client";

let watchId: string | null = null;
let intervalId: number | null = null;
let currentOrderId: string | null = null;
let lastPosition: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number } | null = null;
let lastSentAt = 0;

const UPDATE_INTERVAL_MS = 8_000; // 8 seconds heartbeat
const MIN_DISTANCE_METERS = 5; // Send if moved > 5m (more precise)
const MIN_SEND_INTERVAL_MS = 3_000; // Don't send more often than 3s

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sendLocation(position: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }, force = false) {
  // Rate-limit sends unless forced
  const now = Date.now();
  if (!force && now - lastSentAt < MIN_SEND_INTERVAL_MS) return;

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
    lastSentAt = now;
    lastPosition = position;
    console.log(`[GeoTrack] 📍 ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} (acc: ${position.accuracy?.toFixed(0)}m, spd: ${position.speed?.toFixed(1)}m/s)`);
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

    // Get initial position immediately
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const initial = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed ?? undefined,
        heading: pos.coords.heading ?? undefined,
      };
      await sendLocation(initial, true);
    } catch (e) {
      console.warn("[GeoTrack] Initial position failed:", e);
    }

    // Watch position changes — send on every meaningful movement
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

        // Always send if no previous position, or if moved significantly
        if (lastPosition) {
          const dist = haversineDistance(lastPosition.lat, lastPosition.lng, newPos.lat, newPos.lng);
          if (dist < MIN_DISTANCE_METERS) return;
        }

        sendLocation(newPos);
      }
    );

    watchId = id;

    // Heartbeat: send periodic updates even if standing still
    intervalId = window.setInterval(async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
        await sendLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ?? undefined,
          heading: pos.coords.heading ?? undefined,
        }, true); // Force send on heartbeat
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
    if (orderId) currentOrderId = orderId;
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
  // Force an immediate location update with the new order ID
  if (lastPosition && orderId) {
    sendLocation(lastPosition, true);
  }
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
  lastSentAt = 0;
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
