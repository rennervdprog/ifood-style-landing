/**
 * Hook unificado de localização do usuário. Usa o novo núcleo @/lib/location.
 * Mantém a API original ({ coords, city, state, ready, refresh }).
 */
import { useEffect, useState } from "react";
import { readGps, reverseGeocode } from "@/lib/location";
import type { Coordinates } from "@/lib/location";

export interface UserLocation {
  coords: Coordinates | null;
  city: string | null;
  state: string | null;
  ready: boolean;
}

let inflight: Promise<UserLocation> | null = null;

async function detect(forceFresh = false): Promise<UserLocation> {
  if (inflight && !forceFresh) return inflight;
  inflight = (async () => {
    const g = await readGps({ forceFresh });
    if (!g.coords) return { coords: null, city: null, state: null, ready: true };
    const rev = await reverseGeocode(g.coords);
    return {
      coords: g.coords,
      city: rev?.city ?? null,
      state: rev?.state ?? null,
      ready: true,
    };
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useUserLocation(): UserLocation & { refresh: () => void } {
  const [state, setState] = useState<UserLocation>({
    coords: null,
    city: null,
    state: null,
    ready: false,
  });

  useEffect(() => {
    let alive = true;
    detect().then((r) => alive && setState(r));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = () => {
    setState({ coords: null, city: null, state: null, ready: false });
    detect(true).then(setState);
  };

  return { ...state, refresh };
}