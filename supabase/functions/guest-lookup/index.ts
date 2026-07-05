// Piloto Itatinga — busca perfil guest por telefone.
// POST { phone, store_id } -> { found: bool, name?, lastAddress? }
// Só devolve dados se a última loja usada bater com store_id (mesma cidade),
// para não virar vetor de enumeração global.
import { getExternalSupabase, corsHeaders, jsonRes, normalizePhoneBR }
  from "../_shared/externalClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhoneBR(body?.phone);
    const storeId = String(body?.store_id || "").trim();
    if (!phone) return jsonRes({ error: "invalid_phone" }, 400);
    if (!storeId) return jsonRes({ error: "missing_store_id" }, 400);

    const sb = getExternalSupabase();

    // Loja precisa ter guest_checkout habilitado
    const { data: store } = await sb
      .from("stores")
      .select("id, guest_checkout_enabled, address_city")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || !(store as any).guest_checkout_enabled) {
      return jsonRes({ error: "guest_not_enabled" }, 403);
    }

    const { data: guest } = await sb
      .from("guest_customers")
      .select("user_id, name, last_store_id, city_slug")
      .eq("phone", phone)
      .maybeSingle();

    if (!guest) return jsonRes({ found: false });

    // Só devolve endereço se a última loja foi na mesma cidade
    const sameCity =
      (guest as any).city_slug &&
      String((guest as any).city_slug).toLowerCase() ===
        String((store as any).address_city || "").toLowerCase();
    if (!sameCity) return jsonRes({ found: true, name: (guest as any).name || null });

    const { data: addr } = await sb
      .from("saved_addresses")
      .select("id, label, cep, street, number, complement, neighborhood, reference_point")
      .eq("user_id", (guest as any).user_id)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return jsonRes({ found: true, name: (guest as any).name || null, lastAddress: addr || null });
  } catch (e) {
    console.error("[guest-lookup] error:", e);
    return jsonRes({ error: "internal_error" }, 500);
  }
});