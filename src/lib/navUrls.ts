/**
 * Builds Waze and Google Maps deep-link URLs.
 *
 * Why this exists: Waze's `q=<text>` parameter does its OWN geocoding, which
 * is often imprecise for short Brazilian street addresses (e.g. "Rua X, 123 -
 * Centro") and frequently lands on the wrong block — or even wrong city.
 *
 * Whenever we already have the precise client GPS (`client_lat` / `client_lng`
 * from the order), we MUST send coordinates to Waze using `ll=lat,lng`.
 * That bypasses Waze's geocoder and points exactly at the saved location.
 *
 * For the fallback text query, we build the most complete address possible
 * (street + number + neighborhood + city + state + CEP) so that whichever
 * geocoder runs (Waze or Google) has the best chance of nailing it.
 */

export interface NavTarget {
  lat?: number | null;
  lng?: number | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  /** Already-formatted address (used as fallback when individual parts aren't available) */
  fallbackAddress?: string | null;
}

function isValidCoord(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) > 0.0001 &&
    Math.abs(lng) > 0.0001
  );
}

/** Build the richest possible textual address from individual parts. */
export function buildFullAddress(t: NavTarget): string {
  const streetLine = [t.street, t.number].filter(Boolean).join(", ");
  const parts = [
    streetLine || null,
    t.neighborhood || null,
    t.city || null,
    t.state || null,
    t.cep ? `CEP ${t.cep}` : null,
    "Brasil",
  ].filter(Boolean);
  const composed = parts.join(", ");
  // Prefer composed when we actually have a street; otherwise fall back to
  // the pre-formatted address (e.g. legacy `address_details`) plus city/state.
  if (streetLine) return composed;
  if (t.fallbackAddress) {
    return [t.fallbackAddress, t.neighborhood, t.city || null, t.state || null, "Brasil"]
      .filter(Boolean)
      .join(", ");
  }
  return composed;
}

/** Waze deep link — prefers `ll=` GPS, falls back to `q=` text. */
export function buildWazeUrl(t: NavTarget): string {
  if (isValidCoord(t.lat, t.lng)) {
    // ll=lat,lng forces Waze to use the exact coordinate (no re-geocoding)
    return `https://waze.com/ul?ll=${t.lat},${t.lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(buildFullAddress(t))}&navigate=yes`;
}

/** Google Maps deep link — prefers GPS, falls back to text query. */
export function buildGoogleMapsUrl(t: NavTarget): string {
  if (isValidCoord(t.lat, t.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildFullAddress(t))}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Fase 3 — Multi-parada (rota completa via deep link)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Constrói a URL do Google Maps com até 9 paradas intermediárias (limite
 * do deep link `dir`).
 *
 * - O primeiro alvo da lista vira o `destination`; os demais vão para
 *   `waypoints` na ordem fornecida (otimização já feita pelo nosso 2-opt).
 * - Se houver `origin` (a loja), ele entra como ponto de partida; caso
 *   contrário o Maps usa a localização atual do usuário.
 */
export function buildGoogleMapsMultiStopUrl(stops: NavTarget[], origin?: NavTarget): string {
  if (stops.length === 0) return "https://www.google.com/maps";
  // Maps aceita até 9 waypoints + 1 destination => no máximo 10 paradas
  const capped = stops.slice(0, 10);
  const fmt = (t: NavTarget) =>
    isValidCoord(t.lat, t.lng) ? `${t.lat},${t.lng}` : encodeURIComponent(buildFullAddress(t));

  const destination = fmt(capped[capped.length - 1]);
  const waypoints = capped
    .slice(0, -1)
    .map(fmt)
    .join("|");

  const params: string[] = [
    "api=1",
    "travelmode=driving",
    `destination=${destination}`,
  ];
  if (waypoints) params.push(`waypoints=${waypoints}`);
  if (origin && (isValidCoord(origin.lat, origin.lng) || origin.fallbackAddress || origin.street)) {
    params.push(`origin=${fmt(origin)}`);
  }

  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Preferência de navegador (Waze | Maps) — Fase 4
 * ────────────────────────────────────────────────────────────────────────── */

export type NavApp = "waze" | "google";
const PREF_KEY = "driver_nav_pref_v1";

export function getPreferredNavigator(): NavApp {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === "google" ? "google" : "waze";
  } catch {
    return "waze";
  }
}

export function setPreferredNavigator(app: NavApp) {
  try { localStorage.setItem(PREF_KEY, app); } catch { /* noop */ }
}

export function buildPreferredNavUrl(t: NavTarget, app?: NavApp): string {
  const choice = app ?? getPreferredNavigator();
  return choice === "google" ? buildGoogleMapsUrl(t) : buildWazeUrl(t);
}
