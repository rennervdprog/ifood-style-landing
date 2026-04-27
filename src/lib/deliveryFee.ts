 export interface StoreDeliveryConfig {
   delivery_fee_type: 'fixed' | 'km';
   delivery_base_km: number;
   delivery_fee_base: number;
   delivery_fee_per_km: number;
   own_delivery_fee: number;
   customer_street?: string | null;
   customer_number?: string | null;
   customer_coords?: { lat: number; lng: number } | null;
 }
 
 /**
  * Calculate delivery fee for a store that manages its own delivery.
  */
 export async function calculateStoreOwnDeliveryFee(
   customerCep: string,
   storeCep: string,
   config: StoreDeliveryConfig
 ): Promise<DeliveryFeeResult> {
   if (config.delivery_fee_type === 'fixed') {
     return {
       fee: config.own_delivery_fee,
       isRural: false,
       distanceKm: null,
       breakdown: `Taxa fixa: ${formatBRL(config.own_delivery_fee)}`,
     };
   }
 
   // KM based fee
   // Use provided coordinates (GPS) or fall back to geocoding address
   const customerCoords = config.customer_coords || await geocodeAddress(customerCep, config.customer_street || undefined, config.customer_number || undefined);
   const storeCoords = storeCep ? await geocodeAddress(storeCep) : ITATINGA_CENTER;
 
   if (!customerCoords) {
     return {
       fee: config.delivery_fee_base,
       isRural: false,
       distanceKm: null,
       breakdown: `Taxa base (CEP não localizado): ${formatBRL(config.delivery_fee_base)}`,
     };
   }
 
   const distanceKm = haversineDistance(
     storeCoords.lat, storeCoords.lng,
     customerCoords.lat, customerCoords.lng
   );
 
   const roundedDistance = Math.max(0, Math.ceil(distanceKm));
   let fee = config.delivery_fee_base;
 
   if (roundedDistance > config.delivery_base_km) {
     const extraKm = roundedDistance - config.delivery_base_km;
     fee += extraKm * config.delivery_fee_per_km;
   }
 
   return {
     fee: Math.round(fee * 100) / 100,
     isRural: distanceKm > config.delivery_base_km,
     distanceKm: Math.round(distanceKm * 10) / 10,
     breakdown: roundedDistance <= config.delivery_base_km 
       ? `Até ${config.delivery_base_km}km: ${formatBRL(config.delivery_fee_base)}`
       : `Base ${formatBRL(config.delivery_fee_base)} + ${roundedDistance - config.delivery_base_km}km extras (${formatBRL(config.delivery_fee_per_km)}/km)`,
   };
 }
 
import { formatBRL } from "@/lib/utils";
import { fetchCep } from "./cepLookup";

export interface DeliveryFeeConfig {
  city_name: string;
  city_fee: number;
  rural_base_fee: number;
  rural_per_km: number;
  /** R$ the driver receives per platform delivery */
  driver_split: number;
  /** R$ the platform keeps per platform delivery */
  platform_split: number;
  /** R$ operational fee deducted from store per PIX transaction (fixed plan) */
  pix_operational_fee: number;
}

export const DEFAULT_DELIVERY_FEE_CONFIG: DeliveryFeeConfig = {
  city_name: "Itatinga",
  city_fee: 5.0,
  rural_base_fee: 5.0,
  rural_per_km: 0.6,
  driver_split: 4.0,
  platform_split: 2.0,
  pix_operational_fee: 1.0,
};

// Centro de Itatinga - coordenadas fixas de referência
const ITATINGA_CENTER = { lat: -23.1389, lng: -48.6158 };

// Raio em km do centro urbano de Itatinga - dentro = taxa fixa, fora = cálculo por km
const URBAN_RADIUS_KM = 5;

// CEP ranges known to be urban Itatinga (186900xx)
const ITATINGA_CEP_PREFIX = "18690";

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

 // Geocode an address using nominatim (returns lat/lng)
 async function geocodeAddress(cep: string, street?: string, number?: string): Promise<{ lat: number; lng: number } | null> {
   // 1. Try CEP + Street + Number for high precision
   if (street && number) {
     try {
       const query = encodeURIComponent(`${street}, ${number}, ${cep}, Brazil`);
       const res = await fetch(
         `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
         { headers: { "User-Agent": "LovableDeliveryApp/1.0" } }
       );
       if (res.ok) {
         const data = await res.json();
         if (data.length > 0 && data[0].lat && data[0].lon) {
           return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
         }
       }
     } catch {}
   }
 
   // 2. Fallback to BrasilAPI (v2 has coords for some CEPs)
   const digits = cep.replace(/\D/g, "");
   if (digits.length === 8) {
     try {
       const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
       if (res.ok) {
         const data = await res.json();
         if (data.location?.coordinates?.longitude && data.location?.coordinates?.latitude) {
           return {
             lat: data.location.coordinates.latitude,
             lng: data.location.coordinates.longitude,
           };
         }
         if (data.city) {
           return geocodeByCity(data.city, data.state || "SP");
         }
       }
     } catch {}
   }
   return null;
 }
 
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

/**
 * Check if a CEP is in the urban area of Itatinga by CEP prefix.
 * Itatinga urban CEPs start with 18690.
 */
function isUrbanItatingaCep(cep: string): boolean {
  const digits = cep.replace(/\D/g, "");
  return digits.startsWith(ITATINGA_CEP_PREFIX);
}

export interface DeliveryFeeResult {
  fee: number;
  isRural: boolean;
  distanceKm: number | null;
  breakdown: string;
}

/**
 * Calculate delivery fee based on distance from Itatinga center.
 * Logic:
 * 1. If CEP is from Itatinga city (prefix 18690) AND same city name AND not a district = fixed city fee
 * 2. If within URBAN_RADIUS_KM from center AND same city AND not a district = fixed city fee
 * 3. Otherwise = rural base fee + per-km distance
 */
 export async function calculateDeliveryFee(
   customerCep: string,
   storeCep: string,
   config: DeliveryFeeConfig,
   customerCoordsInput?: { lat: number; lng: number } | null
 ): Promise<DeliveryFeeResult> {
  const customerAddr = await fetchCep(customerCep);

  if (!customerAddr) {
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa fixa: ${formatBRL(config.city_fee)}`,
    };
  }

  const customerCity = customerAddr.localidade?.toLowerCase().trim() || "";
  const configCity = config.city_name.toLowerCase().trim();
  const isInCity = customerCity === configCity;
  const isDistrict = isDistrictNeighborhood(customerAddr.bairro);
  const isUrbanCep = isUrbanItatingaCep(customerCep);

  // PRIORITY 1: If CEP prefix matches Itatinga urban area AND city matches AND not a district
  // → This is definitely urban Itatinga, apply fixed fee regardless of geocoding
   if (isInCity && !isDistrict && isUrbanCep) {
     // Still try to get distance for display purposes
     const customerCoords = await geocodeAddress(customerCep);
     const distFromCenter = customerCoords
       ? haversineDistance(ITATINGA_CENTER.lat, ITATINGA_CENTER.lng, customerCoords.lat, customerCoords.lng)
       : null;

    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: distFromCenter ? Math.round(distFromCenter * 10) / 10 : null,
      breakdown: `Centro ${config.city_name}: ${formatBRL(config.city_fee)}`,
    };
  }

   // PRIORITY 2: Use provided coords (GPS) or geocoding to check radius
   const customerCoords = customerCoordsInput || await geocodeAddress(customerCep);
 
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
        breakdown: `Centro ${config.city_name} (${distFromCenter.toFixed(1)}km): ${formatBRL(config.city_fee)}`,
      };
    }

     // Outside urban area = distance-based fee from store/center to customer
     let storeCoords = storeCep ? await geocodeAddress(storeCep) : null;
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
      breakdown: `${label} (${roundedDistance}km da ${referenceLabel}): ${formatBRL(config.rural_base_fee)} + ${roundedDistance}km × ${formatBRL(config.rural_per_km)} = ${formatBRL(roundedFee)}`,
    };
  }

  // No coordinates available - fallback by city name
  if (isInCity && !isDistrict) {
    return {
      fee: config.city_fee,
      isRural: false,
      distanceKm: null,
      breakdown: `Taxa cidade (${config.city_name}): ${formatBRL(config.city_fee)}`,
    };
  }

  // District or rural without coordinates - estimate
  const estimatedKm = isDistrict ? 15 : 10;
  const estimatedFee = config.rural_base_fee + config.rural_per_km * estimatedKm;
  return {
    fee: Math.round(estimatedFee * 100) / 100,
    isRural: true,
    distanceKm: null,
    breakdown: `Taxa rural: ${formatBRL(config.rural_base_fee)} + ~${estimatedKm}km estimado`,
  };
}
