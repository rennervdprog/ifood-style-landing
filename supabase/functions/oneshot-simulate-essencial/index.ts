const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
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
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "inject";
  const slug = url.searchParams.get("slug") || "dudalanchesteste";
  const out: Record<string, unknown> = { action, slug };

  if (action === "inject") {
    out.cols = await run(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position;`);
    out.plan_cols = await run(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='store_plans' ORDER BY ordinal_position;`);
    out.clear_vip = await run(`
      UPDATE public.store_plans sp
      SET essencial_lifetime_free = false,
          pix_operational_fee_override = NULL,
          platform_delivery_split_override = NULL,
          commission_rate = 0,
          trial_ends_at = NULL
      FROM public.stores s
      WHERE sp.store_id = s.id AND s.slug ILIKE '${slug}%';
    `);
    out.reset_plan = await run(`
      UPDATE public.store_plans sp
      SET essencial_upgrade_scheduled_at = NULL,
          essencial_upgrade_response = NULL,
          essencial_upgrade_response_at = NULL,
          essencial_upgrade_notified_at = NULL,
          monthly_fee = 0,
          is_active = true
      FROM public.stores s
      WHERE sp.store_id = s.id AND s.slug ILIKE '${slug}%';
    `);
    out.set_essencial = await run(`
      UPDATE public.store_plans sp
      SET plan_type = 'fixed', monthly_fee = 0
      FROM public.stores s
      WHERE sp.store_id = s.id AND s.slug ILIKE '${slug}%' AND sp.is_active = true;
    `);
    out.inject_orders = await run(`
      WITH s AS (SELECT id FROM public.stores WHERE slug ILIKE '${slug}%' LIMIT 1)
      INSERT INTO public.orders (store_id, status, total_price, subtotal, delivery_fee, payment_method, neighborhood, address_details, created_at)
      SELECT s.id, 'entregue', 550, 500, 50, 'dinheiro', 'SIMULACAO', 'SIMULACAO',
             now() - (gs || ' days')::interval
      FROM s, generate_series(1, 10) gs;
    `);
    out.gmv_check = await run(`
      SELECT s.name, COUNT(o.*) AS pedidos, SUM(o.total_price) AS gmv
      FROM public.stores s
      LEFT JOIN public.orders o ON o.store_id = s.id
        AND o.status IN ('entregue','finalizado')
        AND o.created_at > now() - interval '60 days'
      WHERE s.slug ILIKE '${slug}%'
      GROUP BY s.name;
    `);
  } else if (action === "trigger-cron") {
    // dispara o cron manualmente
    const base = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
    const r = await fetch(`${base}/functions/v1/check-essencial-upgrade`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" }, body: "{}",
    });
    out.cron = { status: r.status, body: await r.text() };
    out.plan_state = await run(`
      SELECT s.name, sp.plan_type, sp.monthly_fee, sp.essencial_upgrade_scheduled_at, sp.essencial_upgrade_response
      FROM public.stores s JOIN public.store_plans sp ON sp.store_id = s.id AND sp.is_active = true
      WHERE s.slug ILIKE '${slug}%';
    `);
  } else if (action === "cleanup") {
    out.del_orders = await run(`
      DELETE FROM public.orders
      WHERE store_id IN (SELECT id FROM public.stores WHERE slug ILIKE '${slug}%')
        AND neighborhood = 'SIMULACAO' AND total_price = 550;
    `);
    out.reset = await run(`
      UPDATE public.store_plans sp
      SET essencial_upgrade_scheduled_at = NULL,
          essencial_upgrade_response = NULL,
          essencial_upgrade_response_at = NULL,
          essencial_upgrade_notified_at = NULL
      FROM public.stores s
      WHERE sp.store_id = s.id AND s.slug ILIKE '${slug}%';
    `);
  }

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});