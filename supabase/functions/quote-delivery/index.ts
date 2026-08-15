// Cotação central de entrega — fonte única para endereço, distância e preço.
// Não cria pedido nem altera dados do cliente ou da loja.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://itasuper.com.br",
  "https://www.itasuper.com.br",
  "https://itasuper.lovable.app",
  "https://id-preview--e8d28ade-d633-4d74-be21-61c8dbe24765.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

interface AddressInput {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

interface QuoteRequest {
  store_id?: string;
  fulfillment?: "delivery" | "pickup";
  address?: AddressInput;
  subtotal?: number;
}

interface ResolvedDestination {
  normalized_address: string;
  neighborhood: string;
  cep: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  precision: "address" | "street" | "cep";
}

const cleanNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function authenticate(req: Request): Promise<{ ok: true; internal: boolean } | { ok: false }> {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false };
  if (token === SERVICE_ROLE_KEY) return { ok: true, internal: true };

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && data.user ? { ok: true, internal: false } : { ok: false };
}

async function resolveDestination(address: AddressInput): Promise<ResolvedDestination | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/resolve-delivery-address`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(address),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.ok || !Number.isFinite(Number(payload.lat)) || !Number.isFinite(Number(payload.lng))) return null;
    return {
      normalized_address: String(payload.normalized_address || ""),
      neighborhood: String(payload.neighborhood || ""),
      cep: String(payload.cep || "").replace(/\D/g, ""),
      city: String(payload.city || ""),
      state: String(payload.state || "").toUpperCase(),
      lat: Number(payload.lat),
      lng: Number(payload.lng),
      precision: payload.precision === "address" || payload.precision === "street" ? payload.precision : "cep",
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const auth = await authenticate(req);
  if (!auth.ok) return json({ ok: false, reason: "unauthorized" }, 401);

  let body: QuoteRequest;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  const storeId = String(body.store_id || "").trim();
  const fulfillment = body.fulfillment === "pickup" ? "pickup" : "delivery";
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ ok: false, reason: "invalid_store" }, 400);

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id,name,delivery_enabled,delivery_mode,latitude,longitude,max_delivery_km,delivery_radius,delivery_fee_type,delivery_fee_base,delivery_fee_per_km,delivery_base_km,own_delivery_fee,delivery_fee,free_delivery_threshold")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError || !store) return json({ ok: false, reason: "store_not_found" }, 404);

  if (fulfillment === "pickup") {
    return json({
      ok: true,
      fulfillment: "pickup",
      destination: null,
      distance: { km: 0, source: "none", max_km: null, eligible: true },
      pricing: {
        store_delivery_base: 0,
        platform_fee_customer: 0,
        platform_fee_store_absorbed: 0,
        delivery_fee: 0,
        vip_override_applied: null,
        split_mode: null,
      },
      policy_version: 1,
    });
  }

  if (store.delivery_enabled !== true || store.delivery_mode === "pickup") {
    return json({ ok: false, reason: "delivery_unavailable" }, 409);
  }

  const storeLat = Number(store.latitude);
  const storeLng = Number(store.longitude);
  if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng)) {
    return json({ ok: false, reason: "store_location_unavailable" }, 409);
  }

  const destination = await resolveDestination(body.address || {});
  if (!destination) return json({ ok: false, reason: "address_unavailable" }, 422);

  const distanceKm = Math.round(haversineKm({ lat: storeLat, lng: storeLng }, destination) * 10) / 10;
  const maxKm = cleanNumber(store.max_delivery_km) || cleanNumber(store.delivery_radius) || null;
  if (maxKm !== null && distanceKm > maxKm) {
    return json({
      ok: false,
      reason: "outside_delivery_area",
      distance: { km: distanceKm, source: "haversine", max_km: maxKm, eligible: false },
    }, 409);
  }

  const [{ data: feeProfile, error: feeError }, { data: plan }] = await Promise.all([
    admin.rpc("compute_store_delivery_fee", { _store_id: storeId }),
    admin.from("store_plans").select("platform_delivery_split_override,plan_type").eq("store_id", storeId).eq("is_active", true).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (feeError || !feeProfile) return json({ ok: false, reason: "pricing_unavailable" }, 503);

  const subtotal = cleanNumber(body.subtotal);
  const freeThreshold = cleanNumber(store.free_delivery_threshold);
  const freeDelivery = freeThreshold > 0 && subtotal >= freeThreshold;

  let storeBase = cleanNumber((feeProfile as Record<string, unknown>).base_fee);
  if (String(store.delivery_fee_type || "fixed") === "km") {
    const baseKm = cleanNumber(store.delivery_base_km);
    const feeBase = cleanNumber(store.delivery_fee_base);
    const perKm = cleanNumber(store.delivery_fee_per_km);
    storeBase = feeBase + Math.max(0, distanceKm - baseKm) * perKm;
  }

  const platformCustomer = cleanNumber((feeProfile as Record<string, unknown>).platform_add_customer);
  const platformAbsorbed = cleanNumber((feeProfile as Record<string, unknown>).platform_add_payout_deduction);
  const deliveryFee = freeDelivery ? 0 : roundMoney(storeBase + platformCustomer);

  return json({
    ok: true,
    fulfillment: "delivery",
    destination,
    distance: { km: distanceKm, source: "haversine", max_km: maxKm, eligible: true },
    pricing: {
      store_delivery_base: roundMoney(storeBase),
      platform_fee_customer: freeDelivery ? 0 : roundMoney(platformCustomer),
      platform_fee_store_absorbed: freeDelivery ? roundMoney(platformAbsorbed + storeBase) : roundMoney(platformAbsorbed),
      delivery_fee: deliveryFee,
      vip_override_applied: plan?.platform_delivery_split_override ?? null,
      split_mode: (feeProfile as Record<string, unknown>).split_mode ?? null,
      plan_type: (feeProfile as Record<string, unknown>).plan_type ?? null,
      free_delivery_applied: freeDelivery,
    },
    policy_version: 1,
  });
});
