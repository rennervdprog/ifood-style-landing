import { supabase } from "@/integrations/supabase/client";

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
    lat?: number | null; lng?: number | null;
    cep?: string | null; street?: string | null; number?: string | null;
    neighborhood?: string | null; city?: string | null; state?: string | null;
  };
}

/**
 * Fonte única de verdade para distância (km de rota real via OSRM, com cache no banco).
 * Hierarquia de precisão: GPS > endereço completo > CEP.
 */
export async function resolveDistance(input: ResolveDistanceInput): Promise<DistanceResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("calculate-delivery-distance", { body: input });
    if (error || !data) return null;
    return data as DistanceResult;
  } catch {
    return null;
  }
}