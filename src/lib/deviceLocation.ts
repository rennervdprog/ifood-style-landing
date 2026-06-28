/**
 * @deprecated Use `@/lib/location` (resolveAddress / readGps / requestLocationPermission).
 * Mantido como shim com a mesma API pública.
 */
import { geocodeAddress } from "@/lib/location";
import { getDeviceGPS } from "@/lib/location/gps";
import type { AddressContext, Coordinates } from "@/lib/location";

export { getDeviceGPS };

/**
 * Compat: tenta GPS primeiro, depois geocode do endereço.
 */
export async function getBestClientCoordinates(address: AddressContext): Promise<Coordinates | null> {
  const gps = await getDeviceGPS();
  if (gps) return gps;
  return geocodeAddress(address);
}

/** Open the device's location settings (native only) */
async function openLocationSettings() {
  if (!isCapacitorNative()) return;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import(
      "capacitor-native-settings"
    );
    await NativeSettings.open({
      optionAndroid: AndroidSettings.Location,
      optionIOS: IOSSettings.LocationServices,
    });
  } catch {
    // Plugin not installed — try App.openUrl as fallback for Android
    try {
      const { App } = await import("@capacitor/app");
      // Generic intent to open location settings on Android
      await (App as any).openUrl?.({ url: "android.settings.LOCATION_SOURCE_SETTINGS" });
    } catch {
      // Ignore — user will have to open settings manually
    }
  }
}

/** Show a toast asking user to enable GPS, with a button to open settings */
function promptEnableGPS() {
  toast.error("GPS desativado", {
    description: "Ative a localização nas configurações do celular para melhorar a precisão da entrega.",
    duration: 8000,
    action: isCapacitorNative()
      ? {
          label: "Abrir Config.",
          onClick: () => openLocationSettings(),
        }
      : undefined,
  });
}

/**
 * Try to get the device's current GPS position.
 * Returns null if permission denied or unavailable.
 * Shows user-friendly prompt when location services are disabled.
 */
export async function getDeviceGPS(): Promise<Coordinates | null> {
  try {
    if (isCapacitorNative()) {
      const { Geolocation } = await import("@capacitor/geolocation");

      // Check current permission status
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location === "denied") {
          console.info("[DeviceGPS] Location permission denied by user");
          toast.error("Permissão de localização negada. Ative nas configurações do app.", {
            duration: 6000,
            action: {
              label: "Abrir Config.",
              onClick: () => openLocationSettings(),
            },
          });
          return null;
        }
      } catch {
        // checkPermissions may fail if services disabled
      }

      // Request permission
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          console.info("[DeviceGPS] Permission not granted");
          toast.error("Permissão de localização necessária para entrega precisa.", {
            duration: 6000,
          });
          return null;
        }
      } catch (permErr: any) {
        const msg = String(permErr?.code || permErr?.message || "");
        if (msg.includes("0007") || msg.includes("not enabled")) {
          console.info("[DeviceGPS] Location services disabled on device");
          promptEnableGPS();
        } else {
          console.info("[DeviceGPS] Permission request failed:", msg);
          promptEnableGPS();
        }
        return null;
      }

      // Get position
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
          console.info("[DeviceGPS] Location services disabled");
          promptEnableGPS();
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
            if (err.code === err.PERMISSION_DENIED) {
              toast.error("Permissão de localização negada. Ative no navegador.", { duration: 6000 });
            }
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
  const gps = await getDeviceGPS();
  if (gps) return gps;

  return geocodeAddressPrecise(address);
}
