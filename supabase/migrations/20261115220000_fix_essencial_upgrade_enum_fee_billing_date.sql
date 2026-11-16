-- Fix E2E GMV (15/11/2026): o fluxo de upgrade Essencial nunca funcionou em produção.
-- Bug 1: a RPC respond_essencial_upgrade e as edges respond-essencial-upgrade /
-- check-essencial-upgrade gravam status='inativo', mas o enum store_status só
-- tinha {analise, ativo, bloqueado} -> erro 22P02 em Aceitar E Recusar.
-- Decisão (com evidência): ADICIONAR 'inativo' ao enum, e NÃO trocar por
-- 'bloqueado'. 'bloqueado' é o bloqueio de REPASSE: o TrialExpiredGuard
-- renderiza tela cheia de quitação e esconde o painel, então o lojista jamais
-- alcançaria o botão "Aceitar mensalidade e reativar loja". 'inativo' é
-- invisível na vitrine/catálogo público, bloqueia novos pedidos
-- (create_order_with_items exige status='ativo'), não reativa por webhook
-- de repasse e deixa o painel alcançável.
-- ATENÇÃO: ALTER TYPE ... ADD VALUE não roda dentro de bloco de transação.
-- Aplicar esta statement isolada (sbq2 / SQL editor), antes da RPC abaixo.
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'inativo';

-- Bug 2 + Bug 3: RPC versionada (antes só existia no banco, sem fonte).
-- Bug 2: a taxa era gravada (180 / 239,90); agora lê plan_templates
-- (89,90 fixed / 199,90 autonomy), com fallback idêntico ao da edge/cron.
-- Bug 3: no aceite, next_billing_date = essencial_upgrade_scheduled_at, então
-- a 1ª cobrança cai NA DATA AGENDADA, como prometem o cartão e os Termos 6.1
-- (o monthly-billing só fatura planos com next_billing_date nulo/passado).
-- Se a data já passou (re-aceite), fatura na próxima rodada — correto.
-- Se não houver data agendada, preserva next_billing_date existente, ou NOW().
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
        SELECT 1 FROM public.profiles WHERE id = v_user_id AND role IN ('admin','super_admin')
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
          next_billing_date = COALESCE(v_scheduled_at, v_existing_next_billing_date, NOW()),
          updated_at=NOW() WHERE id=v_plan_id;
        UPDATE public.stores SET status='ativo', updated_at=NOW() WHERE id=v_store_id AND status='inativo';
        INSERT INTO public.admin_logs(action, description, created_by, store_id, target_user_id, metadata)
        VALUES ('essencial_upgrade_accepted', 'Lojista aceitou upgrade Essencial (GMV 60d acima do limite)', v_user_id, v_store_id, v_owner_id,
                jsonb_build_object('new_monthly_fee', v_fee, 'plan_type', v_plan_type, 'next_billing_date', COALESCE(v_scheduled_at, v_existing_next_billing_date, NOW())));
        RETURN jsonb_build_object('ok',true,'response','accepted','new_monthly_fee',v_fee);
      ELSE
        UPDATE public.store_plans SET essencial_upgrade_response='refused', essencial_upgrade_response_at=NOW(), updated_at=NOW() WHERE id=v_plan_id;
        UPDATE public.stores SET status='inativo', updated_at=NOW() WHERE id=v_store_id;
        INSERT INTO public.admin_logs(action, description, created_by, store_id, target_user_id, metadata)
        VALUES ('essencial_upgrade_refused', 'Lojista recusou upgrade Essencial — loja suspensa (GMV 60d acima do limite)', v_user_id, v_store_id, v_owner_id,
                jsonb_build_object('plan_type', v_plan_type));
        RETURN jsonb_build_object('ok',true,'response','refused');
      END IF;
    END; $function$;
