import { fetchCep } from "./cepLookup";

export interface DeliveryFeeConfig {
  city_name: string;
  city_fee: number;
  rural_base_fee: number;
  rural_per_km: number;
}

export const DEFAULT_DELIVERY_FEE_CONFIG: DeliveryFeeConfig = {
  city_name: "Itatinga",
  city_fee: 5.0,
  rural_base_fee: 5.0,
  rural_per_km: 0.6,
};

// Centro de Itatinga - coordenadas fixas de referência
const ITATINGA_CENTER = { lat: -23.1389, lng: -48.6158 };

// Raio em km do centro urbano de Itatinga - dentro = taxa fixa, fora = cálculo por km
const URBAN_RADIUS_KM = 3;

// Haversine formula to calculate distance between two lat/lng points in km
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
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
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.location?.coordinates?.longitude && data.location?.coordinates?.latitude) {
      return {
        lat: data.location.coordinates.latitude,
        lng: data.location.coordinates.longitude,
      };
    }
    // BrasilAPI didn't return coordinates, try geocoding by city name
    if (data.city) {
      return geocodeByCity(data.city, data.state || "SP");
    }
    return null;
  } catch {
    return null;
  }
}

// Fallback geocoding using Nominatim (OpenStreetMap) by city name
async function geocodeByCity(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${city}, ${state}, Brazil`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { "User-Agent": "LovableDeliveryApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0 && data[0].lat && data[0].lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isDistrictNeighborhood(bairro: string | undefined): boolean {
  if (!bairro) return false;
  return /\(.+\)/.test(bairro);
}

export interface DeliveryFeeResult {
  fee: number;
  isRural: boolean;
  distanceKm: number | null;
  breakdown: string;
}

/**
 * Calculate delivery fee based on distance from Itatinga center.
 * - Within URBAN_RADIUS_KM of center AND same city AND not a district = fixed city fee
 * - Outside radius, district, or different city = base fee + per-km from store
 */
export async function calculateDeliveryFee(
  customerCep: string,
  storeCep: string,
  config: DeliveryFeeConfig
): Promise<DeliveryFeeResult> {
  const [customerAddr, _storeAddr] = await Promise.all([
    fetchCep(customerCep),
    fetchCep(storeCep),
  ]);

  if (!customerAddr) {
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

  // Try to get customer coordinates
  const customerCoords = await geocodeCep(customerCep);

  // If we have coordinates, use radius from Itatinga center
  if (customerCoords) {
    const distFromCenter = haversineDistance(
      ITATINGA_CENTER.lat, ITATINGA_CENTER.lng,
      customerCoords.lat, customerCoords.lng
    );

    // Within urban radius AND same city AND not a district = fixed fee
    if (isInCity && !isDistrict && distFromCenter <= URBAN_RADIUS_KM) {
      return {
        fee: config.city_fee,
        isRural: false,
        distanceKm: Math.round(distFromCenter * 10) / 10,
        breakdown: `Centro ${config.city_name} (${distFromCenter.toFixed(1)}km do centro): R$ ${config.city_fee.toFixed(2)}`,
      };
    }

    // Outside urban radius or district or different city = distance-based fee
    // Use distance from store (or center as fallback) to customer
    let storeCoords = await geocodeCep(storeCep);
    const referencePoint = storeCoords || ITATINGA_CENTER;
    const referenceLabel = storeCoords ? "loja" : "centro";

    const distanceKm = haversineDistance(
      referencePoint.lat, referencePoint.lng,
      customerCoords.lat, customerCoords.lng
    );

    const roundedDistance = Math.max(1, Math.ceil(distanceKm));
    const fee = config.rural_base_fee + config.rural_per_km * roundedDistance;
    const roundedFee = Math.round(fee * 100) / 100;

    const label = isDistrict
      ? `Distrito ${customerAddr.bairro}`
      : customerAddr.localidade || "zona rural";

    return {
      fee: roundedFee,
      isRural: true,
      distanceKm: roundedDistance,
      breakdown: `${label} (${roundedDistance}km da ${referenceLabel}): R$ ${config.rural_base_fee.toFixed(2)} + ${roundedDistance}km × R$ ${config.rural_per_km.toFixed(2)} = R$ ${roundedFee.toFixed(2)}`,
    };
  }

  // No coordinates available - fallback logic
  if (isInCity && !isDistrict) {
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa cidade (${config.city_name}): R$ ${config.city_fee.toFixed(2)}`,
    };
  }

  // District or rural without coordinates - estimate
  const estimatedKm = isDistrict ? 15 : 10;
  const estimatedFee = config.rural_base_fee + config.rural_per_km * estimatedKm;
  return {
    fee: Math.round(estimatedFee * 100) / 100,
    isRural: true,
    distanceKm: null,
    breakdown: `Taxa rural: R$ ${config.rural_base_fee.toFixed(2)} + ~${estimatedKm}km estimado`,
  };
}
