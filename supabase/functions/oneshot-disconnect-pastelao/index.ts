import { createClient } from "npm:@supabase/supabase-js@2.49.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "missing_evolution_config" }, 500);

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY"))!,
    );

    const { data: store } = await admin.from("stores").select("id,name").ilike("name", "%pastel%carioca%").maybeSingle();
    if (!store) return json({ error: "store_not_found" }, 404);

    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("id, evolution_instance_name")
      .eq("store_id", store.id)
      .maybeSingle();
    const instance = cfg?.evolution_instance_name || `store-${String(store.id).slice(0, 8)}`;

    const logoutRes = await fetch(`${baseUrl}/instance/logout/${instance}`, {
      method: "DELETE",
      headers: { apikey: apiKey },
    });
    const logoutBody = await logoutRes.json().catch(() => ({}));

    await admin.from("store_whatsapp_config").update({
      status: "disconnected",
      phone_number: null,
      connected_at: null,
      updated_at: new Date().toISOString(),
    }).eq("store_id", store.id);

    return json({ success: logoutRes.ok, store: store.name, instance, logoutStatus: logoutRes.status, logoutBody });
  } catch (e: any) {
    return json({ error: "internal_error", message: e?.message }, 500);
  }
});