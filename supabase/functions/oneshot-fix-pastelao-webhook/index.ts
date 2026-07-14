import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const parseJson = async (r: Response) => r.json().catch(() => ({}));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const functionBaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL");
    if (!baseUrl || !apiKey || !functionBaseUrl || !webhookToken) {
      return json({ error: "missing_config" }, 500);
    }

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id,name")
      .ilike("name", "%pastel%carioca%")
      .maybeSingle();
    if (storeError || !store) return json({ error: "store_not_found", details: storeError?.message }, 404);

    const instance = `store-${String(store.id).slice(0, 8)}`;
    const webhookUrl = `${functionBaseUrl}/functions/v1/evolution-webhook?token=${webhookToken}`;
    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
      },
    };

    const setRes = await fetch(`${baseUrl}/webhook/set/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload),
    });
    const setBody = await parseJson(setRes);

    const findRes = await fetch(`${baseUrl}/webhook/find/${instance}`, { headers: { apikey: apiKey } });
    const found = await parseJson(findRes);

    return json({
      success: setRes.ok,
      store: store.name,
      instance,
      setStatus: setRes.status,
      webhook: {
        enabled: Boolean(found?.enabled ?? setBody?.enabled),
        urlConfigured: Boolean(found?.url ?? setBody?.url),
        events: Array.isArray(found?.events) ? found.events : (Array.isArray(setBody?.events) ? setBody.events : []),
      },
    }, setRes.ok ? 200 : 502);
  } catch (e) {
    console.error("oneshot-fix-pastelao-webhook error", e);
    return json({ error: "internal_error", message: String((e as any)?.message || e) }, 500);
  }
});