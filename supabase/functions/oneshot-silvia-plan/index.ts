const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function q(sql:string){
  const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({query:sql})});
  return {status:r.status,body:await r.json().catch(()=>null)};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:any={};
  out.plan_cols=await q(`select column_name from information_schema.columns where table_schema='public' and table_name='store_plans'`);
  out.plan=await q(`select * from store_plans where store_id='e14a110c-f0a1-4b25-8a71-554a9705fefa'`);
  out.gmv=await q(`select coalesce(sum(total_price),0) as gmv, count(*) as n from orders where store_id='e14a110c-f0a1-4b25-8a71-554a9705fefa' and status in ('finalizado','entregue','concluido') and created_at > now() - interval '60 days'`);
  out.admin=await q(`select * from admin_settings where key ilike '%silvia%' or key ilike '%essencial%' or key ilike '%lifetime%'`);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
