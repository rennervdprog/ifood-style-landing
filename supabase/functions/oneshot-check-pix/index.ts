const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: any = {};
  out.columns = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name LIKE 'pix_direto%';`);
  out.pastelao = await q(`SELECT id, name, slug, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary FROM public.stores WHERE name ILIKE '%pastel%carioca%' OR slug ILIKE '%pastel%carioca%';`);
  out.stores_public_view_cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores_public' AND column_name LIKE 'pix%';`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
