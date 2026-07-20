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
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});