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
  out.recent_sessions = await q(`SELECT id, store_id, status, opened_at, closed_at FROM public.pdv_sessions ORDER BY opened_at DESC LIMIT 10;`);
  out.recent_movements = await q(`SELECT id, session_id, store_id, type, amount, payment_method, created_at FROM public.pdv_movements ORDER BY created_at DESC LIMIT 15;`);
  out.recent_pdv_orders = await q(`SELECT id, store_id, pdv_session_id, order_source, status, total_price, created_at FROM public.orders WHERE order_source='pdv' ORDER BY created_at DESC LIMIT 15;`);
  out.rls_pdv_movements = await q(`SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr FROM pg_policy WHERE polrelid='public.pdv_movements'::regclass;`);
  out.grants_pdv_movements = await q(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='pdv_movements';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
