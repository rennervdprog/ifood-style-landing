import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type" };
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const URL_=Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const ANON=Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
  const c=createClient(URL_,ANON,{auth:{persistSession:false}});
  const {data,error}=await c.auth.signInWithPassword({email:"e2e-admin@itasuper.test",password:"Boutique#2026"});
  if(error) return new Response(JSON.stringify({error:error.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  return new Response(JSON.stringify({url:URL_,session:data.session}),{headers:{...cors,"Content-Type":"application/json"}});
});
