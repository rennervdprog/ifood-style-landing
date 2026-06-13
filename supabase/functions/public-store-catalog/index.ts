import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeCity = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const includeTest = body.include_test === true;
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);

    const baseSelect = "id, name, image_url, slug, category, categories, is_open, force_closed, rating, status, delivery_mode, own_delivery_fee, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings";

    let query = admin
      .from(includeTest ? "stores" : "stores_public")
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "Failed to load stores" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});