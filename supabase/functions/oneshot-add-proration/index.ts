const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.addon_first = await run(`ALTER TABLE public.store_addons ADD COLUMN IF NOT EXISTS first_charge_done BOOLEAN NOT NULL DEFAULT false;`);
  out.plan_credit = await run(`ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS billing_credit_cents INTEGER NOT NULL DEFAULT 0;`);
  out.pdv_only_at = await run(`ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS pdv_only_activated_at TIMESTAMPTZ;`);
  out.pdv_only_done = await run(`ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS pdv_only_first_charge_done BOOLEAN NOT NULL DEFAULT false;`);
  // Existing add-ons are considered already-billed to avoid retroactive proration.
  out.backfill_addons = await run(`UPDATE public.store_addons SET first_charge_done = true WHERE first_charge_done = false AND activated_at IS NOT NULL AND activated_at < now() - interval '35 days';`);
  // Existing pdv_only plans are treated as already past their first charge.
  out.backfill_pdv_only = await run(`UPDATE public.store_plans SET pdv_only_first_charge_done = true WHERE plan_type = 'pdv_only' AND pdv_only_activated_at IS NULL;`);
  out.check = await run(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('store_addons','store_plans') AND column_name IN ('first_charge_done','billing_credit_cents','pdv_only_activated_at','pdv_only_first_charge_done') ORDER BY table_name, column_name;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});