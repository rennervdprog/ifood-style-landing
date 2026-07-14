// Diagnóstico completo do WhatsApp de uma loja. Requer usuário admin/super_admin.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const storeId = url.searchParams.get("store_id") || "b97f3a1a-d558-41e5-b8a2-ebd65b5381b4";

  const out: Record<string, unknown> = { store_id: storeId, ts: new Date().toISOString() };

  const baseUrl = Deno.env.get("EVOLUTION_API_URL");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  out.evolution_configured = !!(baseUrl && apiKey);
  out.evolution_url = baseUrl || null;

  const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY");
  out.external_configured = !!(extUrl && extKey);

  if (!extUrl || !extKey) return json({ error: "Backend externo não configurado" }, 500);
  const ext = createClient(extUrl, extKey);
  const { data: roleRows } = await ext.from("user_roles").select("role").eq("user_id", userData.user.id);
  const roles = (roleRows || []).map((r: any) => r.role);
  if (!roles.some((r) => ["admin", "super_admin"].includes(r))) return json({ error: "Forbidden" }, 403);

  // 1) Config no external
  if (extUrl && extKey) {
    try {
      const { data: store } = await ext.from("stores").select("id, name, slug, owner_id, status, is_open, force_closed").eq("id", storeId).maybeSingle();
      out.store = store;
      const { data: cfg } = await ext.from("store_whatsapp_config").select("*").eq("store_id", storeId).maybeSingle();
      out.store_whatsapp_config = cfg;
    } catch (e) { out.external_error = String(e); }
  }

  // 2) Estado da instância no Evolution
  if (baseUrl && apiKey) {
    const root = baseUrl.replace(/\/$/, "");
    const instance = `store-${storeId.slice(0, 8)}`;
    out.instance = instance;
    try {
      const r = await fetch(`${root}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
      out.connection_state = { status: r.status, body: await r.json().catch(() => ({})) };
    } catch (e) { out.connection_state_error = String(e); }
    try {
      const r = await fetch(`${root}/instance/fetchInstances?instanceName=${instance}`, { headers: { apikey: apiKey } });
      out.fetch_instances = { status: r.status, body: await r.json().catch(() => ({})) };
    } catch (e) { out.fetch_instances_error = String(e); }
    // Optional: perform connect if ?do_connect=1
    if (url.searchParams.get("do_connect") === "1") {
      try {
        const r = await fetch(`${root}/instance/connect/${instance}`, { headers: { apikey: apiKey } });
        const body = await r.json().catch(() => ({}));
        out.connect_attempt = { status: r.status, has_base64: !!(body?.base64 || body?.qrcode?.base64), has_code: !!(body?.code || body?.qrcode?.code), keys: Object.keys(body || {}) };
      } catch (e) { out.connect_error = String(e); }
    }
  }

  return json(out);
});