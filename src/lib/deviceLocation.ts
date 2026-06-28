/**
 * @deprecated Use `@/lib/location` (resolveAddress / readGps / requestLocationPermission).
 * Mantido como shim com a mesma API pública.
 */
import { geocodeAddress, getDeviceGPS } from "@/lib/location";
import type { AddressContext, Coordinates } from "@/lib/location";

export { getDeviceGPS };

export async function getBestClientCoordinates(address: AddressContext): Promise<Coordinates | null> {
  const gps = await getDeviceGPS();
  if (gps) return gps;
  return geocodeAddress(address);
}