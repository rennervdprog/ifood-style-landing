/**
 * Endereço → coordenadas, via Nominatim, com fila + cache de 7 dias.
 */
import { cacheGet, cacheSet, TTL } from "./cache";
import { fetchCep } from "./cep";
import { nominatimQueue, NOMINATIM_HEADERS } from "./nominatim";
import type { AddressContext, Coordinates } from "./types";

const BASE = "https://nominatim.openstreetmap.org/search";
const DEFAULT_COUNTRY = "Brazil";
const COUNTRY_CODE = "br";

function n(v?: string | null): string | undefined {
  const s = v?.trim();
  return s || undefined;
}

function toNum(v: unknown): number | null {
  const x = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
}

function extractHouseNumber(street: string): { name: string; number: string | null } {
  const trailing = street.match(/^(.+?)[,\s]+(\d{1,6})\s*$/);
  if (trailing) return { name: trailing[1].trim(), number: trailing[2] };
  const leading = street.match(/^(\d{1,6})\s+(.+)$/);
  if (leading) return { name: leading[2].trim(), number: leading[1] };
  return { name: street, number: null };
}

function keyOf(ctx: AddressContext): string {
  return [
    "loc:geo",
    n(ctx.street) || "",
    n(ctx.number) || "",
    n(ctx.neighborhood) || "",
    n(ctx.city) || "",
    n(ctx.state) || "",
    (n(ctx.postalcode) || "").replace(/\D/g, ""),
  ].join("|");
}

async function fillFromCep(ctx: AddressContext): Promise<AddressContext> {
  const out: AddressContext = { ...ctx };
  const cep = n(out.postalcode)?.replace(/\D/g, "");
  if (cep && (!n(out.city) || !n(out.state))) {
    const c = await fetchCep(cep);
    if (c) {
      out.city = out.city || c.localidade;
      out.state = out.state || c.uf;
      out.neighborhood = out.neighborhood || c.bairro;
      out.street = out.street || c.logradouro;
    }
  }
  return out;
}

async function call(params: URLSearchParams): Promise<Coordinates | null> {
  return nominatimQueue(async () => {
    try {
      const res = await fetch(`${BASE}?${params.toString()}`, { headers: NOMINATIM_HEADERS });
      if (!res.ok) return null;
      const data = await res.json();
      const lat = toNum(data?.[0]?.lat);
      const lng = toNum(data?.[0]?.lon);
      return lat !== null && lng !== null ? { lat, lng } : null;
    } catch {
      return null;
    }
  });
}

export async function geocodeAddress(input: AddressContext): Promise<Coordinates | null> {
  const ctx = await fillFromCep(input);
  const key = keyOf(ctx);
  const cached = cacheGet<Coordinates | null>(key, { persist: true });
  if (cached !== null) return cached;

  const structured = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    addressdetails: "0",
    countrycodes: COUNTRY_CODE,
  });
  const street = n(ctx.street);
  if (street) {
    const { name, number } = extractHouseNumber(street);
    const num = n(ctx.number) || number;
    structured.set("street", num ? `${num} ${name}` : name);
  }
  if (n(ctx.city)) structured.set("city", ctx.city!);
  if (n(ctx.state)) structured.set("state", ctx.state!);
  const cep = n(ctx.postalcode)?.replace(/\D/g, "");
  if (cep) structured.set("postalcode", cep);
  structured.set("country", n(ctx.country) || DEFAULT_COUNTRY);

  let result = await call(structured);

  if (!result) {
    const variants: Array<Array<string | undefined>> = [
      [street, n(ctx.neighborhood), n(ctx.city), n(ctx.state), cep, DEFAULT_COUNTRY],
      [street, n(ctx.city), n(ctx.state), DEFAULT_COUNTRY],
    ];
    for (const parts of variants) {
      const q = parts.filter(Boolean).join(", ");
      if (!q) continue;
      const ff = new URLSearchParams({
        q,
        format: "jsonv2",
        limit: "1",
        addressdetails: "0",
        countrycodes: COUNTRY_CODE,
      });
      result = await call(ff);
      if (result) break;
    }
  }

  cacheSet(key, result, result ? TTL.geocode : 60 * 60 * 1000, { persist: true });
  return result;
}
