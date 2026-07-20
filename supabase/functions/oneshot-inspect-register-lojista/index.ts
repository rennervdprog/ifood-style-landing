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
  out.enum = await run(`SELECT enum_range(NULL::store_plan_type)::text as vals;`);
  out.reg = await run(`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='register_as_lojista';`);
  out.trg = await run(`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_user';`);
  out.templates = await run(`SELECT plan_type::text, monthly_fee, commission_rate, is_active FROM plan_templates ORDER BY plan_type;`);
  out.stores = await run(`SELECT s.id, s.name, s.plan_type::text as store_plan_type, s.is_visible, sp.plan_type::text as sp_plan, sp.pdv_enabled, s.owner_id, s.created_at FROM stores s LEFT JOIN store_plans sp ON sp.store_id=s.id AND sp.is_active WHERE s.name ILIKE '%renner%' OR s.name ILIKE '%pdv%' ORDER BY s.created_at DESC LIMIT 20;`);
  out.recent_lojistas = await run(`SELECT u.email, u.raw_user_meta_data->>'selected_plan' as sel, u.raw_user_meta_data->>'store_name' as sname, u.created_at FROM auth.users u WHERE (u.raw_user_meta_data->>'role')='lojista' ORDER BY u.created_at DESC LIMIT 10;`);
  out.triggers = await run(`SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.stores'::regclass AND NOT tgisinternal;`);
  out.trg_fns = await run(`SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('create_default_store_plan','ensure_store_plan','stores_default_plan','set_default_store_plan');`);
  out.force_auto = await run(`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='force_store_auto_approve';`);
  out.auth_trg = await run(`SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal;`);
  out.all_new_lojista = await run(`SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE prosrc ILIKE '%selected_plan%' AND proname LIKE 'handle%';`);
  out.plan_change_reqs = await run(`SELECT * FROM plan_change_requests WHERE store_id='363c52e2-6477-4aae-89df-6ad8224e5c71' ORDER BY created_at DESC;`);
  out.audit_store = await run(`SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name IN ('plan_type','is_visible','delivery_mode');`);
  out.addons = await run(`SELECT * FROM store_addons WHERE store_id='363c52e2-6477-4aae-89df-6ad8224e5c71';`);
  out.plan_row = await run(`SELECT sp.*, s.created_at as store_ts FROM store_plans sp JOIN stores s ON s.id=sp.store_id WHERE sp.store_id='363c52e2-6477-4aae-89df-6ad8224e5c71';`);
  out.all_lojista_rpcs = await run(`SELECT proname FROM pg_proc WHERE prosrc ILIKE '%register_as_lojista%' OR prosrc ILIKE '%INSERT INTO % store_plans%';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});