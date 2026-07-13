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
  out.cols=await q(`select column_name from information_schema.columns where table_schema='public' and table_name='stores' and (column_name ilike '%essencial%' or column_name ilike '%upgrade%' or column_name ilike '%lifetime%' or column_name ilike '%autonomia%')`);
  out.store=await q(`select * from stores where name ilike '%cantinho%silvia%'`);
  out.ordercols=await q(`select column_name from information_schema.columns where table_schema='public' and table_name='orders' and (column_name ilike '%total%' or column_name ilike '%valor%' or column_name ilike '%amount%')`);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
