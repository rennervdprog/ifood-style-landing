const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.plan_templates = await run(`SELECT plan_type, monthly_fee, commission_rate, gmv_threshold, is_active, description FROM public.plan_templates ORDER BY monthly_fee;`);
  out.store_plans_agg = await run(`
    SELECT plan_type, COUNT(*) as n, MIN(monthly_fee) mn, MAX(monthly_fee) mx, AVG(monthly_fee)::numeric(10,2) avg_fee
    FROM public.store_plans WHERE is_active=true GROUP BY plan_type ORDER BY plan_type;
  `);
  out.store_plans_columns = await run(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='store_plans'
    AND (column_name ILIKE '%essencial%' OR column_name ILIKE '%upgrade%' OR column_name ILIKE '%lifetime%' OR column_name ILIKE '%threshold%' OR column_name ILIKE '%gmv%');
  `);
  out.essencial_sample = await run(`
    SELECT sp.plan_type, sp.monthly_fee, sp.essencial_upgrade_scheduled_at, sp.essencial_lifetime_free, s.name, s.slug
    FROM public.store_plans sp JOIN public.stores s ON s.id=sp.store_id
    WHERE sp.plan_type='fixed' AND sp.is_active=true ORDER BY sp.created_at DESC LIMIT 10;
  `);
  out.crons = await run(`SELECT jobname, schedule, active FROM cron.job WHERE jobname ILIKE '%essencial%' OR jobname ILIKE '%upgrade%' OR jobname ILIKE '%autonomy%';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});