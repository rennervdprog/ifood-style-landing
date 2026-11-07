-- Fase 4 do pacote Repasse (2026-11-07) — JÁ APLICADA em produção via
-- Management API; este arquivo versiona a mudança no repositório.
--
-- 1) Estado financeiro ÚNICO da loja: get_store_billing_state(uuid)
--    Soma repasse + comissão conforme o plano E a taxa do PDV pendente
--    (mesma regra do hook web usePendingRepasse e de repasse-policy:
--    mínimo de cobrança R$ 150, teto de bloqueio R$ 500) e informa se a
--    loja pode reativar (sem cobranças de comissão pendentes e total
--    abaixo do teto). Consumidor: woovi-webhook (reativação pós-pagamento).
-- 2) Aposenta enforce_store_balance_lock(): função de trigger DORMENTE
--    (nenhum trigger a chamava; lia stores.partial_lock_status, NULL em
--    todas as lojas). O bloqueio vigente é o de billing_blocked_at.
CREATE OR REPLACE FUNCTION public.get_store_billing_state(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := COALESCE(auth.role(), '');
  v_status text;
  v_blocked_at timestamptz;
  v_block_reason text;
  v_repasse numeric := 0;
  v_comissao numeric := 0;
  v_pdv numeric := 0;
  v_plan_type text := 'commission_only';
  v_split numeric := 0;
  v_comissao_eff numeric := 0;
  v_total numeric := 0;
  v_pending_commission integer := 0;
  v_pending_rep integer := 0;
  v_pending_mens integer := 0;
  v_oldest_rep timestamptz;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'store_id é obrigatório';
  END IF;

  -- Acesso: service_role (edge functions), o dono da loja ou admin da plataforma.
  IF v_role = 'service_role' THEN
    NULL;
  ELSIF v_uid IS NOT NULL AND (public.is_store_owner(v_uid, p_store_id) OR public.is_platform_admin(v_uid)) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT s.status, s.billing_blocked_at, s.billing_block_reason
    INTO v_status, v_blocked_at, v_block_reason
    FROM public.stores s
   WHERE s.id = p_store_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_repasse := COALESCE((SELECT b.repasse_pendente FROM public.store_balances b WHERE b.store_id = p_store_id), 0);
  v_comissao := COALESCE((SELECT b.comissao_pendente FROM public.store_balances b WHERE b.store_id = p_store_id), 0);

  SELECT sp.plan_type, COALESCE(sp.pdv_commission_pending, 0)
    INTO v_plan_type, v_pdv
    FROM public.store_plans sp
   WHERE sp.store_id = p_store_id AND sp.is_active = true
   LIMIT 1;
  v_plan_type := COALESCE(v_plan_type, 'commission_only');
  v_pdv := COALESCE(v_pdv, 0);

  -- Mesma regra do usePendingRepasse (web) e do backend de cobrança.
  v_split := CASE WHEN v_plan_type IN ('fixed', 'supporter', 'hybrid') THEN v_repasse ELSE 0 END;
  v_comissao_eff := CASE WHEN v_plan_type IN ('commission_only', 'hybrid') THEN v_comissao ELSE 0 END;
  v_total := round(v_split + v_comissao_eff + v_pdv, 2);

  SELECT count(*),
         count(*) FILTER (WHERE ft.reference_code LIKE '#REP-%'),
         count(*) FILTER (WHERE ft.reference_code LIKE '#MENS-%' OR ft.reference_code LIKE '#ASSIN-%'),
         min(ft.created_at) FILTER (WHERE ft.reference_code LIKE '#REP-%')
    INTO v_pending_commission, v_pending_rep, v_pending_mens, v_oldest_rep
    FROM public.financial_transactions ft
   WHERE ft.store_id = p_store_id
     AND ft.transaction_kind = 'commission_charge'
     AND ft.status = 'pending';

  RETURN jsonb_build_object(
    'store_id', p_store_id,
    'status', v_status,
    'billing_blocked_at', v_blocked_at,
    'billing_block_reason', v_block_reason,
    'is_blocked', v_status = 'bloqueado',
    'plan_type', v_plan_type,
    'repasse_pendente', v_repasse,
    'comissao_pendente', v_comissao,
    'pdv_commission_pending', v_pdv,
    'split_entrega', v_split,
    'comissao_efetiva', v_comissao_eff,
    'total_pendente', v_total,
    'atingiu_minimo_cobranca', v_total >= 150,
    'acima_do_teto', v_total >= 500,
    'pode_reativar', (v_pending_commission = 0 AND v_total < 500),
    'pending_commission_charges', v_pending_commission,
    'pending_repasse_charges', v_pending_rep,
    'pending_mensalidade_charges', v_pending_mens,
    'oldest_pending_repasse_at', v_oldest_rep
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_store_billing_state(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_store_billing_state(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_store_billing_state(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_store_billing_state(uuid) IS
  'Fase 4 (pacote Repasse): estado financeiro único da loja — totais por plano + PDV, teto de R$ 500 e pode_reativar. Espelha usePendingRepasse (web) e repasse-policy.';

DROP FUNCTION IF EXISTS public.enforce_store_balance_lock();
