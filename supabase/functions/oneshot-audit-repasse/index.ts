const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function run(q:string){
  const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},
    body:JSON.stringify({query:q})
  });
  const text=await r.text();
  try{return{status:r.status,body:JSON.parse(text)};}catch{return{status:r.status,body:text};}
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:Record<string,unknown>={};

  out.functions_check = await run(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND proname IN ('compute_store_delivery_fee','get_store_platform_split','get_fixed_plan_platform_split','driver_finish_delivery','client_confirm_delivery') ORDER BY proname;`);
  out.orders_triggers = await run(`SELECT trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE event_object_schema='public' AND event_object_table='orders';`);

  out.recent_delivered = await run(`
    SELECT o.id AS order_id, s.slug, s.name AS store_name,
      s.delivery_mode, s.own_delivery_fee AS store_own_fee, s.platform_fee_split,
      sp.plan_type, sp.platform_delivery_split_override, sp.autonomy_lifetime_free,
      o.status AS order_status, o.subtotal, o.delivery_fee AS order_delivery_fee, o.total_price,
      o.driver_id, o.payment_method, o.created_at,
      sde.fee_total AS earning_fee_total, sde.platform_cut AS earning_platform_cut,
      sde.driver_amount AS earning_driver_amount, sde.status AS earning_status,
      (public.compute_store_delivery_fee(s.id)) AS expected_fee
    FROM public.orders o
    JOIN public.stores s ON s.id=o.store_id
    LEFT JOIN LATERAL (
      SELECT plan_type::text, platform_delivery_split_override, autonomy_lifetime_free
      FROM public.store_plans WHERE store_id=s.id AND is_active=true
      ORDER BY started_at DESC LIMIT 1
    ) sp ON true
    LEFT JOIN public.store_driver_earnings sde ON sde.order_id=o.id
    WHERE o.status IN ('entregue','finalizado')
      AND o.created_at > now() - interval '30 days'
    ORDER BY o.created_at DESC LIMIT 15;`);

  out.earnings_coverage = await run(`
    SELECT COUNT(*) FILTER (WHERE sde.id IS NOT NULL) AS with_earning,
           COUNT(*) FILTER (WHERE sde.id IS NULL) AS without_earning,
           COUNT(*) AS total_delivered_30d
    FROM public.orders o LEFT JOIN public.store_driver_earnings sde ON sde.order_id=o.id
    WHERE o.status IN ('entregue','finalizado') AND o.created_at > now() - interval '30 days';`);

  out.split_divergence = await run(`
    SELECT s.slug, s.name,
      public.get_fixed_plan_platform_split(s.id) AS old_split,
      (public.compute_store_delivery_fee(s.id))->>'platform_split_full' AS new_split_full,
      (public.compute_store_delivery_fee(s.id))->>'platform_add_customer' AS new_cust_add,
      (public.compute_store_delivery_fee(s.id))->>'platform_add_payout_deduction' AS new_payout_deduct,
      (public.compute_store_delivery_fee(s.id))->>'customer_total' AS new_cust_total
    FROM public.stores s WHERE s.slug IN ('dudalanchesteste','pastelao-carioca','aguia-pizzaria','ricburguer','rennerpdv') LIMIT 10;`);

  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
