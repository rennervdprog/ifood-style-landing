import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://itasuper.com.br",
  "https://www.itasuper.com.br",
  "https://itasuper.lovable.app",
  "https://id-preview--e8d28ade-d633-4d74-be21-61c8dbe24765.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey);

const USER_AGENT = "ItaSuper/1.6 (backfill-coords)";
const SLEEP_MS = 1_100;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readLimit(value: string | null): number {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

async function geocode(parts: Array<string | null | undefined>): Promise<{ lat: number; lng: number } | null> {
  const query = parts.filter(Boolean).join(", ");
  if (!query) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const headers = cors(origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const limit = readLimit(url.searchParams.get("limit"));
    const target = url.searchParams.get("target") ?? "both";
    if (!new Set(["stores", "addresses", "both"]).has(target)) {
      return new Response(JSON.stringify({ error: "invalid_target" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let storesOk = 0;
    let storesFail = 0;
    let addressesOk = 0;
    let addressesFail = 0;

    if (target === "stores" || target === "both") {
      const { data: stores, error } = await db
        .from("stores")
        .select("id, address_street, address_number, address_neighborhood, address_city, address_state, address_cep")
        .or("latitude.is.null,longitude.is.null")
        .limit(limit);
      if (error) throw error;

      for (const store of stores ?? []) {
        const coordinates = await geocode([
          store.address_street && store.address_number
            ? `${store.address_street}, ${store.address_number}`
            : store.address_street,
          store.address_neighborhood,
          store.address_city,
          store.address_state,
          store.address_cep,
          "Brasil",
        ]);

        if (coordinates) {
          const { error: updateError } = await db
            .from("stores")
            .update({ latitude: coordinates.lat, longitude: coordinates.lng })
            .eq("id", store.id);
          if (updateError) storesFail += 1;
          else storesOk += 1;
        } else {
          storesFail += 1;
        }
        await sleep(SLEEP_MS);
      }
    }

    if (target === "addresses" || target === "both") {
      const { data: addresses, error } = await db
        .from("saved_addresses")
        .select("id, street, number, neighborhood, cep")
        .or("latitude.is.null,longitude.is.null")
        .limit(limit);
      if (error) throw error;

      for (const address of addresses ?? []) {
        const coordinates = await geocode([
          address.street && address.number ? `${address.street}, ${address.number}` : address.street,
          address.neighborhood,
          address.cep,
          "Brasil",
        ]);

        if (coordinates) {
          const { error: updateError } = await db
            .from("saved_addresses")
            .update({ latitude: coordinates.lat, longitude: coordinates.lng, pin_confirmed: false })
            .eq("id", address.id);
          if (updateError) addressesFail += 1;
          else addressesOk += 1;
        } else {
          addressesFail += 1;
        }
        await sleep(SLEEP_MS);
      }
    }

    return new Response(JSON.stringify({ ok: true, storesOk, storesFail, addressesOk, addressesFail }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[backfill-coords] execution failed", error);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
