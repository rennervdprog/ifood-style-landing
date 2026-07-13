 export interface StoreDeliveryConfig {
   delivery_fee_type: 'fixed' | 'km';
   delivery_base_km: number;
   delivery_fee_base: number;
   delivery_fee_per_km: number;
   own_delivery_fee: number;
   customer_street?: string | null;
   customer_number?: string | null;
    customer_coords?: { lat: number; lng: number } | null;
   customer_neighborhood?: string | null;
   customer_city?: string | null;
   customer_state?: string | null;
   store_coords?: { lat: number; lng: number } | null;
    platform_split?: number;
 }
 
 /**
  * Calculate delivery fee for a store that manages its own delivery.
  */
  export async function calculateStoreOwnDeliveryFee(
    customerCep: string,
    storeCep: string,
    config: StoreDeliveryConfig
  ): Promise<DeliveryFeeResult> {
    // Get platform split from admin config if available, fallback to 2.0
    const PLATFORM_FEE = config.platform_split ?? 0.99; 
    
    if (config.delivery_fee_type === 'fixed') {
      const totalFee = Number(config.own_delivery_fee || 0) + PLATFORM_FEE;
      return {
        fee: totalFee,
        isRural: false,
        distanceKm: null,
        breakdown: `Entrega: ${formatBRL(config.own_delivery_fee)} + Taxa operacional: ${formatBRL(PLATFORM_FEE)}`,
      };
    }
 
    // 1. Coordenadas do cliente: prioriza GPS > geocoding por rua+CEP > só CEP
    let customerCoords = config.customer_coords ?? null;

    // 🛣️ Tenta rota real (OSRM) via edge function — fonte única de verdade
    try {
      const { resolveDistance } = await import("./location");
      const routeRes = await resolveDistance({
        store: {
          lat: config.store_coords?.lat ?? null,
          lng: config.store_coords?.lng ?? null,
          cep: storeCep,
        },
        customer: {
          lat: customerCoords?.lat ?? null,
          lng: customerCoords?.lng ?? null,
          cep: customerCep,
          street: config.customer_street ?? null,
          number: config.customer_number ?? null,
          neighborhood: config.customer_neighborhood ?? null,
          city: config.customer_city ?? null,
          state: config.customer_state ?? null,
        },
      });

      if (routeRes?.ok && routeRes.distanceKm != null) {
        const realKm = routeRes.distanceKm;
        const pricingDistance = Math.max(1, Math.ceil(realKm));
        let fee = Number(config.delivery_fee_base || 0);
        if (pricingDistance > config.delivery_base_km) {
          const extraKm = pricingDistance - Number(config.delivery_base_km || 0);
          fee = fee + extraKm * Number(config.delivery_fee_per_km || 0);
        }
        const totalFee = addMoney(fee, PLATFORM_FEE);
        const withinBase = pricingDistance <= Number(config.delivery_base_km || 0);
        const accLabel =
          routeRes.accuracy === "gps" ? "GPS"
          : routeRes.accuracy === "address" ? "Endereço"
          : "CEP";
        const srcLabel = routeRes.routeSource?.startsWith("osrm") ? "rota real" : "linha reta";
        return {
          fee: totalFee,
          isRural: !withinBase,
          distanceKm: realKm,
          breakdown: withinBase
            ? `Entrega (${realKm.toFixed(1)}km · ${srcLabel} · precisão ${accLabel}): ${formatBRL(fee)} + Taxa operacional: ${formatBRL(PLATFORM_FEE)}`
            : `Base ${formatBRL(config.delivery_fee_base)} + ${pricingDistance - Number(config.delivery_base_km)}km extras × ${formatBRL(config.delivery_fee_per_km)} + Taxa operacional: ${formatBRL(PLATFORM_FEE)} = ${formatBRL(totalFee)} (${srcLabel} · ${accLabel})`,
        };
      }
    } catch { /* fallback abaixo */ }

    // Fallback antigo (Haversine + Nominatim) — caso edge function falhe
    if (!customerCoords) {
      // Tenta com rua + número primeiro (mais preciso)
      if (config.customer_street) {
        customerCoords = await geocodeAddress({
          postalcode: customerCep,
          street: config.customer_number
            ? `${config.customer_street}, ${config.customer_number}`
            : config.customer_street,
        });
      }
      // Fallback: só pelo CEP
      if (!customerCoords) {
        customerCoords = await geocodeAddress({ postalcode: customerCep });
      }
    }

    // 2. Coordenadas da loja: geocoding pelo CEP da loja
    const storeCoords = storeCep
      ? await geocodeAddress({ postalcode: storeCep })
      : ITATINGA_CENTER;

    if (!customerCoords || !storeCoords) {
      // Fallback seguro: cobra taxa base + plataforma sem distância
      return {
        fee: addMoney(Number(config.delivery_fee_base || 0), PLATFORM_FEE),
        isRural: false,
        distanceKm: null,
        breakdown: `Taxa base (endereço não localizado): ${formatBRL(config.delivery_fee_base)} + Taxa operacional: ${formatBRL(PLATFORM_FEE)}`,
      };
    }
 
    // 3. Distância em linha reta (Haversine)
    const distanceKm = haversineDistance(storeCoords.lat, storeCoords.lng, customerCoords.lat, customerCoords.lng);
    
    // Exibição: arredondado 1 casa decimal
    // Cobrança: arredondado para CIMA inteiro (evita cobrar menos)
    const roundedDistance = Math.max(0, Math.round(distanceKm * 10) / 10);
    // 🔒 pricingDistance começa em 1 km mínimo para evitar cobrança zero
    const pricingDistance = Math.max(1, Math.ceil(distanceKm));
    
    let fee = Number(config.delivery_fee_base || 0);
  
    if (pricingDistance > config.delivery_base_km) {
      const extraKm = pricingDistance - Number(config.delivery_base_km || 0);
      fee = fee + extraKm * Number(config.delivery_fee_per_km || 0);
    }

    const totalFee = addMoney(fee, PLATFORM_FEE);
    const withinBase = pricingDistance <= Number(config.delivery_base_km || 0);

    return {
      fee: totalFee,
      isRural: !withinBase,
      distanceKm: roundedDistance,
      breakdown: withinBase
        ? `Entrega (${roundedDistance}km, dentro dos ${config.delivery_base_km}km base): ${formatBRL(fee)} + Taxa operacional: ${formatBRL(PLATFORM_FEE)}`
        : `Base ${formatBRL(config.delivery_fee_base)} + ${pricingDistance - Number(config.delivery_base_km)}km extras × ${formatBRL(config.delivery_fee_per_km)} + Taxa operacional: ${formatBRL(PLATFORM_FEE)} = ${formatBRL(totalFee)}`,
    };
  }
 
import { formatBRL, addMoney } from "@/lib/utils";
import { fetchCep } from "./location";
import { geocodeAddress } from "./location";

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
  pix_operational_fee: 1.99,
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
  const configCity = (config.city_name || DEFAULT_DELIVERY_FEE_CONFIG.city_name).toLowerCase().trim();
  const isInCity = customerCity === configCity;
  const isDistrict = isDistrictNeighborhood(customerAddr.bairro);
  const isUrbanCep = isUrbanItatingaCep(customerCep);

  // PRIORITY 1: If CEP prefix matches Itatinga urban area AND city matches AND not a district
  // → This is definitely urban Itatinga, apply fixed fee regardless of geocoding
   if (isInCity && !isDistrict && isUrbanCep) {
     // Still try to get distance for display purposes
     const customerCoords = await geocodeAddress({ postalcode: customerCep });
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
   const customerCoords = customerCoordsInput || await geocodeAddress({ postalcode: customerCep });
 
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
     let storeCoords = storeCep ? await geocodeAddress({ postalcode: storeCep }) : null;
     const referencePoint = storeCoords || ITATINGA_CENTER;
     const referenceLabel = storeCoords ? "loja" : "centro";

    const distanceKm = haversineDistance(
      referencePoint.lat, referencePoint.lng,
      customerCoords.lat, customerCoords.lng
    );

    const pricingDistance = Math.ceil(distanceKm);
    const fee = addMoney(config.rural_base_fee, config.rural_per_km * pricingDistance);
    const roundedDistance = Math.round(distanceKm * 10) / 10;

    const label = isDistrict
      ? `Distrito ${customerAddr.bairro}`
      : customerAddr.localidade || "zona rural";

    return {
      fee: fee,
      isRural: true,
      distanceKm: roundedDistance,
      breakdown: `${label} (${roundedDistance}km da ${referenceLabel}): ${formatBRL(config.rural_base_fee)} + ${pricingDistance}km × ${formatBRL(config.rural_per_km)} = ${formatBRL(fee)}`,
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
  const estimatedFee = addMoney(config.rural_base_fee, config.rural_per_km * estimatedKm);
  return {
    fee: Math.round(estimatedFee * 100) / 100,
    isRural: true,
    distanceKm: null,
    breakdown: `Taxa rural: ${formatBRL(config.rural_base_fee)} + ~${estimatedKm}km estimado`,
  };
}
