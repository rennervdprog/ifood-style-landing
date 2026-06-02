import { fetchCep } from "@/lib/cepLookup";

export interface AddressContext {
  street?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalcode?: string | null;
  country?: string | null;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const DEFAULT_COUNTRY = "Brazil";
const COUNTRY_CODE = "br";

function toNumber(value: unknown): number | null {
  const num = typeof value === "string" ? Number.parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildFreeformQueries(address: AddressContext): string[] {
  const street = normalizeText(address.street);
  const neighborhood = normalizeText(address.neighborhood);
  const city = normalizeText(address.city);
  const state = normalizeText(address.state);
  const postalcode = normalizeText(address.postalcode)?.replace(/\D/g, "");
  const country = normalizeText(address.country) || DEFAULT_COUNTRY;

  const variants = [
    [street, neighborhood, city, state, postalcode, country],
    [street, city, state, postalcode, country],
    [street, neighborhood, city, state, country],
    [street, city, state, country],
  ];

  return variants
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

async function requestNominatim(params: URLSearchParams): Promise<Coordinates | null> {
  try {
    const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) return null;

    const result = await response.json();
    const lat = toNumber(result?.[0]?.lat);
    const lng = toNumber(result?.[0]?.lon);

    if (lat === null || lng === null) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function resolveAddressContext(address: AddressContext): Promise<AddressContext> {
  const context: AddressContext = {
    street: normalizeText(address.street),
    neighborhood: normalizeText(address.neighborhood),
    city: normalizeText(address.city),
    state: normalizeText(address.state),
    postalcode: normalizeText(address.postalcode)?.replace(/\D/g, ""),
    country: normalizeText(address.country) || DEFAULT_COUNTRY,
  };

  if (context.postalcode && (!context.city || !context.state)) {
    const cepData = await fetchCep(context.postalcode);
    if (cepData) {
      context.city = context.city || normalizeText(cepData.localidade);
      context.state = context.state || normalizeText(cepData.uf);
      context.neighborhood = context.neighborhood || normalizeText(cepData.bairro);
    }
  }

  return context;
}

/**
 * Extract house number from a street string.
 * Handles both "Rua X, 123" and "Rua X 123" patterns common in Brazilian addresses.
 * Nominatim expects format: "<housenumber> <streetname>" in the street param.
 */
function extractHouseNumber(street: string): { name: string; number: string | null } {
  // Pattern: "Rua Das Flores, 123" or "Rua Das Flores 123" (number at end)
  const trailingMatch = street.match(/^(.+?)[,\s]+(\d{1,6})\s*$/);
  if (trailingMatch) {
    return { name: trailingMatch[1].trim(), number: trailingMatch[2] };
  }
  // Pattern: "123 Rua Das Flores" (number at start, already correct for Nominatim)
  const leadingMatch = street.match(/^(\d{1,6})\s+(.+)$/);
  if (leadingMatch) {
    return { name: leadingMatch[2].trim(), number: leadingMatch[1] };
  }
  return { name: street, number: null };
}

export async function geocodeAddressPrecise(address: AddressContext): Promise<Coordinates | null> {
  const context = await resolveAddressContext(address);

  const structured = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    addressdetails: "0",
    countrycodes: COUNTRY_CODE,
  });

  // Nominatim structured search expects street as "<housenumber> <streetname>"
  if (context.street) {
    const { name, number } = extractHouseNumber(context.street);
    structured.set("street", number ? `${number} ${name}` : name);
  }
  if (context.city) structured.set("city", context.city);
  if (context.state) structured.set("state", context.state);
  if (context.postalcode) structured.set("postalcode", context.postalcode);
  structured.set("country", context.country || DEFAULT_COUNTRY);

  const structuredResult = await requestNominatim(structured);
  if (structuredResult) return structuredResult;

  for (const query of buildFreeformQueries(context)) {
    const freeform = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      addressdetails: "0",
      countrycodes: COUNTRY_CODE,
    });
    const result = await requestNominatim(freeform);
    if (result) return result;
  }

  return null;
}

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371e3;
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function isValidCoordinate(lat?: number | null, lng?: number | null): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
}

export interface ReverseGeocodeResult {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
  display: string;
}

/**
 * Reverse geocode GPS coordinates into a Brazilian street address using Nominatim (free).
 * Used to show the customer's real current address when GPS is active.
 */
export async function reverseGeocode(coords: Coordinates): Promise<ReverseGeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(coords.lat),
      lon: String(coords.lng),
      addressdetails: "1",
      zoom: "18",
    });
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
      headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const addr = data?.address || {};
    const street = addr.road || addr.pedestrian || addr.residential || addr.street;
    const number = addr.house_number;
    const neighborhood = addr.suburb || addr.neighbourhood || addr.city_district;
    const city = addr.city || addr.town || addr.village || addr.municipality;
    const state = addr.state;
    const postcode = (addr.postcode || "").toString();
    const displayParts = [
      street ? (number ? `${street}, ${number}` : street) : null,
      neighborhood,
      city,
    ].filter(Boolean);
    return {
      street,
      number,
      neighborhood,
      city,
      state,
      postcode,
      display: displayParts.join(" - ") || data?.display_name || "",
    };
  } catch {
    return null;
  }
}
