// Runner: dispara baterias de teste no Supabase EXTERNO usando secrets do Lovable Cloud.
// Não usado em produção — utilitário do agente.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const CRON = Deno.env.get("EXTERNAL_CRON_SECRET") || Deno.env.get("CRON_SECRET")!;
  const E2E = Deno.env.get("E2E_ADMIN_SECRET") || "";

  const url = new URL(req.url);
  const only = url.searchParams.get("only");

  const results: Record<string, unknown> = {};

  async function callFn(name: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const r = await fetch(`${EXT_URL}/functions/v1/${name}`, {
      method: opts.method || "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${SVC}`,
        ...(opts.headers || {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await r.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return { status: r.status, ok: r.ok, data };
  }

  const tests: Record<string, () => Promise<unknown>> = {
    // 1 Asaas health
    asaas_health: () => callFn("asaas-health", { method: "GET", headers: { "x-cron-secret": CRON } }),
    // 2 reconcile-payments (cron)
    reconcile: () => callFn("reconcile-payments", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 3 finance-reconcile-snapshot
    finance_snapshot: () => callFn("finance-reconcile-snapshot", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 4 monthly-billing (cooldown deve impedir duplicada se já rodou)
    monthly_billing: () => callFn("monthly-billing", { method: "POST", headers: { "x-cron-secret": CRON } }),
    monthly_billing_replay: () => callFn("monthly-billing", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 5 auto-deactivate-stores
    auto_deactivate: () => callFn("auto-deactivate-stores", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 6 auto-charge-physical-fees
    auto_charge_physical: () => callFn("auto-charge-physical-fees", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 7 auto-withdraw-subaccounts
    auto_withdraw: () => callFn("auto-withdraw-subaccounts", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 8 partner-payout-cron
    partner_payout: () => callFn("partner-payout-cron", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 9 auto-payout-cron
    auto_payout: () => callFn("auto-payout-cron", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 10 auto-finalize-orders
    auto_finalize: () => callFn("auto-finalize-orders", { method: "POST", headers: { "x-cron-secret": CRON } }),
    // 11 e2e-pix-flow
    e2e_pix: () => callFn("e2e-pix-flow", { method: "POST", headers: { "x-e2e-secret": E2E } }),
    // 12 e2e-monthly-flow
    e2e_monthly: () => callFn("e2e-monthly-flow", { method: "POST", headers: { "x-e2e-secret": E2E } }),
    // 13 bypass deny check
    e2e_bypass_denied: () => callFn("e2e-pix-flow", { method: "POST" }),
  };

  const names = only ? only.split(",") : Object.keys(tests);
  for (const n of names) {
    const fn = tests[n];
    if (!fn) { results[n] = { error: "unknown test" }; continue; }
    try {
      const r = await fn();
      results[n] = r;
    } catch (e) {
      results[n] = { error: String(e) };
    }
  }

  return json({ ok: true, results });
});