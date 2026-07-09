const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.recent_stores = await q(`SELECT id, name, slug, plan_type, is_visible, status, created_at FROM public.stores ORDER BY created_at DESC LIMIT 8;`);
  out.pdv_addons_recent = await q(`SELECT sa.store_id, s.name, sa.addon_code, sa.enabled, sa.price_override, sa.activated_at, sa.cancels_at FROM public.store_addons sa JOIN public.stores s ON s.id=sa.store_id ORDER BY sa.activated_at DESC NULLS LAST LIMIT 8;`);
  out.fn_signature = await q(`SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='admin_create_test_store';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});