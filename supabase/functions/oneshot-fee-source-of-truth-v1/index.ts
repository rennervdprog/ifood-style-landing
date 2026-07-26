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

  // 1) Nova RPC canônica: retorna JSON com todos os componentes.
  out.compute_fn = await run(`
CREATE OR REPLACE FUNCTION public.compute_store_delivery_fee(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _mode text; _split_mode text; _own numeric; _plat numeric;
  _override numeric; _plan_type text; _autonomy_free boolean;
  _base_split numeric; _split_full numeric;
  _base_fee numeric; _add_customer numeric; _deduct_payout numeric;
  _is_autonomy boolean;
BEGIN
  SELECT COALESCE(s.delivery_mode,'platform'),
         COALESCE(s.platform_fee_split,'cliente'),
         COALESCE(s.own_delivery_fee,0),
         COALESCE(s.delivery_fee,0)
    INTO _mode, _split_mode, _own, _plat
  FROM public.stores s WHERE s.id = _store_id;

  IF _mode IS NULL THEN
    RETURN jsonb_build_object('error','store_not_found');
  END IF;

  SELECT sp.platform_delivery_split_override,
         sp.plan_type::text,
         COALESCE(sp.autonomy_lifetime_free,false)
    INTO _override, _plan_type, _autonomy_free
  FROM public.store_plans sp
  WHERE sp.store_id = _store_id AND sp.is_active = true
  ORDER BY sp.started_at DESC LIMIT 1;

  _is_autonomy := (_plan_type = 'autonomy') OR COALESCE(_autonomy_free,false);

  -- Split base fixado em 0.99 (fonte da verdade admin_settings)
  IF _override IS NOT NULL THEN
    _base_split := _override;
  ELSE
    SELECT COALESCE(((value->>'platform_split')::numeric), 0.99)
      INTO _base_split
    FROM public.admin_settings WHERE key = 'delivery_fee_config' LIMIT 1;
    _base_split := COALESCE(_base_split, 0.99);
  END IF;

  -- Autonomy zera o split
  _split_full := CASE WHEN _is_autonomy THEN 0 ELSE _base_split END;

  IF _mode = 'pickup' THEN
    _base_fee := 0; _add_customer := 0; _deduct_payout := 0;
  ELSIF _mode = 'platform' THEN
    -- delivery_fee da plataforma já inclui split
    _base_fee := _plat; _add_customer := 0; _deduct_payout := 0;
  ELSE
    -- own delivery
    _base_fee := _own;
    IF _split_mode = 'cliente' THEN
      _add_customer := _split_full; _deduct_payout := 0;
    ELSIF _split_mode = 'meio_a_meio' THEN
      _add_customer := ROUND(_split_full / 2.0, 2);
      _deduct_payout := _split_full - _add_customer;
    ELSIF _split_mode = 'lojista' THEN
      _add_customer := 0; _deduct_payout := _split_full;
    ELSE
      _add_customer := _split_full; _deduct_payout := 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'base_fee', _base_fee,
    'platform_split_full', _split_full,
    'platform_add_customer', _add_customer,
    'platform_add_payout_deduction', _deduct_payout,
    'customer_total', _base_fee + _add_customer,
    'split_mode', _split_mode,
    'delivery_mode', _mode,
    'plan_type', COALESCE(_plan_type,'unknown'),
    'is_autonomy', _is_autonomy
  );
END $fn$;`);

  out.grant_compute = await run(`GRANT EXECUTE ON FUNCTION public.compute_store_delivery_fee(uuid) TO anon, authenticated, service_role;`);

  // 2) Wrapper: get_store_platform_fee_charge agora respeita autonomy + default 0.99
  out.wrapper = await run(`
CREATE OR REPLACE FUNCTION public.get_store_platform_fee_charge(_store_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE((public.compute_store_delivery_fee(_store_id)->>'platform_add_payout_deduction')::numeric, 0);
$fn$;`);

  // 3) Alias esperado pelo StorePage: get_store_platform_split
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

  // 4) Expõe plan_type + override na view stores_public (via LEFT JOIN em store_plans ativo)
  out.view = await run(`
CREATE OR REPLACE VIEW public.stores_public
WITH (security_invoker = on) AS
SELECT
  s.id, s.name, s.slug, s.slug_aliases, s.image_url, s.category, s.categories,
  s.rating, s.is_open, s.force_closed, s.status,
  s.delivery_mode, s.own_delivery_fee, s.delivery_fee, s.delivery_fee_type,
  s.delivery_base_km, s.delivery_fee_base, s.delivery_fee_per_km,
  s.estimated_delivery_time,
  s.minimum_order_value, s.free_delivery_threshold, s.created_at, s.owner_id,
  s.address_cep, s.address_city, s.address_complement, s.address_neighborhood,
  s.address_number, s.address_reference, s.address_state, s.address_street,
  s.latitude, s.longitude, s.settings, s.platform_fee_split,
  s.preorder_enabled, s.preorder_minutes_before,
  s.pix_direto_enabled, s.pix_direto_key, s.pix_direto_key_type,
  s.pix_direto_beneficiary, s.pix_direto_instructions,
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

  // 5) Smoke test
  out.test_pastelao = await run(`
SELECT s.name, s.own_delivery_fee, s.delivery_fee, s.delivery_mode, s.platform_fee_split,
       public.compute_store_delivery_fee(s.id) AS fee
FROM public.stores s
WHERE s.name ILIKE '%pastel%' OR s.name ILIKE '%guia%pizz%' OR s.name ILIKE '%ric%burg%'
LIMIT 5;`);

  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
