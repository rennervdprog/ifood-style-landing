-- Corrige a ambiguidade entre a coluna reference_code e o campo de retorno
-- da função de finalização de reserva de cobrança.

CREATE OR REPLACE FUNCTION public.finalize_commission_charge_reservation(
  _reservation_id uuid,
  _provider text,
  _provider_payment_id text,
  _pix_qr_code text,
  _pix_qr_code_base64 text,
  _pix_copy_paste text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  transaction_id uuid,
  reference_code text,
  amount numeric,
  status public.financial_transaction_status,
  provider_payment_id text,
  created_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.commission_charge_reservations%ROWTYPE;
  v_transaction public.financial_transactions%ROWTYPE;
  v_created boolean := false;
BEGIN
  IF _reservation_id IS NULL OR COALESCE(btrim(_provider), '') = ''
     OR COALESCE(btrim(_provider_payment_id), '') = ''
     OR COALESCE(btrim(_pix_copy_paste), '') = '' THEN
    RAISE EXCEPTION 'Dados inválidos para finalização de cobrança';
  END IF;

  SELECT * INTO v_reservation
  FROM public.commission_charge_reservations AS r
  WHERE r.id = _reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva de cobrança não encontrada';
  END IF;

  IF v_reservation.transaction_id IS NOT NULL THEN
    SELECT * INTO v_transaction
    FROM public.financial_transactions AS ft
    WHERE ft.id = v_reservation.transaction_id;

    RETURN QUERY SELECT
      v_transaction.id, v_transaction.reference_code, v_transaction.amount,
      v_transaction.status, v_transaction.mercado_pago_payment_id, false;
    RETURN;
  END IF;

  INSERT INTO public.financial_transactions (
    store_id, transaction_kind, reference_code, amount, status, provider,
    mercado_pago_payment_id, pix_qr_code, pix_qr_code_base64, pix_copy_paste,
    metadata
  ) VALUES (
    v_reservation.store_id,
    'commission_charge'::public.financial_transaction_type,
    v_reservation.reference_code,
    v_reservation.amount,
    'pending'::public.financial_transaction_status,
    _provider,
    _provider_payment_id,
    NULLIF(_pix_qr_code, ''),
    NULLIF(_pix_qr_code_base64, ''),
    _pix_copy_paste,
    COALESCE(v_reservation.metadata, '{}'::jsonb) || COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT ON CONSTRAINT financial_transactions_reference_code_key DO UPDATE
    SET updated_at = public.financial_transactions.updated_at
  RETURNING * INTO v_transaction;

  UPDATE public.commission_charge_reservations AS r
  SET transaction_id = v_transaction.id,
      state = 'finalized',
      finalized_at = now(),
      last_error = NULL,
      updated_at = now()
  WHERE r.id = v_reservation.id;

  v_created := true;
  RETURN QUERY SELECT
    v_transaction.id, v_transaction.reference_code, v_transaction.amount,
    v_transaction.status, v_transaction.mercado_pago_payment_id, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) TO service_role;
