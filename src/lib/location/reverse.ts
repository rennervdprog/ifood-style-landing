/**
 * Coordenadas → endereço (Nominatim reverse) com cache de 24h.
 */
import { cacheGet, cacheSet, TTL } from "./cache";
import { nominatimQueue, NOMINATIM_HEADERS } from "./nominatim";
import type { AddressContext, Coordinates } from "./types";

const BASE = "https://nominatim.openstreetmap.org/reverse";

export interface ReverseResult extends AddressContext {
  display: string;
}

function keyOf(c: Coordinates): string {
  // arredonda em ~10m pra reuso do cache
  return `loc:rev:${c.lat.toFixed(4)}:${c.lng.toFixed(4)}`;
}

export async function reverseGeocode(coords: Coordinates): Promise<ReverseResult | null> {
  const key = keyOf(coords);
  const cached = cacheGet<ReverseResult | null>(key, { persist: true });
  if (cached !== null) return cached;

  const result = await nominatimQueue(async () => {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(coords.lat),
        lon: String(coords.lng),
        addressdetails: "1",
        zoom: "18",
      });
      const res = await fetch(`${BASE}?${params.toString()}`, { headers: NOMINATIM_HEADERS });
      if (!res.ok) return null;
      const data = await res.json();
      const a = data?.address || {};
      const street =
        a.road || a.pedestrian || a.residential || a.street || a.path || null;
      const number = a.house_number || null;
      const neighborhood = a.suburb || a.neighbourhood || a.city_district || null;
      const city = a.city || a.town || a.village || a.municipality || a.county || null;
      const state = a.state || null;
      const postalcode = (a.postcode || "").toString() || null;
      const out: ReverseResult = {
        street,
        number,
        neighborhood,
        city,
        state,
        postalcode,
        country: a.country || "Brasil",
        display:
          [
            street ? (number ? `${street}, ${number}` : street) : null,
            neighborhood,
            city,
          ]
            .filter(Boolean)
            .join(" - ") || data?.display_name || "",
      };
      return out;
    } catch {
      return null;
    }
  });

  cacheSet(key, result, result ? TTL.reverse : 60 * 60 * 1000, { persist: true });
  return result;
}
