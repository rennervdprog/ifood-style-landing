import { createClient } from "npm:@supabase/supabase-js@2.49.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "pastelao";
  const base = Deno.env.get("EVOLUTION_API_URL")!.replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY")!;
  const admin = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!,
  );
  const { data: stores } = await admin.from("stores").select("id, name").ilike("name", `%${q}%`);
  const out: any[] = [];
  for (const s of stores || []) {
    const { data: cfg } = await admin.from("store_whatsapp_config").select("*").eq("store_id", s.id).maybeSingle();
    const inst = cfg?.evolution_instance_name;
    let fetchInstances: any = null, state: any = null;
    if (inst) {
      try {
        const r = await fetch(`${base}/instance/fetchInstances?instanceName=${inst}`, { headers: { apikey: key }});
        fetchInstances = await r.json();
      } catch (e) { fetchInstances = String(e); }
      try {
        const r = await fetch(`${base}/instance/connectionState/${inst}`, { headers: { apikey: key }});
        state = await r.json();
      } catch (e) { state = String(e); }
    }
    out.push({ store: s, cfg, fetchInstances, state });
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" }});
});
