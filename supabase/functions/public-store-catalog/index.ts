import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const normalizeCity = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const rawCity = typeof body.city === "string" ? body.city : "";
    const rawQuery = typeof body.query === "string" ? body.query : "";
    const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const rawStoreId = typeof body.store_id === "string" ? body.store_id.trim() : "";
    const fallbackToAll = body.fallback_to_all !== false;
    const includeBlocked = body.include_blocked === true;
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);

    // Inclui os campos de taxa: sem eles o describeStoreFee calculava base 0
    // e todo card vindo desta funcao exibia "Gratis". O split vem resolvido
    // do servidor (platform_split_effective), igual ao payload da view.
    const baseSelect = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, delivery_fee, delivery_fee_type, delivery_fee_base, delivery_fee_per_km, platform_fee_split, plan_type, platform_split_effective, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings";

    // Esta função usa credencial de serviço; a origem não pode ser escolhida
    // pelo visitante, sob risco de contornar a projeção pública limitada.
    let query = admin
      .from("stores_public")
      .select(baseSelect)
      .in("status", includeBlocked ? ["ativo", "bloqueado"] : ["ativo"])
      .limit(limit);

    if (rawQuery.trim()) {
      query = query.ilike("name", `%${rawQuery.trim()}%`);
    }

    if (rawSlug) {
      query = query.eq("slug", rawSlug);
    }

    if (rawStoreId) {
      query = query.eq("id", rawStoreId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    let stores = data || [];

    if (rawCity.trim()) {
      const targetCity = normalizeCity(rawCity);
      const filtered = stores.filter((store) => normalizeCity(store.address_city || "") === targetCity);
      if (filtered.length > 0 || !fallbackToAll) {
        stores = filtered;
      }
    }

    return new Response(JSON.stringify({ stores }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "Failed to load stores" }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 500,
    });
  }
});