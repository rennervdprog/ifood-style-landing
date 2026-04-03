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

/**
 * Check if the neighborhood indicates a district (distrito) outside the urban center.
 * In Brazil, ViaCEP returns "Centro (Lobo)" for district locations — the part in parentheses
 * is the district name, meaning it's geographically separate from the main city.
 */
function isDistrictNeighborhood(bairro: string | undefined): boolean {
  if (!bairro) return false;
  // Pattern: "Something (DistrictName)" indicates a district
  return /\(.+\)/.test(bairro);
}

export interface DeliveryFeeResult {
  fee: number;
  isRural: boolean;
  distanceKm: number | null;
  breakdown: string;
}

/**
 * Calculate delivery fee based on customer CEP vs store CEP.
 * - Same city (Itatinga urban center) = fixed city fee
 * - Districts like "Centro (Lobo)" or different cities = base fee + per-km rate
 */
export async function calculateDeliveryFee(
  customerCep: string,
  storeCep: string,
  config: DeliveryFeeConfig
): Promise<DeliveryFeeResult> {
  // First check if customer is in the same city
  const [customerAddr, storeAddr] = await Promise.all([
    fetchCep(customerCep),
    fetchCep(storeCep),
  ]);
  
  if (!customerAddr) {
    // CEP not found, use city fee as fallback
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa fixa: R$ ${config.city_fee.toFixed(2)}`,
    };
  }

  const customerCity = customerAddr.localidade?.toLowerCase() || "";
  const configCity = config.city_name.toLowerCase();
  const isInCity = customerCity === configCity;
  const isDistrict = isDistrictNeighborhood(customerAddr.bairro);

  // Only charge city fee if same city AND not a district (districts are far away)
  if (isInCity && !isDistrict) {
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa cidade (${config.city_name}): R$ ${config.city_fee.toFixed(2)}`,
    };
  }

  // Out of city or district - calculate distance via coordinates
  const [storeCoords, customerCoords] = await Promise.all([
    geocodeCep(storeCep),
    geocodeCep(customerCep),
  ]);

  if (!storeCoords || !customerCoords) {
    // Can't calculate distance, use base rural fee + estimate
    const estimatedKm = isDistrict ? 15 : 10;
    const estimatedFee = config.rural_base_fee + config.rural_per_km * estimatedKm;
    return {
      fee: Math.round(estimatedFee * 100) / 100,
      isRural: true,
      distanceKm: null,
      breakdown: `Taxa rural: R$ ${config.rural_base_fee.toFixed(2)} + ~${estimatedKm}km estimado`,
    };
  }

  const distanceKm = haversineDistance(
    storeCoords.lat, storeCoords.lng,
    customerCoords.lat, customerCoords.lng
  );

  const roundedDistance = Math.max(1, Math.ceil(distanceKm)); // At least 1km
  const fee = config.rural_base_fee + config.rural_per_km * roundedDistance;
  const roundedFee = Math.round(fee * 100) / 100;

  const districtLabel = isDistrict
    ? `Distrito ${customerAddr.bairro}`
    : customerAddr.localidade || "zona rural";

  return {
    fee: roundedFee,
    isRural: true,
    distanceKm: roundedDistance,
    breakdown: `${districtLabel}: R$ ${config.rural_base_fee.toFixed(2)} + ${roundedDistance}km × R$ ${config.rural_per_km.toFixed(2)} = R$ ${roundedFee.toFixed(2)}`,
  };
}
