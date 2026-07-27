const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function run(q:string){const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({query:q})});return{status:r.status,body:JSON.parse(await r.text())};}
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response(null,{headers:cors});const out:Record<string,unknown>={};
out.get_store_platform_fee_charge=await run(`SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_store_platform_fee_charge';`);
out.stores_public=await run(`SELECT pg_get_viewdef('public.stores_public', true);`);
out.store_plans_cols=await run(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='store_plans' ORDER BY ordinal_position;`);
out.stores_fee_cols=await run(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND (column_name LIKE '%fee%' OR column_name LIKE '%delivery%' OR column_name='platform_fee_split') ORDER BY column_name;`);
out.admin_settings=await run(`SELECT key, value FROM public.admin_settings WHERE key='delivery_fee_config';`);
out.compute_exists=await run(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('compute_store_delivery_fee','get_store_platform_split','get_store_platform_fee_charge','get_fixed_plan_platform_split');`);
return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});});
