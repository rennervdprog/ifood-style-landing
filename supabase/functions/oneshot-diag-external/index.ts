const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SQL = `
SELECT 'stores.is_visible' AS check, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name='is_visible') AS ok
UNION ALL SELECT 'stores.plan_type', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name='plan_type')
UNION ALL SELECT 'stores.legacy_pdv', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name='legacy_pdv')
UNION ALL SELECT 'table store_addons', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='store_addons')
UNION ALL SELECT 'table addon_catalog', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='addon_catalog')
UNION ALL SELECT 'plan_templates.pdv_only', EXISTS(SELECT 1 FROM public.plan_templates WHERE plan_type='pdv_only')
UNION ALL SELECT 'admin_settings.addons_module_enabled', EXISTS(SELECT 1 FROM public.admin_settings WHERE key='addons_module_enabled')
UNION ALL SELECT 'rpc admin_create_test_store(_name,_category,_plan_type)', EXISTS(
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='admin_create_test_store'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%_plan_type%'
);
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return json({ status: resp.status, body: JSON.parse(await resp.text()) });
});
