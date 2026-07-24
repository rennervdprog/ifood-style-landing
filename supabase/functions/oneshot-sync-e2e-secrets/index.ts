const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type" };
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const payload = [
    { name:"E2E_TEST_EMAIL", value:"e2e-admin@itasuper.test" },
    { name:"E2E_TEST_PASSWORD", value:"Boutique#2026" },
    { name:"E2E_SETUP_TOKEN", value: Deno.env.get("E2E_SETUP_TOKEN")! },
  ];
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`,{
    method:"POST",
    headers:{ Authorization:`Bearer ${PAT}`, "Content-Type":"application/json" },
    body: JSON.stringify(payload),
  });
  return new Response(JSON.stringify({ status:r.status, body: await r.text() }), { headers:{...cors,"Content-Type":"application/json"} });
});