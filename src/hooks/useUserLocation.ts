/**
 * Detecta a localização real do usuário via GPS do celular (Capacitor) ou
 * navegador, e faz reverse geocode (Nominatim) para descobrir a cidade atual.
 * Resultado é cacheado em sessionStorage para evitar chamadas repetidas.
 */
import { useEffect, useState } from "react";
import { getDeviceGPS } from "@/lib/deviceLocation";
import type { Coordinates } from "@/lib/addressGeocoding";

const STORAGE_KEY = "user-location-v1";
const MAX_AGE_MS = 1000 * 60 * 15; // 15min

export interface UserLocation {
  coords: Coordinates | null;
  city: string | null;
  state: string | null;
  ready: boolean;
}

interface CachedLocation extends UserLocation {
  ts: number;
}

function readCache(): CachedLocation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLocation;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(value: UserLocation) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...value, ts: Date.now() } as CachedLocation),
    );
  } catch {
    // ignore quota errors
  }
}

async function reverseGeocode(coords: Coordinates): Promise<{ city: string | null; state: string | null }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    if (!res.ok) return { city: null, state: null };
    const data = await res.json();
    const addr = data?.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || null;
    const state = addr.state || null;
    return { city: city || null, state: state || null };
  } catch {
    return { city: null, state: null };
  }
}

let inflight: Promise<UserLocation> | null = null;

async function detectLocation(): Promise<UserLocation> {
  if (inflight) return inflight;
  inflight = (async () => {
    const coords = await getDeviceGPS();
    if (!coords) {
      const result: UserLocation = { coords: null, city: null, state: null, ready: true };
      writeCache(result);
      return result;
    }
    const { city, state } = await reverseGeocode(coords);
    const result: UserLocation = { coords, city, state, ready: true };
    writeCache(result);
    return result;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useUserLocation(): UserLocation & { refresh: () => void } {
  const cached = typeof window !== "undefined" ? readCache() : null;
  const [state, setState] = useState<UserLocation>(
    cached ?? { coords: null, city: null, state: null, ready: false },
  );

  useEffect(() => {
    let mounted = true;
    if (cached) return; // already have a fresh value
    detectLocation().then((res) => {
      if (mounted) setState(res);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState({ coords: null, city: null, state: null, ready: false });
    detectLocation().then(setState);
  };

  return { ...state, refresh };
}