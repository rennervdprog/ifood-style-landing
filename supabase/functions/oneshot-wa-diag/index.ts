import { createClient } from "npm:@supabase/supabase-js@2.49.4";
Deno.serve(async () => {
  const admin = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL")!, Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!);
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  const functionBase = Deno.env.get("SUPABASE_URL");
  const out: any = {};

  const setWebhook = async (inst: string, url: string) => {
    const r = await fetch(`${base}/webhook/set/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ enabled: true, url, webhook_by_events: false, webhook_base64: false, events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"] }),
    });
    return { status: r.status, body: await r.json().catch(()=>null) };
  };

  // Store webhook -> external supabase (data lives there, evolution-webhook was likely deployed there)
  const storeWebhookUrl = `${functionBase}/functions/v1/evolution-webhook?token=${token}`;
  const platformWebhookUrl = `${functionBase}/functions/v1/platform-whatsapp-webhook?token=${token}`;
  out.store_set = await setWebhook("store-b97f3a1a", storeWebhookUrl);
  out.platform_set = await setWebhook("itasuper-platform", platformWebhookUrl);
  out.store_find = await (await fetch(`${base}/webhook/find/store-b97f3a1a`, { headers: { apikey: key } })).json().catch(()=>null);
  out.platform_find = await (await fetch(`${base}/webhook/find/itasuper-platform`, { headers: { apikey: key } })).json().catch(()=>null);
  out.functionBase = functionBase;
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
});
