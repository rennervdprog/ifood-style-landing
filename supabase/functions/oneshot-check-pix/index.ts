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
  const sql = `
CREATE OR REPLACE VIEW public.stores_public AS
SELECT id, name, slug, slug_aliases, image_url, category, categories, rating,
       is_open, force_closed, status, delivery_mode, own_delivery_fee,
       delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km,
       minimum_order_value, free_delivery_threshold, created_at, owner_id,
       address_cep, address_city, address_complement, address_neighborhood,
       address_number, address_reference, address_state, address_street,
       latitude, longitude, settings, platform_fee_split,
       preorder_enabled, preorder_minutes_before,
       pix_direto_enabled, pix_direto_key, pix_direto_key_type,
       pix_direto_beneficiary, pix_direto_instructions
FROM stores s
WHERE is_test = false OR is_test IS NULL;
GRANT SELECT ON public.stores_public TO anon, authenticated;
`;
  const out = await q(sql);
  const check = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores_public' AND column_name LIKE 'pix%';`);
  const pastelao = await q(`SELECT name, slug, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, settings->'accepted_payment_methods' as apm, settings->'accept_pix_online' as apo, settings->'accept_pix_machine' as apm2 FROM stores WHERE slug ILIKE '%pastelao%';`);
  return new Response(JSON.stringify({ out, check, pastelao }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
