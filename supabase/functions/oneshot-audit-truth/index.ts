import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
async function q(sql: string) {
  const { data, error } = await sb.rpc("exec_sql" as any, { sql });
  return error ? { error: error.message } : data;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out["plan_templates"] = await q(`SELECT name, plan_type, monthly_fee, gmv_free_cap, commission_rate, is_active FROM public.plan_templates ORDER BY monthly_fee;`);
  out["resellers_bounty"] = await q(`SELECT count(*) AS total, min(bounty_amount_cents) AS min, max(bounty_amount_cents) AS max, avg(bounty_amount_cents)::int AS avg FROM public.resellers;`);
  out["resellers_bounty_distribution"] = await q(`SELECT bounty_amount_cents, count(*) FROM public.resellers GROUP BY 1 ORDER BY 1;`);
  out["resellers_commission_rate"] = await q(`SELECT commission_rate_bps, count(*) FROM public.resellers GROUP BY 1 ORDER BY 1;`);
  out["reseller_defaults"] = await q(`SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='resellers' AND column_name IN ('bounty_amount_cents','commission_rate_bps','min_withdraw_cents','min_delivered_orders_for_bounty');`);
  out["store_plans_active"] = await q(`SELECT plan_type, count(*), sum(monthly_fee)::numeric AS mrr FROM public.store_plans WHERE is_active=true GROUP BY plan_type ORDER BY plan_type;`);
  out["admin_settings"] = await q(`SELECT key, value FROM public.admin_settings WHERE key ILIKE ANY(ARRAY['%bounty%','%commission%','%plan%','%reseller%','%mrr%','%gmv%','%fee%']) ORDER BY key;`);
  out["cron_reseller"] = await q(`SELECT jobname, schedule, active FROM cron.job WHERE jobname ILIKE '%reseller%' OR jobname ILIKE '%bounty%' ORDER BY jobname;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});