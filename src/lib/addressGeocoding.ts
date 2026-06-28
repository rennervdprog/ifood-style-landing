/**
 * @deprecated Use `@/lib/location` em vez deste módulo.
 * Shim com a mesma API pública.
 */
import {
  geocodeAddress,
  reverseGeocode as reverseGeocodeNew,
  haversineMeters,
  isValidCoordinate as isValidCoordinateNew,
} from "@/lib/location";
import type { AddressContext, Coordinates } from "@/lib/location";
import type { ReverseResult } from "@/lib/location/reverse";

export type { AddressContext, Coordinates };

export interface ReverseGeocodeResult {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
  display: string;
}

export async function resolveAddressContext(address: AddressContext): Promise<AddressContext> {
  // Apenas normaliza espaços; o geocode novo cuida do CEP lookup internamente.
  const trim = (v?: string | null) => v?.trim() || undefined;
  return {
    street: trim(address.street),
    number: trim(address.number),
    neighborhood: trim(address.neighborhood),
    city: trim(address.city),
    state: trim(address.state),
    postalcode: trim(address.postalcode)?.replace(/\D/g, ""),
    country: trim(address.country) || "Brazil",
  };
}

export async function geocodeAddressPrecise(address: AddressContext): Promise<Coordinates | null> {
  return geocodeAddress(address);
}

export async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult | null> {
  const r: ReverseResult | null = await reverseGeocodeNew(coords);
  if (!r) return null;
  return {
    street: r.street ?? undefined,
    number: r.number ?? undefined,
    neighborhood: r.neighborhood ?? undefined,
    city: r.city ?? undefined,
    state: r.state ?? undefined,
    postcode: r.postalcode ?? undefined,
    display: r.display,
  };
}

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  return haversineMeters(a, b);
}

export function isValidCoordinate(lat?: number | null, lng?: number | null): lat is number {
  return isValidCoordinateNew(lat, lng);
}