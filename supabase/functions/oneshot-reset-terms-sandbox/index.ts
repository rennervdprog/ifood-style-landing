const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function q(query:string){
  const r=await fetch(`https://api.supabase.com/v1/projects/${Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")}`,"Content-Type":"application/json"},
    body:JSON.stringify({query})});
  return {status:r.status,body:await r.text()};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const email="e2e-delivery@itasuper.test";
  const out:any={};
  out.before=await q(`SELECT user_id, email, terms_version_accepted, privacy_version_accepted FROM public.profiles WHERE email='${email}';`);
  out.reset=await q(`UPDATE public.profiles SET terms_version_accepted=NULL, privacy_version_accepted=NULL WHERE email='${email}' RETURNING user_id;`);
  out.del_acceptance=await q(`DELETE FROM public.terms_acceptance WHERE user_id IN (SELECT user_id FROM public.profiles WHERE email='${email}');`);
  out.after=await q(`SELECT user_id, email, terms_version_accepted, privacy_version_accepted FROM public.profiles WHERE email='${email}';`);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});