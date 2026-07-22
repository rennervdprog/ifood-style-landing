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
  out.before = await q(`SELECT id, name, status FROM public.stores WHERE name ILIKE '%cantinho%silv%' OR name ILIKE '%silvia%';`);
  out.update = await q(`UPDATE public.stores SET status='inativo' WHERE name ILIKE '%cantinho%silv%' OR name ILIKE '%silvia%' RETURNING id, name, status;`);
  out.after = await q(`SELECT id, name, status FROM public.stores WHERE name ILIKE '%cantinho%silv%' OR name ILIKE '%silvia%';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});