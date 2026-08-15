// Fase 3a — resolução estruturada do endereço de entrega.
// Uso: cliente autenticado no checkout web. Não altera dados, apenas resolve.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface AddressInput {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

interface ResolveResponse {
  ok: boolean;
  normalized_address?: string;
  cep?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  precision?: "address" | "street" | "cep";
  reason?: string;
}

const UA = "ItaSuper/1.0 (delivery-address-resolver)";
const json = (body: ResolveResponse, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (v: unknown, max = 120) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 7000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function viaCep(cep: string) {
  return await withTimeout(async (signal) => {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.erro) return null;
    return {
      street: clean(j.logradouro),
      neighborhood: clean(j.bairro),
      city: clean(j.localidade),
      state: clean(j.uf, 2).toUpperCase(),
    };
  });
}

type Geo = { lat: number; lng: number; precision: "address" | "street" | "cep" };

async function nominatim(params: Record<string, string>, precision: Geo["precision"]): Promise<Geo | null> {
  const qs = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", ...params });
  return await withTimeout(async (signal) => {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs.toString()}`, {
      signal,
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR" },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, precision };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  // --- Autenticação: exige JWT válido de usuário (sem privilégio admin) ---
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, reason: "unauthorized" }, 401);
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, reason: "unauthorized" }, 401);

  let body: AddressInput;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const street = clean(body.street);
  const number = clean(body.number, 20);
  const complement = clean(body.complement, 80);
  let neighborhood = clean(body.neighborhood, 80);
  let city = clean(body.city, 80);
  let state = clean(body.state, 2).toUpperCase();
  const cep = String(body.cep ?? "").replace(/\D/g, "");

  if (cep.length !== 8) return json({ ok: false, reason: "invalid_cep" }, 400);
  if (!street) return json({ ok: false, reason: "missing_street" }, 400);
  if (!number) return json({ ok: false, reason: "missing_number" }, 400);

  // --- Normalização pelo CEP (ViaCEP não fornece coordenadas) ---
  const base = await viaCep(cep);
  if (base) {
    neighborhood = neighborhood || base.neighborhood;
    city = city || base.city;
    state = state || base.state;
  }

  if (!neighborhood) return json({ ok: false, reason: "missing_neighborhood" }, 400);
  if (!city) return json({ ok: false, reason: "missing_city" }, 400);
  if (!/^[A-Z]{2}$/.test(state)) return json({ ok: false, reason: "invalid_state" }, 400);

  // --- Geocodificação estruturada, do mais preciso ao menos preciso ---
  let geo =
    (await nominatim({ street: `${number} ${street}`, city, state, postalcode: cep }, "address")) ??
    (await nominatim({ street, city, state }, "street")) ??
    (await nominatim({ postalcode: cep, country: "Brasil" }, "cep"));

  if (!geo) return json({ ok: false, reason: "address_not_found" });

  const normalized_address = [
    `${street}, ${number}`,
    complement || null,
    neighborhood,
    `${city}/${state}`,
    `CEP ${cep.slice(0, 5)}-${cep.slice(5)}`,
  ].filter(Boolean).join(" - ");

  return json({
    ok: true,
    normalized_address,
    cep,
    city,
    state,
    lat: geo.lat,
    lng: geo.lng,
    precision: geo.precision,
  });
});
