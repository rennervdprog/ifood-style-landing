/**
 * Sistema antifraude de localização.
 * Bloqueia pedidos quando o cliente (GPS) está muito distante da loja.
 */
import { supabase } from "@/integrations/supabase/client";
import { readGps, haversineMeters, type Coordinates } from "@/lib/location";

export const DEFAULT_MAX_DISTANCE_KM = 15;
/** @deprecated use store.max_delivery_km ou DEFAULT_MAX_DISTANCE_KM */
export const MAX_DISTANCE_KM = DEFAULT_MAX_DISTANCE_KM;

export interface FraudCheckParams {
  storeId: string;
  storeName?: string | null;
  storeCity?: string | null;
  storeLat?: number | null;
  storeLng?: number | null;
  deliveryCity?: string | null;
  deliveryCoords?: Coordinates | null;
  maxDeliveryKm?: number | null;
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
  const { storeLat, storeLng, storeCity, deliveryCity, deliveryCoords, maxDeliveryKm } = params;
  const maxKm = Number(maxDeliveryKm ?? DEFAULT_MAX_DISTANCE_KM) || DEFAULT_MAX_DISTANCE_KM;

  // Bloqueio por abuso: >3 tentativas bloqueadas em 1h para este usuário
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("fraud_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("blocked", true).gte("created_at", since);
      if ((count ?? 0) >= 3) {
        const result: FraudCheckResult = { allowed: false, distanceKm: null, reason: "rate_limited:too_many_blocked_attempts", clientCoords: null };
        await logAttempt(params, result);
        return result;
      }
    }
  } catch {}

  if (typeof storeLat !== "number" || typeof storeLng !== "number") {
    // fail-open só quando cidade bate; se sem cidade também, bloquear
    if (!deliveryCity || !storeCity || normCity(deliveryCity) === normCity(storeCity)) {
      const result: FraudCheckResult = { allowed: true, distanceKm: null, reason: "fail_open:store_coords_missing", clientCoords: null };
      await logAttempt(params, result);
      return result;
    }
    const result: FraudCheckResult = { allowed: false, distanceKm: null, reason: "fail_closed:no_store_coords_and_city_mismatch", clientCoords: null };
    await logAttempt(params, result);
    return result;
  }

  // 1. Tentar obter coordenadas: prioridade = deliveryCoords (endereço geocodificado) > GPS
  const clientCoords = deliveryCoords || (await readGps()).coords;

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
    // fail-closed: sem GPS E sem deliveryCity → bloquear
    if (!deliveryCity) {
      const result: FraudCheckResult = { allowed: false, distanceKm: null, reason: "fail_closed:no_gps_and_no_city", clientCoords: null };
      await logAttempt(params, result);
      return result;
    }
    const result: FraudCheckResult = { allowed: true, distanceKm: null, reason: "fail_open:city_ok_no_coords", clientCoords: null };
    await logAttempt(params, result);
    return result;
  }

  const distanceKm = haversineMeters(clientCoords, { lat: storeLat, lng: storeLng }) / 1000;

  let reason: string | null = null;
  let allowed = true;

  // 4. Validação por distância GPS (limite por loja)
  if (distanceKm > maxKm) {
    allowed = false;
    reason = `distance_exceeded:${distanceKm.toFixed(1)}km>max${maxKm}km`;
  }

  const result: FraudCheckResult = { allowed, distanceKm, reason, clientCoords };

  if (!allowed) {
    await logAttempt(params, result);
  }

  return result;
}
