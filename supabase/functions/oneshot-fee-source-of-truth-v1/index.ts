const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function run(q:string){
  const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},
    body:JSON.stringify({query:q})
  });
  return{status:r.status,body:JSON.parse(await r.text())};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:Record<string,unknown>={};

  // Drop old alias with different return type
  out.drop_alias = await run(`DROP FUNCTION IF EXISTS public.get_store_platform_split(uuid);`);

  // Recriar alias como JSONB
  out.alias = await run(`
CREATE OR REPLACE FUNCTION public.get_store_platform_split(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.compute_store_delivery_fee(_store_id);
$fn$;
GRANT EXECUTE ON FUNCTION public.get_store_platform_split(uuid) TO anon, authenticated, service_role;`);

  // Recriar view — mantendo ORDEM ORIGINAL das colunas existentes, adicionando novas ao final.
  // Precisa DROP + CREATE porque a ordem original tinha delivery_fee_type sem delivery_fee.
  out.drop_view = await run(`DROP VIEW IF EXISTS public.stores_public CASCADE;`);
  out.view = await run(`
CREATE VIEW public.stores_public
WITH (security_invoker = off) AS
SELECT
  s.id, s.name, s.slug, s.slug_aliases, s.image_url, s.category, s.categories,
  s.rating, s.is_open, s.force_closed, s.status,
  s.delivery_mode, s.own_delivery_fee, s.delivery_fee_type,
  s.delivery_base_km, s.delivery_fee_base, s.delivery_fee_per_km,
  s.minimum_order_value, s.free_delivery_threshold, s.created_at, s.owner_id,
  s.address_cep, s.address_city, s.address_complement, s.address_neighborhood,
  s.address_number, s.address_reference, s.address_state, s.address_street,
  s.latitude, s.longitude, s.settings, s.platform_fee_split,
  s.preorder_enabled, s.preorder_minutes_before,
  s.pix_direto_enabled, s.pix_direto_key, s.pix_direto_key_type,
  s.pix_direto_beneficiary, s.pix_direto_instructions,
  s.delivery_fee,
  s.estimated_delivery_time,
  sp.plan_type::text AS plan_type,
  sp.platform_delivery_split_override,
  COALESCE(sp.autonomy_lifetime_free, false) AS autonomy_lifetime_free
FROM stores s
LEFT JOIN LATERAL (
  SELECT plan_type, platform_delivery_split_override, autonomy_lifetime_free
  FROM public.store_plans
  WHERE store_id = s.id AND is_active = true
  ORDER BY started_at DESC LIMIT 1
) sp ON true
WHERE s.is_test = false OR s.is_test IS NULL;`);

  out.grant_view = await run(`GRANT SELECT ON public.stores_public TO anon, authenticated, service_role;`);

  out.verify = await run(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores_public' AND column_name IN ('plan_type','platform_delivery_split_override','autonomy_lifetime_free','delivery_fee','estimated_delivery_time');`);

  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
