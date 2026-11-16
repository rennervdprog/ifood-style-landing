-- Round 3 (E2E 15/11): dois defeitos latentes na RPC, mascarados pelo 22P02
-- do enum e revelados pelo re-teste do botão Aceitar:
-- 1) Checagem de admin: profiles.role é o enum partner_role
--    {cliente, lojista, motoboy, suporte, lojista_matriz, lojista_unidade},
--    sem 'admin' -> 22P02 em TODA chamada. Padrão do codebase (RLS + RPCs):
--    EXISTS em user_roles com role='admin' (app_role; 'super_admin' NÃO
--    existe no enum — nunca comparar 'super_admin' em SQL aqui).
-- 2) INSERTs em admin_logs usavam colunas inexistentes
--    (description, created_by, store_id, target_user_id, metadata) -> 42703
--    e rollback total (o INSERT é transacional na RPC). Schema real:
--    {admin_user_id, action, target_type, target_id, details}.
CREATE OR REPLACE FUNCTION public.respond_essencial_upgrade(_response text, _store_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
      v_user_id UUID := auth.uid();
      v_store_id UUID;
      v_plan_id UUID;
      v_plan_type TEXT;
      v_owner_id UUID;
      v_is_admin BOOLEAN := FALSE;
      v_fee NUMERIC;
      v_plan_key TEXT;
      v_scheduled_at TIMESTAMPTZ;
      v_existing_next_billing_date TIMESTAMPTZ;
    BEGIN
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
      END IF;
      IF _response NOT IN ('accepted','refused') THEN
        RAISE EXCEPTION 'Resposta inválida' USING ERRCODE = '22P02';
      END IF;
      IF _store_id IS NULL THEN
        SELECT id INTO v_store_id FROM public.stores WHERE owner_id = v_user_id LIMIT 1;
      ELSE
        v_store_id := _store_id;
      END IF;
      IF v_store_id IS NULL THEN
        RAISE EXCEPTION 'Loja não encontrada' USING ERRCODE = 'P0002';
      END IF;
      SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = v_store_id;
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'
      ) INTO v_is_admin;
      IF v_owner_id <> v_user_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Sem permissão para esta loja' USING ERRCODE = '42501';
      END IF;
      SELECT id, plan_type INTO v_plan_id, v_plan_type
      FROM public.store_plans WHERE store_id = v_store_id AND is_active = true;
      IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano não encontrado' USING ERRCODE = 'P0002';
      END IF;
      IF v_plan_type NOT IN ('fixed','autonomy') THEN
        RAISE EXCEPTION 'Plano não elegível para upgrade Essencial' USING ERRCODE = 'P0002';
      END IF;
      IF _response='accepted' THEN
        -- Fonte da verdade: plan_templates (mesma fonte da edge e do cron).
        v_plan_key := CASE WHEN v_plan_type = 'autonomy' THEN 'autonomy' ELSE 'fixed' END;
        SELECT pt.monthly_fee INTO v_fee FROM public.plan_templates pt WHERE pt.plan_key = v_plan_key LIMIT 1;
        v_fee := COALESCE(v_fee, CASE WHEN v_plan_key = 'autonomy' THEN 199.90 ELSE 89.90 END);
        SELECT sp.essencial_upgrade_scheduled_at, sp.next_billing_date
          INTO v_scheduled_at, v_existing_next_billing_date
          FROM public.store_plans sp WHERE sp.id = v_plan_id;
        UPDATE public.store_plans SET essencial_upgrade_response='accepted', essencial_upgrade_response_at=NOW(), monthly_fee=v_fee,
          -- 1ª cobrança NA DATA AGENDADA (cartão + Termos 6.1): o monthly-billing
          -- só fatura planos com next_billing_date nulo/passado. Se a data já
          -- passou (re-aceite), fatura na próxima rodada — correto.
          next_billing_date = COALESCE(v_scheduled_at, v_existing_next_billing_date, NOW()),
          updated_at=NOW() WHERE id=v_plan_id;
        UPDATE public.stores SET status='ativo' WHERE id=v_store_id AND status='inativo';
        INSERT INTO public.admin_logs(admin_user_id, action, target_type, target_id, details)
        VALUES (v_user_id, 'essencial_upgrade_accepted', 'store', v_store_id,
                jsonb_build_object('new_monthly_fee', v_fee, 'plan_type', v_plan_type, 'next_billing_date', COALESCE(v_scheduled_at, v_existing_next_billing_date, NOW()), 'owner_id', v_owner_id));
        RETURN jsonb_build_object('ok',true,'response','accepted','new_monthly_fee',v_fee);
      ELSE
        UPDATE public.store_plans SET essencial_upgrade_response='refused', essencial_upgrade_response_at=NOW(), updated_at=NOW() WHERE id=v_plan_id;
        UPDATE public.stores SET status='inativo' WHERE id=v_store_id;
        INSERT INTO public.admin_logs(admin_user_id, action, target_type, target_id, details)
        VALUES (v_user_id, 'essencial_upgrade_refused', 'store', v_store_id,
                jsonb_build_object('plan_type', v_plan_type, 'owner_id', v_owner_id));
        RETURN jsonb_build_object('ok',true,'response','refused');
      END IF;
    END; $function$;
