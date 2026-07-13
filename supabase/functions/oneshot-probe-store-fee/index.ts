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
  const out: any = {};
  out.store_cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND (column_name ILIKE '%fee%' OR column_name ILIKE '%delivery%' OR column_name ILIKE '%km%' OR column_name='cep' OR column_name='address');`);
  out.pastelao = await q(`SELECT id, name, delivery_mode, delivery_fee, own_delivery_fee, delivery_fee_type, delivery_fee_base, delivery_base_km, delivery_fee_per_km, platform_fee_split FROM public.stores WHERE id='b97f3a1a-d558-41e5-b8a2-ebd65b5381b4';`);
  out.neigh_cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='neighborhood_fees';`);
  out.neigh_sample = await q(`SELECT * FROM public.neighborhood_fees LIMIT 5;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});