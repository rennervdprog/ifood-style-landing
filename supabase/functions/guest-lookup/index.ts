// Piloto Itatinga — busca perfil guest por telefone.
// Deployado no Supabase EXTERNO. Autocontido (sem _shared).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function normalizePhoneBR(input: unknown): string | null {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhoneBR(body?.phone);
    const storeId = String(body?.store_id || "").trim();
    if (!phone) return json({ error: "invalid_phone" }, 400);
    if (!storeId) return json({ error: "missing_store_id" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: store } = await sb
      .from("stores")
      .select("id, guest_checkout_enabled, address_city")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || !(store as any).guest_checkout_enabled) {
      return json({ error: "guest_not_enabled" }, 403);
    }

    const { data: guest } = await sb
      .from("guest_customers")
      .select("user_id, name, city_slug")
      .eq("phone", phone)
      .maybeSingle();
    if (!guest) return json({ found: false });

    const sameCity =
      (guest as any).city_slug &&
      String((guest as any).city_slug).toLowerCase() ===
        String((store as any).address_city || "").toLowerCase();
    if (!sameCity) return json({ found: true, name: (guest as any).name || null });

    const { data: addr } = await sb
      .from("saved_addresses")
      .select("id, label, cep, street, number, complement, neighborhood, reference_point")
      .eq("user_id", (guest as any).user_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({ found: true, name: (guest as any).name || null, lastAddress: addr || null });
  } catch (e) {
    console.error("[guest-lookup] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});