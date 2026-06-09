-- A-1/A-2: RPC atômica para crédito de comissão pendente e débito proporcional no reconcile
CREATE OR REPLACE FUNCTION public.credit_store_commission(_store_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, updated_at)
  VALUES (_store_id, _amount, _amount, now())
  ON CONFLICT (store_id) DO UPDATE
  SET comissao_pendente = COALESCE(public.store_balances.comissao_pendente, 0) + EXCLUDED.comissao_pendente,
      pending_commission = COALESCE(public.store_balances.pending_commission, 0) + EXCLUDED.pending_commission,
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_debit_store_balance(
  _store_id uuid,
  _amount numeric,
  _plan_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep numeric := 0;
  v_com numeric := 0;
  v_pend numeric := 0;
  v_total numeric := 0;
  v_rep_share numeric := 0;
  v_com_share numeric := 0;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;

  SELECT COALESCE(repasse_pendente,0), COALESCE(comissao_pendente,0), COALESCE(pending_commission,0)
    INTO v_rep, v_com, v_pend
  FROM public.store_balances WHERE store_id = _store_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF _plan_type IN ('fixed','supporter') THEN
    UPDATE public.store_balances
      SET repasse_pendente = GREATEST(0, v_rep - _amount), updated_at = now()
      WHERE store_id = _store_id;
  ELSIF _plan_type = 'commission_only' THEN
    UPDATE public.store_balances
      SET comissao_pendente = GREATEST(0, v_com - _amount),
          pending_commission = GREATEST(0, v_pend - _amount),
          updated_at = now()
      WHERE store_id = _store_id;
  ELSE
    -- híbrido / desconhecido: débito proporcional entre repasse e comissão
    v_total := v_rep + v_com;
    IF v_total <= 0 THEN RETURN; END IF;
    v_rep_share := round((_amount * (v_rep / v_total))::numeric, 2);
    v_com_share := round((_amount - v_rep_share)::numeric, 2);
    UPDATE public.store_balances
      SET repasse_pendente = GREATEST(0, v_rep - v_rep_share),
          comissao_pendente = GREATEST(0, v_com - v_com_share),
          pending_commission = GREATEST(0, v_pend - v_com_share),
          updated_at = now()
      WHERE store_id = _store_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_store_commission(uuid, numeric) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_debit_store_balance(uuid, numeric, text) TO service_role, authenticated;