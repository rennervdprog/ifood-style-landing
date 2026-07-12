import { createClient } from "npm:@supabase/supabase-js@2.49.4";
Deno.serve(async () => {
  const base = Deno.env.get("EVOLUTION_API_URL")!.replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY")!;
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN")!;
  const fnBase = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!,
  );
  const url = `${fnBase}/functions/v1/evolution-webhook?token=${token}`;
  const { data: cfgs } = await admin.from("store_whatsapp_config").select("store_id, evolution_instance_name").not("evolution_instance_name","is",null);
  const { data: pcfgs } = await admin.from("platform_whatsapp_config").select("id, instance_name").not("instance_name","is",null);
  const targets = [
    ...(cfgs || []).map((c: any) => ({ scope: "store", id: c.store_id, instance: c.evolution_instance_name })),
    ...(pcfgs || []).map((c: any) => ({ scope: "platform", id: c.id, instance: c.instance_name })),
  ];
  const results: any[] = [];
  for (const t of targets) {
    const payload = { webhook: { enabled: true, url, byEvents: false, base64: false, events: ["CONNECTION_UPDATE","MESSAGES_UPSERT"] }};
    const r = await fetch(`${base}/webhook/set/${t.instance}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    results.push({ ...t, http: r.status, urlConfigured: !!d?.url, enabled: !!d?.enabled });
  }
  return new Response(JSON.stringify({ url, results }, null, 2), { headers: { "Content-Type": "application/json" }});
});
