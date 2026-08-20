-- Reserva atômica e idempotência para emissão de cobranças semanais de repasse.
--
-- Uma linha única por (loja, chave de ciclo) é criada antes da chamada à
-- provedora. A mesma reference_code é reutilizada em retries, o que se alinha
-- ao correlationID idempotente da Woovi e elimina cobranças duplicadas por
-- concorrência, timeout ou reexecução do cron.

CREATE TABLE IF NOT EXISTS public.commission_charge_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  reference_code text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount >= 0),
  charge_family text NOT NULL,
  provider text NOT NULL,
  state text NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved', 'issuing', 'finalized')),
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_commission_charge_reservations_store_state
  ON public.commission_charge_reservations (store_id, state, created_at DESC);

ALTER TABLE public.commission_charge_reservations ENABLE ROW LEVEL SECURITY;

-- Reserva ou retorna a mesma cobrança lógica de forma serializada pela chave
-- única. Não expõe a tabela a clientes: somente Edge Functions com service_role.
CREATE OR REPLACE FUNCTION public.reserve_commission_charge_reservation(
  _store_id uuid,
  _idempotency_key text,
  _reference_code text,
  _amount numeric,
  _charge_family text,
  _provider text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  reservation_id uuid,
  reference_code text,
  amount numeric,
  charge_family text,
  provider text,
  state text,
  transaction_id uuid,
  metadata jsonb,
  created_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.commission_charge_reservations%ROWTYPE;
  v_created boolean := false;
BEGIN
  IF _store_id IS NULL OR COALESCE(btrim(_idempotency_key), '') = ''
     OR COALESCE(btrim(_reference_code), '') = '' OR _amount IS NULL
     OR _amount < 0 OR COALESCE(btrim(_charge_family), '') = ''
     OR COALESCE(btrim(_provider), '') = '' THEN
    RAISE EXCEPTION 'Dados inválidos para reserva de cobrança';
  END IF;

  INSERT INTO public.commission_charge_reservations (
    store_id, idempotency_key, reference_code, amount, charge_family,
    provider, metadata
  ) VALUES (
    _store_id, _idempotency_key, _reference_code, _amount, _charge_family,
    _provider, COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (store_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_reservation;

  IF FOUND THEN
    v_created := true;
  ELSE
    SELECT * INTO v_reservation
    FROM public.commission_charge_reservations AS r
    WHERE r.store_id = _store_id
      AND r.idempotency_key = _idempotency_key;
  END IF;

  RETURN QUERY SELECT
    v_reservation.id,
    v_reservation.reference_code,
    v_reservation.amount,
    v_reservation.charge_family,
    v_reservation.provider,
    v_reservation.state,
    v_reservation.transaction_id,
    v_reservation.metadata,
    v_created;
END;
$$;

-- Garante que apenas uma execução por vez possa contactar a provedora para a
-- mesma reserva. Uma reserva "issuing" abandonada pode ser recuperada após o
-- lease expirar, sempre com a mesma reference_code/correlationID.
CREATE OR REPLACE FUNCTION public.claim_commission_charge_reservation(
  _reservation_id uuid,
  _lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  reservation_id uuid,
  reference_code text,
  amount numeric,
  charge_family text,
  provider text,
  state text,
  transaction_id uuid,
  metadata jsonb,
  acquired boolean,
  finalized boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.commission_charge_reservations%ROWTYPE;
  v_can_claim boolean := false;
  v_lease interval;
BEGIN
  IF _reservation_id IS NULL OR _lease_seconds < 30 OR _lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Parâmetros inválidos para claim de cobrança';
  END IF;

  v_lease := make_interval(secs => _lease_seconds);

  SELECT * INTO v_reservation
  FROM public.commission_charge_reservations AS r
  WHERE r.id = _reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva de cobrança não encontrada';
  END IF;

  IF v_reservation.transaction_id IS NOT NULL OR v_reservation.state = 'finalized' THEN
    RETURN QUERY SELECT
      v_reservation.id, v_reservation.reference_code, v_reservation.amount,
      v_reservation.charge_family, v_reservation.provider, v_reservation.state,
      v_reservation.transaction_id, v_reservation.metadata, false, true;
    RETURN;
  END IF;

  v_can_claim := v_reservation.state = 'reserved'
    OR v_reservation.last_attempt_at IS NULL
    OR v_reservation.last_attempt_at <= now() - v_lease;

  IF v_can_claim THEN
    UPDATE public.commission_charge_reservations AS r
    SET state = 'issuing',
        attempt_count = r.attempt_count + 1,
        last_attempt_at = now(),
        last_error = NULL,
        updated_at = now()
    WHERE r.id = v_reservation.id
    RETURNING * INTO v_reservation;
  END IF;

  RETURN QUERY SELECT
    v_reservation.id, v_reservation.reference_code, v_reservation.amount,
    v_reservation.charge_family, v_reservation.provider, v_reservation.state,
    v_reservation.transaction_id, v_reservation.metadata, v_can_claim, false;
END;
$$;

-- Finaliza a reserva e grava a transação financeira em uma única transação.
-- Repetições devolvem a transação já criada, sem uma segunda cobrança local.
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

-- Libera a reserva após uma falha confirmada da provedora. Caso haja timeout
-- ambíguo, a função chamadora não deve liberar: o retry mantém o correlationID.
CREATE OR REPLACE FUNCTION public.release_commission_charge_reservation(
  _reservation_id uuid,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.commission_charge_reservations AS r
  SET state = CASE WHEN r.transaction_id IS NULL THEN 'reserved' ELSE r.state END,
      last_error = LEFT(COALESCE(_reason, 'Falha de emissão'), 1000),
      updated_at = now()
  WHERE r.id = _reservation_id;
END;
$$;

REVOKE ALL ON TABLE public.commission_charge_reservations FROM PUBLIC;
REVOKE ALL ON TABLE public.commission_charge_reservations FROM anon;
REVOKE ALL ON TABLE public.commission_charge_reservations FROM authenticated;

REVOKE ALL ON FUNCTION public.reserve_commission_charge_reservation(uuid, text, text, numeric, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_commission_charge_reservation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_commission_charge_reservation(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_commission_charge_reservation(uuid, text, text, numeric, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_commission_charge_reservation(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_commission_charge_reservation(uuid, text) TO service_role;
