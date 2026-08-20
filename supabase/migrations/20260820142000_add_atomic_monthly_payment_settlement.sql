-- Liquida mensalidade de forma atômica: transação, plano e comissão PDV.
-- Evita que uma falha posterior à confirmação deixe a cobrança como paga sem renovar
-- o plano ou baixar a comissão faturada.

CREATE OR REPLACE FUNCTION public.settle_monthly_subscription_payment(
  _transaction_id uuid,
  _settled_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  already_applied boolean,
  store_id uuid,
  pdv_commission_decremented numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.financial_transactions%ROWTYPE;
  v_plan_id uuid;
  v_pdv_billed numeric := 0;
  v_settled_at timestamptz;
  v_marker text;
BEGIN
  IF _transaction_id IS NULL THEN
    RAISE EXCEPTION 'transaction_id é obrigatório';
  END IF;

  SELECT *
  INTO v_tx
  FROM public.financial_transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  IF v_tx.transaction_kind <> 'commission_charge'::public.financial_transaction_type
     OR (v_tx.reference_code NOT LIKE '#MENS-%' AND v_tx.reference_code NOT LIKE '#ASSIN-%') THEN
    RAISE EXCEPTION 'A transação não é uma mensalidade';
  END IF;

  v_marker := COALESCE(v_tx.metadata ->> 'monthly_settlement_applied_at', '');
  IF v_tx.status = 'paid' AND v_marker <> '' THEN
    RETURN QUERY SELECT true, v_tx.store_id, 0::numeric;
    RETURN;
  END IF;

  SELECT id
  INTO v_plan_id
  FROM public.store_plans
  WHERE store_id = v_tx.store_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano ativo não encontrado para a loja';
  END IF;

  v_pdv_billed := GREATEST(0, COALESCE((v_tx.metadata ->> 'pdv_pending_billed')::numeric, 0));
  v_settled_at := COALESCE(v_tx.settled_at, _settled_at, now());

  UPDATE public.store_plans
  SET last_billed_at = v_settled_at,
      next_billing_date = v_settled_at + interval '30 days',
      last_billing_attempt_at = NULL,
      pdv_commission_pending = GREATEST(0, COALESCE(pdv_commission_pending, 0) - v_pdv_billed),
      updated_at = now()
  WHERE id = v_plan_id;

  UPDATE public.financial_transactions
  SET status = 'paid',
      settled_at = v_settled_at,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'monthly_settlement_applied_at', v_settled_at,
        'pdv_commission_decremented', v_pdv_billed
      )
  WHERE id = v_tx.id;

  RETURN QUERY SELECT false, v_tx.store_id, v_pdv_billed;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_monthly_subscription_payment(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_monthly_subscription_payment(uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.settle_monthly_subscription_payment(uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_monthly_subscription_payment(uuid, timestamptz) TO service_role;
