const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function run(query:string){
  const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},
    body:JSON.stringify({query})});
  return {status:r.status,body:await r.text()};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:any={};
  out.rpc=await run(`
    DROP FUNCTION IF EXISTS public.respond_essencial_upgrade(TEXT);
    DROP FUNCTION IF EXISTS public.respond_essencial_upgrade(TEXT, UUID);
    CREATE OR REPLACE FUNCTION public.respond_essencial_upgrade(_response TEXT, _store_id UUID DEFAULT NULL)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE
      v_user_id UUID := auth.uid();
      v_store_id UUID;
      v_plan_id UUID;
      v_plan_type TEXT;
      v_owner_id UUID;
      v_is_admin BOOLEAN := FALSE;
      v_fee NUMERIC;
    BEGIN
      IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','unauthorized'); END IF;
      IF _response NOT IN ('accepted','refused') THEN RETURN jsonb_build_object('error','invalid_response'); END IF;

      -- Evita cast inválido caso role seja ENUM sem 'super_admin'.
      SELECT EXISTS(
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
          AND role::text IN ('admin','super_admin')
      ) INTO v_is_admin;

      IF _store_id IS NOT NULL THEN
        SELECT s.id, s.owner_id, sp.id, sp.plan_type INTO v_store_id, v_owner_id, v_plan_id, v_plan_type
        FROM public.stores s JOIN public.store_plans sp ON sp.store_id=s.id AND sp.is_active=true
        WHERE s.id=_store_id LIMIT 1;
        IF v_plan_id IS NULL THEN RETURN jsonb_build_object('error','no_active_plan'); END IF;
        IF v_owner_id <> v_user_id AND NOT v_is_admin THEN RETURN jsonb_build_object('error','forbidden'); END IF;
      ELSE
        SELECT s.id, s.owner_id, sp.id, sp.plan_type INTO v_store_id, v_owner_id, v_plan_id, v_plan_type
        FROM public.stores s JOIN public.store_plans sp ON sp.store_id=s.id AND sp.is_active=true
        WHERE s.owner_id=v_user_id LIMIT 1;
        IF v_plan_id IS NULL THEN RETURN jsonb_build_object('error','no_active_plan'); END IF;
      END IF;
      IF _response='accepted' THEN
        v_fee := CASE v_plan_type WHEN 'autonomy' THEN 199.90 ELSE 89.90 END;
        UPDATE public.store_plans SET essencial_upgrade_response='accepted', essencial_upgrade_response_at=NOW(), monthly_fee=v_fee, updated_at=NOW() WHERE id=v_plan_id;
        UPDATE public.stores SET status='ativo', updated_at=NOW() WHERE id=v_store_id AND status='inativo';
        INSERT INTO public.admin_logs(action,metadata) VALUES('essencial_upgrade_accepted',jsonb_build_object('store_id',v_store_id,'plan_type',v_plan_type,'new_fee',v_fee,'user_id',v_user_id,'via_admin',(v_is_admin AND v_owner_id<>v_user_id)));
        RETURN jsonb_build_object('ok',true,'response','accepted','new_monthly_fee',v_fee);
      ELSE
        UPDATE public.store_plans SET essencial_upgrade_response='refused', essencial_upgrade_response_at=NOW(), updated_at=NOW() WHERE id=v_plan_id;
        UPDATE public.stores SET status='inativo', updated_at=NOW() WHERE id=v_store_id;
        INSERT INTO public.admin_logs(action,metadata) VALUES('store_suspended_upgrade_refused',jsonb_build_object('store_id',v_store_id,'plan_type',v_plan_type,'user_id',v_user_id,'via_admin',(v_is_admin AND v_owner_id<>v_user_id)));
        RETURN jsonb_build_object('ok',true,'response','refused','store_suspended',true);
      END IF;
    END; $$;
    GRANT EXECUTE ON FUNCTION public.respond_essencial_upgrade(TEXT, UUID) TO authenticated;
  `);
  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
