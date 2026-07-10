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
  const uid = 'a5248d00-2cbe-432a-8bb0-d6f60e734e7b';
  const out: Record<string, unknown> = {};
  out.user_stores = await q(`SELECT id, name, owner_id, plan_type FROM public.stores WHERE owner_id='${uid}';`);
  out.user_roles = await q(`SELECT * FROM public.user_roles WHERE user_id='${uid}';`);
  out.store_802 = await q(`SELECT id, name, owner_id, plan_type FROM public.stores WHERE id='802ce29a-3f2a-4bc8-8146-78028b31477b';`);
  out.session_c2 = await q(`SELECT * FROM public.pdv_sessions WHERE id='c2dd878b-c9ac-4194-94ea-8b036b813ad8';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
