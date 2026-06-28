/**
 * Resolver de endereço unificado (Fase 3).
 * API única: tenta `prefer`, depois percorre `fallback` em ordem.
 * - GPS → reverse() para popular o endereço.
 * - address/cep → geocode() para popular as coords.
 */
import { fetchCep } from "./cep";
import { geocodeAddress } from "./geocode";
import { readGps } from "./gps";
import { reverseGeocode } from "./reverse";
import type {
  AddressContext,
  LocationAccuracy,
  LocationSource,
  ResolvedLocation,
} from "./types";

export type ResolveMode = "gps" | "address" | "cep";

export interface ResolveOptions {
  prefer?: ResolveMode;
  fallback?: ResolveMode[];
  address?: AddressContext;
  /** força nova leitura GPS, ignorando cache de 5min */
  forceGpsFresh?: boolean;
}

function accuracyFor(source: LocationSource): LocationAccuracy {
  if (source === "gps") return "high";
  if (source === "address") return "medium";
  if (source === "reverse") return "high";
  if (source === "cep") return "low";
  return "unknown";
}

function emptyResult(): ResolvedLocation {
  return {
    coords: null,
    address: null,
    source: "manual",
    accuracy: "unknown",
    warnings: [],
  };
}

async function tryGps(opts: ResolveOptions, out: ResolvedLocation): Promise<boolean> {
  const r = await readGps({ forceFresh: opts.forceGpsFresh });
  if (!r.coords) {
    if (r.error) out.warnings.push(`gps: ${r.error}`);
    else if (r.permission !== "granted") out.warnings.push(`gps: ${r.permission}`);
    return false;
  }
  out.coords = r.coords;
  out.source = "gps";
  out.accuracy = accuracyFor("gps");
  // Tenta enriquecer com endereço.
  const rev = await reverseGeocode(r.coords);
  if (rev) out.address = rev;
  return true;
}

async function tryAddress(opts: ResolveOptions, out: ResolvedLocation): Promise<boolean> {
  const addr = opts.address;
  if (!addr) return false;
  const coords = await geocodeAddress(addr);
  if (!coords) {
    out.warnings.push("address: geocode falhou");
    return false;
  }
  out.coords = coords;
  out.address = { ...addr };
  out.source = "address";
  out.accuracy = accuracyFor("address");
  return true;
}

async function tryCep(opts: ResolveOptions, out: ResolvedLocation): Promise<boolean> {
  const cep = opts.address?.postalcode?.replace(/\D/g, "");
  if (!cep || cep.length !== 8) return false;
  const c = await fetchCep(cep);
  if (!c) {
    out.warnings.push("cep: lookup falhou");
    return false;
  }
  const built: AddressContext = {
    street: c.logradouro || opts.address?.street || null,
    neighborhood: c.bairro || opts.address?.neighborhood || null,
    city: c.localidade,
    state: c.uf,
    postalcode: cep,
    country: "Brasil",
  };
  const coords = await geocodeAddress(built);
  if (!coords) {
    out.warnings.push("cep: geocode falhou");
    // Mesmo sem coords, devolve o endereço.
    out.address = built;
    out.source = "cep";
    out.accuracy = "low";
    return false;
  }
  out.coords = coords;
  out.address = built;
  out.source = "cep";
  out.accuracy = accuracyFor("cep");
  return true;
}

const RUNNERS: Record<ResolveMode, (o: ResolveOptions, out: ResolvedLocation) => Promise<boolean>> = {
  gps: tryGps,
  address: tryAddress,
  cep: tryCep,
};

export async function resolveAddress(opts: ResolveOptions = {}): Promise<ResolvedLocation> {
  const order: ResolveMode[] = [];
  if (opts.prefer) order.push(opts.prefer);
  for (const m of opts.fallback ?? ["gps", "address", "cep"]) {
    if (!order.includes(m)) order.push(m);
  }
  const out = emptyResult();
  for (const mode of order) {
    const ok = await RUNNERS[mode](opts, out);
    if (ok && out.coords) return out;
  }
  return out;
}
