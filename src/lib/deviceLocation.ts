/**
 * Device GPS location helper.
 * Uses Capacitor Geolocation on native, browser Geolocation API on web.
 * Falls back to Nominatim geocoding if GPS is unavailable.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { geocodeAddressPrecise, type AddressContext, type Coordinates } from "@/lib/addressGeocoding";

/**
 * Try to get the device's current GPS position.
 * Returns null if permission denied, location services disabled, or unavailable.
 */
export async function getDeviceGPS(): Promise<Coordinates | null> {
  try {
    if (isCapacitorNative()) {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Check if location services are enabled first
      try {
        const perm = await Geolocation.checkPermissions();
        // If denied, try requesting
        if (perm.location === "denied") {
          console.info("[DeviceGPS] Location permission denied by user");
          return null;
        }
      } catch {
        // checkPermissions may fail if services disabled — that's OK
      }

      // Request permission (will show native dialog)
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          console.info("[DeviceGPS] Permission not granted");
          return null;
        }
      } catch (permErr: any) {
        // OS-PLUG-GLOC-0007 = Location services disabled on device
        const code = permErr?.code || permErr?.message || "";
        if (String(code).includes("0007") || String(permErr?.message).includes("not enabled")) {
          console.info("[DeviceGPS] Location services disabled on device — using address fallback");
        } else {
          console.info("[DeviceGPS] Permission request failed:", code);
        }
        return null;
      }

      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10_000,
        });
        console.log(`[DeviceGPS] Capacitor GPS: ${pos.coords.latitude}, ${pos.coords.longitude} (±${pos.coords.accuracy}m)`);
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (posErr: any) {
        const code = String(posErr?.code || posErr?.message || "");
        if (code.includes("0007") || code.includes("not enabled")) {
          console.info("[DeviceGPS] Location services disabled — using address fallback");
        } else {
          console.info("[DeviceGPS] Could not get position:", code);
        }
        return null;
      }
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
            console.info("[DeviceGPS] Browser GPS unavailable:", err.message);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
      });
    }

    return null;
  } catch (e) {
    console.info("[DeviceGPS] GPS unavailable, will use address fallback");
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
