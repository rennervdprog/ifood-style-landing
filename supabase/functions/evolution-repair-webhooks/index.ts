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
  const root = baseUrl.replace(/\/$/, "");
  const readBody = async (r: Response) => r.json().catch(() => ({}));
  const findWebhook = async () => {
    const r = await fetch(`${root}/webhook/find/${instance}`, { headers: { apikey: apiKey }, signal: AbortSignal.timeout(20_000) });
    return { ok: r.ok, status: r.status, data: await readBody(r) };
  };
  const getUrl = (body: any) => String(body?.url || body?.webhook?.url || "");
  const isEnabled = (body: any) => Boolean(body?.enabled ?? body?.webhook?.enabled);

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
  const r = await fetch(`${root}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await readBody(r);
  let verified = await findWebhook().catch(() => null);
  if (!(r.ok && verified?.ok && isEnabled(verified.data) && getUrl(verified.data) === webhookUrl)) {
    const legacyPayload = {
      enabled: true,
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    };
    await fetch(`${root}/webhook/set/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(legacyPayload),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    verified = await findWebhook().catch(() => null);
  }
  const currentUrl = getUrl(verified?.data);
  const ok = Boolean(verified?.ok && isEnabled(verified?.data) && currentUrl === webhookUrl);
  return {
    ok,
    status: verified?.status || r.status,
    data: {
      enabled: isEnabled(verified?.data),
      events: Array.isArray(verified?.data?.events) ? verified.data.events : (Array.isArray(data?.events) ? data.events : []),
      urlConfigured: Boolean(currentUrl),
      verified: ok,
      previousResponse: data,
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
    const functionBaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
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

    const webhookUrl = `${functionBaseUrl.replace(/\/$/, "")}/functions/v1/evolution-webhook?token=${webhookToken}`;
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