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
  out.store=await q(`select id,name,plan_type,essencial_lifetime_free,essencial_trigger_reached_at,essencial_paid_starts_at,essencial_upgrade_consent,created_at from stores where name ilike '%cantinho%silvia%'`);
  out.gmv60=await q(`select coalesce(sum(total),0) as gmv, count(*) as n from orders where store_id='e14a110c-f0a1-4b25-8a71-554a9705fefa' and status in ('finalizado','entregue','concluido') and created_at > now() - interval '60 days'`);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
