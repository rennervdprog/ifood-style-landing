const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const out: Record<string, unknown> = {};

  out.addon_catalog_rows = (await q(`SELECT code, name, monthly_price, is_active FROM public.addon_catalog ORDER BY code;`)).body;

  out.store_addons_columns = (await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='store_addons'
    ORDER BY ordinal_position;`)).body;

  out.store_addons_constraints = (await q(`
    SELECT conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='store_addons';`)).body;

  out.store_addons_policies = (await q(`
    SELECT policyname, cmd, roles::text, qual, with_check
    FROM pg_policies WHERE schemaname='public' AND tablename='store_addons';`)).body;

  out.store_addons_grants = (await q(`
    SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='store_addons'
    GROUP BY grantee ORDER BY grantee;`)).body;

  out.addon_catalog_grants = (await q(`
    SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='addon_catalog'
    GROUP BY grantee ORDER BY grantee;`)).body;

  out.rls_enabled = (await q(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relname IN ('store_addons','addon_catalog');`)).body;

  out.addons_module_flag = (await q(`SELECT key, value FROM public.admin_settings WHERE key='addons_module_enabled';`)).body;

  out.plan_pdv_only = (await q(`SELECT plan_type, name, monthly_price, is_active FROM public.plan_templates WHERE plan_type='pdv_only';`)).body;

  out.legacy_pdv_count = (await q(`SELECT count(*) FROM public.stores WHERE legacy_pdv=true;`)).body;

  out.pdv_only_stores = (await q(`SELECT count(*) FROM public.stores WHERE plan_type='pdv_only';`)).body;

  out.store_addons_summary = (await q(`
    SELECT addon_code, count(*) FILTER (WHERE enabled=true) AS enabled_count, count(*) AS total
    FROM public.store_addons GROUP BY addon_code;`)).body;

  out.fk_store_addons_addon = (await q(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
    WHERE tc.table_schema='public' AND tc.table_name='store_addons' AND tc.constraint_type='FOREIGN KEY';`)).body;

  return json(out);
});
