const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const out: Record<string, unknown> = {};
  out.plan_addons_exists = await q(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plan_addons') AS exists;`);
  out.plan_addons_rows = await q(`SELECT * FROM public.plan_addons;`);
  out.store_addons_all_policies = await q(`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='store_addons';`);
  out.addon_catalog_policies = await q(`SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname='public' AND tablename='addon_catalog';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
