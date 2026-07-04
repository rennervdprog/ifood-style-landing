/**
 * API pública do módulo unificado de localização.
 *
 * Toda nova tela deve importar daqui:
 *   import { resolveAddress, readGps, fetchCep, reverseGeocode, geocodeAddress,
 *            checkLocationPermission, requestLocationPermission } from "@/lib/location";
 *
 * Os módulos antigos (deviceLocation, addressGeocoding, cepLookup, deliveryDistance,
 * useUserLocation) continuam funcionando como shims durante a migração.
 */
export * from "./types";
export { fetchCep, formatCep } from "./cep";
export type { CepResult } from "./cep";
export { geocodeAddress } from "./geocode";
export { reverseGeocode } from "./reverse";
export type { ReverseResult } from "./reverse";
export { readGps, getDeviceGPS, readGpsFromGesture } from "./gps";
export type { GpsReadResult } from "./gps";
export {
  checkLocationPermission,
  requestLocationPermission,
  openNativeLocationSettings,
  openAppSettings,
} from "./permissions";
export {
  resolveDistance,
  haversineMeters,
  isValidCoordinate,
} from "./distance";
export type {
  DistanceResult,
  DistanceAccuracy,
  RouteSource,
  ResolveDistanceInput,
} from "./distance";
export { resolveAddress } from "./resolve";
export type { ResolveMode, ResolveOptions } from "./resolve";
export { cacheClear } from "./cache";
