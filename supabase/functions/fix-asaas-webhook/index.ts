import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WEBHOOK_URL = "https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/asaas-webhook";
const WEBHOOK_NAME = "Itasuper";
const EVENTS = [
  "PAYMENT_RECEIVED","PAYMENT_CONFIRMED","PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED","PAYMENT_DELETED","TRANSFER_DONE","TRANSFER_FAILED",
];

const j = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), {
  status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("ASAAS_API_KEY") || "";
  const token = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  if (!key || !token) return j({ ok: false, error: "missing ASAAS secrets" }, 500);
  const isProd = key.startsWith("$aact_prod_");
  const base = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

  const h = { accept: "application/json", "Content-Type": "application/json", access_token: key };
  const acc = await fetch(`${base}/myAccount`, { headers: h }).then((r) => r.json()).catch(() => ({}));
  const email = acc?.email || "financeiro@itasuper.com.br";

  const listed = await fetch(`${base}/webhooks?limit=100`, { headers: h }).then((r) => r.json()).catch(() => ({}));
  const hooks: any[] = Array.isArray(listed?.data) ? listed.data : [];

  const payload = {
    name: WEBHOOK_NAME, url: WEBHOOK_URL, email, enabled: true, interrupted: false,
    apiVersion: 3, authToken: token, sendType: "SEQUENTIALLY", events: EVENTS,
  };

  const existing = hooks.find((x) =>
    x?.url === WEBHOOK_URL || String(x?.name || "").toLowerCase() === WEBHOOK_NAME.toLowerCase()
  );

  if (existing?.id) {
    const up = await fetch(`${base}/webhooks/${encodeURIComponent(existing.id)}`, {
      method: "PUT", headers: h, body: JSON.stringify(payload),
    });
    const data = await up.json().catch(() => null);
    return j({ ok: up.ok, action: "updated", env: isProd ? "production" : "sandbox", before: existing, after: data }, up.ok ? 200 : 502);
  }
  const cr = await fetch(`${base}/webhooks`, { method: "POST", headers: h, body: JSON.stringify(payload) });
  const data = await cr.json().catch(() => null);
  return j({ ok: cr.ok, action: "created", env: isProd ? "production" : "sandbox", webhook: data }, cr.ok ? 200 : 502);
});