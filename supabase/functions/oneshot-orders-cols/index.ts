const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position;`);
  const sample = await q(`SELECT id, client_id, is_guest, delivery_address, payment_method, status FROM public.orders ORDER BY created_at DESC LIMIT 3;`);
  return new Response(JSON.stringify({ cols, sample }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
