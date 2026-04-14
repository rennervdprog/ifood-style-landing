/**
 * Device GPS location helper.
 * Uses Capacitor Geolocation on native, browser Geolocation API on web.
 * Falls back to Nominatim geocoding if GPS is unavailable.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { geocodeAddressPrecise, type AddressContext, type Coordinates } from "@/lib/addressGeocoding";

/**
 * Try to get the device's current GPS position.
 * Returns null if permission denied or unavailable.
 */
export async function getDeviceGPS(): Promise<Coordinates | null> {
  try {
    if (isCapacitorNative()) {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Request permission (will show native dialog)
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        console.warn("[DeviceGPS] Permission denied");
        return null;
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });

      console.log(`[DeviceGPS] Capacitor GPS: ${pos.coords.latitude}, ${pos.coords.longitude} (±${pos.coords.accuracy}m)`);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }

    // Web fallback
    if ("geolocation" in navigator) {
      return await new Promise<Coordinates | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log(`[DeviceGPS] Browser GPS: ${pos.coords.latitude}, ${pos.coords.longitude}`);
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.warn("[DeviceGPS] Browser GPS error:", err.message);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
      });
    }

    return null;
  } catch (e) {
    console.warn("[DeviceGPS] Failed:", e);
    return null;
  }
}

/**
 * Get the best available coordinates for the client:
 * 1. Try device GPS first (most accurate)
 * 2. Fall back to Nominatim geocoding from address
 */
export async function getBestClientCoordinates(address: AddressContext): Promise<Coordinates | null> {
  // Try GPS first
  const gps = await getDeviceGPS();
  if (gps) return gps;

  // Fall back to address geocoding
  return geocodeAddressPrecise(address);
}
