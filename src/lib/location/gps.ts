/**
 * Leitura GPS unificada (Capacitor + Web) com cache de 5min.
 * Integra com permissions.ts para diagnóstico claro de falhas.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { cacheGet, cacheSet, TTL } from "./cache";
import {
  checkLocationPermission,
  requestLocationPermission,
} from "./permissions";
import type { Coordinates, PermissionResult } from "./types";

const KEY = "loc:gps:last";
export const GPS_CACHE_KEY = KEY;

export interface GpsReadResult {
  coords: Coordinates | null;
  fromCache: boolean;
  permission: PermissionResult["state"];
  error?: string;
}

let inflight: Promise<GpsReadResult> | null = null;

function gpsErrorState(err: GeolocationPositionError): PermissionResult["state"] {
  if (err.code === err.PERMISSION_DENIED) return "denied";
  if (err.code === err.POSITION_UNAVAILABLE) return "services_off";
  return "prompt";
}

function readBrowserPosition(options: PositionOptions): Promise<GpsReadResult> {
  return new Promise<GpsReadResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        cacheSet(KEY, coords, TTL.gps, { persist: true });
        resolve({ coords, fromCache: false, permission: "granted" });
      },
      (err) =>
        resolve({
          coords: null,
          fromCache: false,
          permission: gpsErrorState(err),
          error: err.message,
        }),
      options,
    );
  });
}

async function readBrowserWithFallback(): Promise<GpsReadResult> {
  const precise = await readBrowserPosition({
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 60_000,
  });

  if (precise.coords || precise.permission === "denied") return precise;

  // Em celulares, o GPS pode estar ativo mas sem fix de alta precisão no prazo.
  // Tenta localização de rede/última posição antes de mostrar erro ao usuário.
  return readBrowserPosition({
    enableHighAccuracy: false,
    timeout: 12_000,
    maximumAge: 5 * 60_000,
  });
}

async function readNow(): Promise<GpsReadResult> {
  // 1) Garante permissão (sem disparar prompt agressivo se já granted).
  const check = await checkLocationPermission();
  let perm = check;
  if (perm.state === "prompt") {
    perm = await requestLocationPermission();
  }
  if (perm.state !== "granted") {
    return { coords: null, fromCache: false, permission: perm.state, error: perm.message };
  }

  // 2) Lê posição.
  if (isCapacitorNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });
      const coords: Coordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      cacheSet(KEY, coords, TTL.gps, { persist: true });
      return { coords, fromCache: false, permission: "granted" };
    } catch (e: any) {
      return { coords: null, fromCache: false, permission: "granted", error: String(e?.message || e) };
    }
  }

  return readBrowserWithFallback();
}

/**
 * Lê o GPS. Usa cache de 5min por padrão. `forceFresh: true` ignora cache.
 */
export async function readGps(opts: { forceFresh?: boolean } = {}): Promise<GpsReadResult> {
  if (!opts.forceFresh) {
    const cached = cacheGet<Coordinates>(KEY, { persist: true });
    if (cached) return { coords: cached, fromCache: true, permission: "granted" };
  }
  if (inflight) return inflight;
  inflight = readNow().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Chamar DIRETO de um onClick (sem await antes). No Web, chama
 * navigator.geolocation.getCurrentPosition de forma síncrona para preservar
 * o "user gesture" que o Chrome/Safari exigem para exibir o prompt.
 */
export function readGpsFromGesture(): Promise<GpsReadResult> {
  if (isCapacitorNative() || typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return readGps({ forceFresh: true });
  }
  return readBrowserWithFallback();
}

/** Compat: equivale ao antigo getDeviceGPS — retorna só as coords. */
export async function getDeviceGPS(): Promise<Coordinates | null> {
  const r = await readGps();
  return r.coords;
}
