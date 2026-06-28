/**
 * Distância entre dois pontos. Re-exporta a edge `calculate-delivery-distance`
 * (OSRM real, com cache no banco) e mantém o haversine local como fallback.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Coordinates } from "./types";

export type DistanceAccuracy = "gps" | "address" | "cep" | "cache" | "unknown";
export type RouteSource = "osrm" | "osrm_cache" | "haversine";

export interface DistanceResult {
  ok: boolean;
  distanceKm: number | null;
  durationMin: number | null;
  accuracy: DistanceAccuracy;
  routeSource: RouteSource | null;
  warning: string | null;
}

export interface ResolveDistanceInput {
  store: { lat?: number | null; lng?: number | null; cep?: string | null };
  customer: {
    lat?: number | null;
    lng?: number | null;
    cep?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
  };
}

export async function resolveDistance(
  input: ResolveDistanceInput,
): Promise<DistanceResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "calculate-delivery-distance",
      { body: input },
    );
    if (error || !data) return null;
    return data as DistanceResult;
  } catch {
    return null;
  }
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function isValidCoordinate(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}
