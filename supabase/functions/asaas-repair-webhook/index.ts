import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  recreateIfNeeded: z.boolean().optional().default(true),
});

const WEBHOOK_URL = "https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/asaas-webhook";
const WEBHOOK_NAME = "Itasuper";
const EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const asaasRequest = async (baseUrl: string, key: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      access_token: key,
      "User-Agent": "ItaSuper-WebhookRepair/1.0",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep text response
  }
  return { response, data };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  const receivedToken = req.headers.get("asaas-access-token") || "";
  if (!expectedToken) return json({ ok: false, error: "ASAAS_WEBHOOK_TOKEN not configured" }, 500);
  if (receivedToken !== expectedToken) return json({ ok: false, error: "Unauthorized" }, 401);

  let parsedBody: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ ok: false, error: parsed.error.flatten().fieldErrors }, 400);
    parsedBody = parsed.data;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const key = Deno.env.get("ASAAS_API_KEY") || "";
  if (!key) return json({ ok: false, error: "ASAAS_API_KEY not configured" }, 500);

  const isProd = key.startsWith("$aact_prod_");
  const baseUrl = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

  const account = await asaasRequest(baseUrl, key, "/myAccount");
  if (!account.response.ok) {
    return json({ ok: false, error: "asaas_account_check_failed", details: account.data }, 502);
  }
  const accountEmail = (account.data as any)?.email || "financeiro@itasuper.com.br";

  const desiredPayload = {
    name: WEBHOOK_NAME,
    url: WEBHOOK_URL,
    email: accountEmail,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: expectedToken,
    sendType: "NON_SEQUENTIALLY",
    events: EVENTS,
  };

  const listed = await asaasRequest(baseUrl, key, "/webhooks?limit=100");
  if (!listed.response.ok) {
    return json({ ok: false, error: "asaas_webhook_list_failed", details: listed.data }, 502);
  }

  const webhooks = Array.isArray((listed.data as any)?.data) ? (listed.data as any).data : [];
  const current = webhooks.find((hook: any) => hook?.url === WEBHOOK_URL || String(hook?.name || "").toLowerCase() === WEBHOOK_NAME.toLowerCase());

  if (current?.id) {
    const updated = await asaasRequest(baseUrl, key, `/webhooks/${encodeURIComponent(current.id)}`, {
      method: "PUT",
      body: JSON.stringify(desiredPayload),
    });
    if (updated.response.ok) {
      return json({ ok: true, action: "updated", env: isProd ? "production" : "sandbox", webhook: updated.data });
    }
    if (!parsedBody.recreateIfNeeded) {
      return json({ ok: false, action: "update_failed", status: updated.response.status, details: updated.data }, 502);
    }
  }

  const created = await asaasRequest(baseUrl, key, "/webhooks", {
    method: "POST",
    body: JSON.stringify({ ...desiredPayload, name: `${WEBHOOK_NAME} API` }),
  });

  return json(
    {
      ok: created.response.ok,
      action: created.response.ok ? "created" : "create_failed",
      env: isProd ? "production" : "sandbox",
      webhook: created.data,
    },
    created.response.ok ? 200 : 502,
  );
});