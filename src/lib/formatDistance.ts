/**
 * Formata distância em km para exibição estilo iFood/99/Rappi.
 * < 1 km  → "900 m"
 * < 10 km → "1,2 km"
 * ≥ 10 km → "12 km"
 */
export function formatDistanceKm(km: number | null | undefined): string | null {
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const m = Math.round(km * 1000 / 10) * 10;
    return `${m} m`;
  }
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}