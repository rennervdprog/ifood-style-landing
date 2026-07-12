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
  out.add_col = await run(`ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS essencial_lifetime_free BOOLEAN NOT NULL DEFAULT false;`);
  out.set_pastelao = await run(`
    UPDATE public.store_plans SET essencial_lifetime_free = true, essencial_upgrade_scheduled_at = NULL
    WHERE store_id IN (SELECT id FROM public.stores WHERE slug ILIKE 'pastelao-carioca%' OR name ILIKE 'pastel%carioca%');
  `);
  out.check = await run(`
    SELECT s.name, s.slug, sp.monthly_fee, sp.essencial_lifetime_free, sp.essencial_upgrade_scheduled_at
    FROM public.stores s JOIN public.store_plans sp ON sp.store_id = s.id
    WHERE s.slug ILIKE 'pastelao-carioca%' OR s.name ILIKE 'pastel%carioca%';
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
