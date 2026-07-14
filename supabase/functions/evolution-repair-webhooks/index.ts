import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const setWebhook = async (baseUrl: string, instance: string, apiKey: string, webhookUrl: string) => {
  // Evolution v2.3.x exige o envelope { webhook: { ... } }
  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    },
  };
  const r = await fetch(`${baseUrl.replace(/\/$/, "")}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return {
    ok: r.ok,
    status: r.status,
    data: {
      enabled: Boolean(data?.enabled),
      events: Array.isArray(data?.events) ? data.events : [],
      webhookByEvents: Boolean(data?.webhookByEvents),
      urlConfigured: Boolean(data?.url),
    },
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const url = new URL(req.url);
    const authorized = expected && (
      req.headers.get("x-internal-token") === expected ||
      url.searchParams.get("token") === expected
    );
    if (!authorized) return json({ error: "Forbidden" }, 403);

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    // Repair deve apontar para o host atual das funções; o backend externo é
    // usado apenas como banco de dados de produção.
    const functionBaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL");
    if (!baseUrl || !apiKey || !functionBaseUrl) return json({ error: "Evolution/backend não configurado" }, 500);

    const body = await req.json().catch(() => ({} as any));
    const onlyStoreId = typeof body?.store_id === "string" ? body.store_id : null;

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY"))!,
    );

    let query = admin
      .from("store_whatsapp_config")
      .select("store_id, evolution_instance_name, status, phone_number")
      .not("evolution_instance_name", "is", null);
    if (onlyStoreId) query = query.eq("store_id", onlyStoreId);

    const { data: configs, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const webhookUrl = `${functionBaseUrl}/functions/v1/evolution-webhook?token=${webhookToken}`;
    const results = [];
    for (const cfg of configs ?? []) {
      const instance = String((cfg as any).evolution_instance_name || "");
      if (!instance) continue;
      const repaired = await setWebhook(baseUrl, instance, apiKey, webhookUrl);
      results.push({ store_id: (cfg as any).store_id, instance, status: (cfg as any).status, repaired });
    }

    return json({ success: true, webhook: "configured", count: results.length, results });
  } catch (e) {
    console.error("evolution-repair-webhooks error:", e);
    return json({ error: "Internal error", message: e.message, stack: e.stack }, 500);
  }
});