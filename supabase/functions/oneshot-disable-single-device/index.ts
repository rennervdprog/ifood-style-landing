// Desativa sistema de "conta acessada em outro dispositivo".
// - Dropa UNIQUE(user_id) em user_active_devices
// - Torna register_device_login e check_device_active no-ops
// - Limpa registros órfãos
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

  out.drop_unique = await run(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid='public.user_active_devices'::regclass AND contype='u'
      LOOP
        EXECUTE format('ALTER TABLE public.user_active_devices DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $$;
  `);

  out.truncate = await run(`TRUNCATE public.user_active_devices;`);

  out.fn_register = await run(`
    CREATE OR REPLACE FUNCTION public.register_device_login(_device_id text)
    RETURNS jsonb
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$ SELECT jsonb_build_object('registered', true, 'multi_device', true) $$;
  `);

  out.fn_check = await run(`
    CREATE OR REPLACE FUNCTION public.check_device_active(_device_id text)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$ SELECT true $$;
  `);

  out.verify = await run(`
    SELECT
      (SELECT count(*) FROM pg_constraint WHERE conrelid='public.user_active_devices'::regclass AND contype='u') AS unique_constraints,
      (SELECT public.check_device_active('any')) AS check_returns;
  `);

  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});