import { fetchCep } from "./cepLookup";

export interface DeliveryFeeConfig {
  city_name: string; // e.g. "Itatinga"
  city_fee: number; // fixed fee for in-city (e.g. 5.00)
  rural_base_fee: number; // fixed base for out-of-city (e.g. 5.00)
  rural_per_km: number; // per km rate for out-of-city (e.g. 0.60)
}

export const DEFAULT_DELIVERY_FEE_CONFIG: DeliveryFeeConfig = {
  city_name: "Itatinga",
  city_fee: 5.0,
  rural_base_fee: 5.0,
  rural_per_km: 0.6,
};

// Haversine formula to calculate distance between two lat/lng points in km
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geocode a CEP using BrasilAPI (returns lat/lng)
async function geocodeCep(cep: string): Promise<{ lat: number; lng: number } | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    // Try BrasilAPI v2 which includes coordinates
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.location?.coordinates?.longitude && data.location?.coordinates?.latitude) {
      return {
        lat: data.location.coordinates.latitude,
        lng: data.location.coordinates.longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface DeliveryFeeResult {
  fee: number;
  isRural: boolean;
  distanceKm: number | null;
  breakdown: string;
}

/**
 * Calculate delivery fee based on customer CEP vs store CEP
 */
export async function calculateDeliveryFee(
  customerCep: string,
  storeCep: string,
  config: DeliveryFeeConfig
): Promise<DeliveryFeeResult> {
  // First check if customer is in the same city
  const customerAddr = await fetchCep(customerCep);
  
  if (!customerAddr) {
    // CEP not found, use city fee as fallback
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa fixa: R$ ${config.city_fee.toFixed(2)}`,
    };
  }

  const isInCity = customerAddr.localidade?.toLowerCase() === config.city_name.toLowerCase();

  if (isInCity) {
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa cidade (${config.city_name}): R$ ${config.city_fee.toFixed(2)}`,
    };
  }

  // Out of city - calculate distance
  const [storeCoords, customerCoords] = await Promise.all([
    geocodeCep(storeCep),
    geocodeCep(customerCep),
  ]);

  if (!storeCoords || !customerCoords) {
    // Can't calculate distance, use base rural fee + estimate
    return {
      fee: config.rural_base_fee + config.rural_per_km * 10, // fallback 10km estimate
      isRural: true,
      distanceKm: null,
      breakdown: `Taxa rural: R$ ${config.rural_base_fee.toFixed(2)} + distância estimada`,
    };
  }

  const distanceKm = haversineDistance(
    storeCoords.lat, storeCoords.lng,
    customerCoords.lat, customerCoords.lng
  );

  const roundedDistance = Math.ceil(distanceKm); // Round up
  const fee = config.rural_base_fee + config.rural_per_km * roundedDistance;
  const roundedFee = Math.round(fee * 100) / 100;

  return {
    fee: roundedFee,
    isRural: true,
    distanceKm: roundedDistance,
    breakdown: `R$ ${config.rural_base_fee.toFixed(2)} + ${roundedDistance}km × R$ ${config.rural_per_km.toFixed(2)} = R$ ${roundedFee.toFixed(2)}`,
  };
}
