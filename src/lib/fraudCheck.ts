/**
 * Sistema antifraude de localização.
 * Bloqueia pedidos quando o cliente (GPS) está muito distante da loja.
 */
import { supabase } from "@/integrations/supabase/client";
import { getDeviceGPS } from "@/lib/deviceLocation";
import { haversineDistanceMeters, type Coordinates } from "@/lib/addressGeocoding";

export const MAX_DISTANCE_KM = 50;

export interface FraudCheckParams {
  storeId: string;
  storeName?: string | null;
  storeCity?: string | null;
  storeLat?: number | null;
  storeLng?: number | null;
  deliveryCity?: string | null;
  deliveryCoords?: Coordinates | null;
}

export interface FraudCheckResult {
  allowed: boolean;
  distanceKm: number | null;
  reason: string | null;
  clientCoords: Coordinates | null;
}

function normCity(v?: string | null) {
  return (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function logAttempt(params: FraudCheckParams, result: FraudCheckResult) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("fraud_attempts").insert({
      user_id: user?.id ?? null,
      store_id: params.storeId,
      store_name: params.storeName ?? null,
      store_city: params.storeCity ?? null,
      client_lat: result.clientCoords?.lat ?? null,
      client_lng: result.clientCoords?.lng ?? null,
      store_lat: params.storeLat ?? null,
      store_lng: params.storeLng ?? null,
      distance_km: result.distanceKm,
      delivery_city: params.deliveryCity ?? null,
      reason: result.reason || "blocked",
      blocked: !result.allowed,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    console.warn("[FraudCheck] log failed", e);
  }
}

/**
 * Valida se o cliente pode interagir com a loja com base na distância.
 * Retorna allowed=true quando não há dados suficientes (fail-open).
 */
export async function checkStoreAccess(params: FraudCheckParams): Promise<FraudCheckResult> {
  const { storeLat, storeLng, storeCity, deliveryCity, deliveryCoords } = params;

  if (typeof storeLat !== "number" || typeof storeLng !== "number") {
    const result: FraudCheckResult = { allowed: true, distanceKm: null, reason: "fail_open:store_coords_missing", clientCoords: null };
    await logAttempt(params, result);
    return result;
  }

  // 1. Tentar obter coordenadas: prioridade = deliveryCoords (endereço geocodificado) > GPS
  const clientCoords = deliveryCoords || (await getDeviceGPS());

  // 2. Validação por cidade — funciona SEM GPS
  // Se o endereço de entrega é em cidade diferente da loja → bloquear diretamente
  if (deliveryCity && storeCity && normCity(deliveryCity) !== normCity(storeCity)) {
    const result: FraudCheckResult = {
      allowed: false,
      distanceKm: null,
      reason: `delivery_city_mismatch:${normCity(deliveryCity)}≠${normCity(storeCity)}`,
      clientCoords,
    };
    await logAttempt(params, result);
    return result;
  }

  // 3. Sem coordenadas e cidade OK → permitir (não há dados suficientes para bloquear)
  if (!clientCoords) {
    const result: FraudCheckResult = { allowed: true, distanceKm: null, reason: "fail_open:no_client_coords", clientCoords: null };
    await logAttempt(params, result);
    return result;
  }

  const distanceKm = haversineDistanceMeters(clientCoords, { lat: storeLat, lng: storeLng }) / 1000;

  let reason: string | null = null;
  let allowed = true;

  // 4. Validação por distância GPS
  if (distanceKm > MAX_DISTANCE_KM) {
    allowed = false;
    reason = `distance_exceeded:${distanceKm.toFixed(1)}km`;
  }

  const result: FraudCheckResult = { allowed, distanceKm, reason, clientCoords };

  if (!allowed) {
    await logAttempt(params, result);
  }

  return result;
}
