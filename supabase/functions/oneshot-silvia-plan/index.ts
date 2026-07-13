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
  out.owner_stores=await q(`select id,name,plan_type from stores where owner_id='91031f23-bde5-4632-8ac4-b7604941a431'`);
  out.owner_plans=await q(`select sp.store_id, s.name, sp.plan_type, sp.monthly_fee, sp.is_active, sp.essencial_lifetime_free, sp.essencial_upgrade_scheduled_at, sp.essencial_upgrade_notified_at from store_plans sp join stores s on s.id=sp.store_id where s.owner_id='91031f23-bde5-4632-8ac4-b7604941a431'`);
  out.wa_history=await q(`select created_at, kind, phone, store_id, substring(message,1,120) as msg from platform_whatsapp_history where phone in (select whatsapp_number from profiles where user_id='91031f23-bde5-4632-8ac4-b7604941a431') order by created_at desc limit 10`);
  out.logs=await q(`select created_at, action, metadata from admin_logs where action ilike '%upgrade%' and metadata::text ilike '%silvia%' order by created_at desc limit 10`);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
