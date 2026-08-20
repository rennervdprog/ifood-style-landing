-- Liquidação atômica para cobranças semanais de repasse/comissão.
-- Garante que uma confirmação PIX não marque a transação como paga sem baixar
-- o saldo financeiro e a comissão PDV correspondentes.

CREATE OR REPLACE FUNCTION public.settle_commission_charge_payment(
  _transaction_id uuid,
  _settled_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  already_applied boolean,
  store_id uuid,
  balance_decremented numeric,
  pdv_commission_decremented numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.financial_transactions%ROWTYPE;
  v_plan_type text;
  v_balance_billed numeric := 0;
  v_pdv_billed numeric := 0;
  v_settled_at timestamptz;
  v_marker text;
BEGIN
  IF _transaction_id IS NULL THEN
    RAISE EXCEPTION 'transaction_id é obrigatório';
  END IF;

  SELECT *
  INTO v_tx
  FROM public.financial_transactions AS ft
  WHERE ft.id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  IF v_tx.transaction_kind <> 'commission_charge'::public.financial_transaction_type
     OR v_tx.reference_code LIKE '#MENS-%'
     OR v_tx.reference_code LIKE '#ASSIN-%' THEN
    RAISE EXCEPTION 'A transação não é uma cobrança semanal de repasse';
  END IF;

  v_marker := COALESCE(v_tx.metadata ->> 'commission_settlement_applied_at', '');
  IF v_tx.status = 'paid' AND v_marker <> '' THEN
    RETURN QUERY SELECT true, v_tx.store_id, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT sp.plan_type
  INTO v_plan_type
  FROM public.store_plans AS sp
  WHERE sp.store_id = v_tx.store_id
    AND sp.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano ativo não encontrado para a loja';
  END IF;

  v_balance_billed := GREATEST(0, COALESCE((v_tx.metadata ->> 'balance_billed')::numeric, v_tx.amount, 0));
  v_pdv_billed := GREATEST(0, COALESCE((v_tx.metadata ->> 'pdv_pending_billed')::numeric, 0));
  v_settled_at := COALESCE(v_tx.settled_at, _settled_at, now());

  -- Esta RPC já bloqueia a linha de saldo e aplica a distribuição correta por plano.
  IF v_balance_billed > 0 THEN
    PERFORM public.reconcile_debit_store_balance(v_tx.store_id, v_balance_billed, v_plan_type);
  END IF;

  IF v_pdv_billed > 0 THEN
    UPDATE public.store_plans AS sp
    SET pdv_commission_pending = GREATEST(0, COALESCE(sp.pdv_commission_pending, 0) - v_pdv_billed),
        updated_at = now()
    WHERE sp.store_id = v_tx.store_id
      AND sp.is_active = true;
  END IF;

  UPDATE public.financial_transactions AS ft
  SET status = 'paid',
      settled_at = v_settled_at,
      metadata = COALESCE(ft.metadata, '{}'::jsonb) || jsonb_build_object(
        'commission_settlement_applied_at', v_settled_at,
        'balance_decremented', v_balance_billed,
        'pdv_commission_decremented', v_pdv_billed
      )
  WHERE ft.id = v_tx.id;

  RETURN QUERY SELECT false, v_tx.store_id, v_balance_billed, v_pdv_billed;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_commission_charge_payment(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_commission_charge_payment(uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.settle_commission_charge_payment(uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_commission_charge_payment(uuid, timestamptz) TO service_role;
