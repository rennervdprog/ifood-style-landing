const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};
const WEBHOOK_URL = "https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/asaas-webhook";
const WEBHOOK_NAME = "Itasuper";
const EVENTS = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_DELETED",
  "TRANSFER_DONE",
  "TRANSFER_FAILED",
];

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const req2 = async (base: string, key: string, path: string, init: RequestInit = {}) => {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      access_token: key,
      "User-Agent": "ItaSuper-WebhookRepair/1.0",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  let d: unknown = t;
  try { d = t ? JSON.parse(t) : null; } catch {}
  return { r, d };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("ASAAS_API_KEY") || "";
  const token = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  if (!key) return j({ ok: false, error: "ASAAS_API_KEY not set" }, 500);
  if (!token) return j({ ok: false, error: "ASAAS_WEBHOOK_TOKEN not set" }, 500);
  const isProd = key.startsWith("$aact_prod_");
  const base = isProd ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

  const acc = await req2(base, key, "/myAccount");
  if (!acc.r.ok) return j({ ok: false, step: "myAccount", details: acc.d }, 502);
  const email = (acc.d as any)?.email || "financeiro@itasuper.com.br";

  const listed = await req2(base, key, "/webhooks?limit=100");
  if (!listed.r.ok) return j({ ok: false, step: "list", details: listed.d }, 502);
  const hooks = Array.isArray((listed.d as any)?.data) ? (listed.d as any).data : [];

  const payload = {
    name: WEBHOOK_NAME,
    url: WEBHOOK_URL,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: token,
    sendType: "SEQUENTIALLY",
    events: EVENTS,
  };

  const existing = hooks.find((h: any) =>
    h?.url === WEBHOOK_URL || String(h?.name || "").toLowerCase() === WEBHOOK_NAME.toLowerCase()
  );

  if (existing?.id) {
    const up = await req2(base, key, `/webhooks/${encodeURIComponent(existing.id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return j({ ok: up.r.ok, action: "updated", env: isProd ? "production" : "sandbox", before: existing, after: up.d }, up.r.ok ? 200 : 502);
  }

  const cr = await req2(base, key, "/webhooks", { method: "POST", body: JSON.stringify(payload) });
  return j({ ok: cr.r.ok, action: "created", env: isProd ? "production" : "sandbox", webhook: cr.d }, cr.r.ok ? 200 : 502);
});