const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function q(query:string){
  const r=await fetch(`https://api.supabase.com/v1/projects/${Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")}`,"Content-Type":"application/json"},
    body:JSON.stringify({query})});
  return {status:r.status,body:await r.text()};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:any={};
  out.stores_cols=await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name IN ('owner_id','user_id','owner_user_id');`);
  out.dudalanches=await q(`SELECT s.id, s.slug, s.status, s.owner_id, sp.id as plan_id, sp.plan_type, sp.is_active, sp.essencial_upgrade_response, sp.essencial_upgrade_scheduled_at, sp.monthly_fee FROM public.stores s LEFT JOIN public.store_plans sp ON sp.store_id=s.id AND sp.is_active=true WHERE s.slug LIKE '%dudalanches%';`);
  out.rpc_exists=await q(`SELECT proname, pg_get_function_identity_arguments(oid) as args, pg_get_functiondef(oid) as def FROM pg_proc WHERE proname='respond_essencial_upgrade';`);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
