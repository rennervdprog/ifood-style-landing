import { createClient } from "npm:@supabase/supabase-js@2.49.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url0 = new URL(req.url);
  const mode = url0.searchParams.get("mode") || "audit";
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  const ext = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const target = `${ext}/functions/v1/evolution-webhook?token=${token}`;

  if (mode === "diag") {
    const sbUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || "";
    if (!sbUrl || !sbKey) return new Response(JSON.stringify({ error: "no sb creds", hasUrl: !!sbUrl, hasKey: !!sbKey }), { headers: { ...cors, "Content-Type": "application/json" }});
    const admin = createClient(sbUrl, sbKey);
    const storeId = "e14a110c-f0a1-4b25-8a71-554a9705fefa";
    const out: any = {};
    try { const r = await admin.from("store_whatsapp_config").select("*").eq("store_id", storeId).maybeSingle(); out.cfg = r.data; out.cfgErr = r.error?.message; } catch(e){ out.cfgErr = String(e); }
    try { const r = await admin.from("whatsapp_bot_sessions").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(5); out.sessions = r.data; out.sessErr = r.error?.message; } catch(e){ out.sessErr = String(e); }
    try { const r = await admin.from("whatsapp_inbound_log").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(10); out.log = r.data; out.logErr = r.error?.message; } catch(e){ out.logErr = String(e); }
    try { out.instance = await fetch(`${base}/instance/fetchInstances?instanceName=store-e14a110c`, { headers: { apikey: key }}).then(r=>r.json()); } catch(e){ out.instanceErr = String(e); }
    try { out.webhook = await fetch(`${base}/webhook/find/store-e14a110c`, { headers: { apikey: key }}).then(r=>r.json()); } catch(e){ out.webhookErr = String(e); }
    return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" }});
  }

  const list = await fetch(`${base}/instance/fetchInstances`, { headers: { apikey: key } }).then(r => r.json());
  const results: any[] = [];
  for (const inst of list) {
    const name = inst?.name || inst?.instance?.instanceName || inst?.instanceName;
    if (!name) continue;
    const w = await fetch(`${base}/webhook/find/${name}`, { headers: { apikey: key } });
    const wj = await w.json().catch(() => ({}));
    const currentUrl = wj?.url || wj?.webhook?.url || "";
    let repaired: any = null;
    if (!currentUrl || !currentUrl.includes("token=")) {
      const payload = { webhook: { enabled: true, url: target, byEvents: false, base64: false, events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"] } };
      const r = await fetch(`${base}/webhook/set/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify(payload),
      });
      repaired = { status: r.status, body: await r.json().catch(() => ({})) };
    }
    results.push({ name, currentUrl, repaired });
  }
  return new Response(JSON.stringify({ target, count: results.length, results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});