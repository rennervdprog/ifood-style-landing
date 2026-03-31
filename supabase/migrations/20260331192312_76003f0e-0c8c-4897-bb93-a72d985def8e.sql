DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_type'
  ) THEN
    CREATE TYPE public.financial_transaction_type AS ENUM ('commission_charge', 'store_payout');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_status'
  ) THEN
    CREATE TYPE public.financial_transaction_status AS ENUM ('pending', 'approved', 'paid', 'failed', 'cancelled');
  END IF;
END
$$;

ALTER TABLE public.store_balances
  ADD COLUMN IF NOT EXISTS repasse_pendente numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_pendente numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.store_balances'::regclass
      AND conname = 'store_balances_store_id_key'
  ) THEN
    ALTER TABLE public.store_balances
      ADD CONSTRAINT store_balances_store_id_key UNIQUE (store_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_store_balances_legacy_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.comissao_pendente := COALESCE(NEW.comissao_pendente, 0);
  NEW.repasse_pendente := COALESCE(NEW.repasse_pendente, 0);
  NEW.pending_commission := NEW.comissao_pendente;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_store_balances_legacy_fields ON public.store_balances;
CREATE TRIGGER trg_sync_store_balances_legacy_fields
BEFORE INSERT OR UPDATE ON public.store_balances
FOR EACH ROW
EXECUTE FUNCTION public.sync_store_balances_legacy_fields();

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transaction_kind public.financial_transaction_type NOT NULL,
  reference_code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status public.financial_transaction_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'mercado_pago',
  mercado_pago_payment_id text,
  mercado_pago_transfer_id text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_copy_paste text,
  settled_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financial_transactions_reference_code_key UNIQUE (reference_code),
  CONSTRAINT financial_transactions_amount_nonnegative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_store_id ON public.financial_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_kind_status ON public.financial_transactions(transaction_kind, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_mp_payment_id
  ON public.financial_transactions(mercado_pago_payment_id)
  WHERE mercado_pago_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_mp_transfer_id
  ON public.financial_transactions(mercado_pago_transfer_id)
  WHERE mercado_pago_transfer_id IS NOT NULL;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin can read all financial transactions" ON public.financial_transactions;
CREATE POLICY "Platform admin can read all financial transactions"
ON public.financial_transactions
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admin can insert financial transactions" ON public.financial_transactions;
CREATE POLICY "Platform admin can insert financial transactions"
ON public.financial_transactions
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admin can update financial transactions" ON public.financial_transactions;
CREATE POLICY "Platform admin can update financial transactions"
ON public.financial_transactions
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admin can delete financial transactions" ON public.financial_transactions;
CREATE POLICY "Platform admin can delete financial transactions"
ON public.financial_transactions
FOR DELETE
TO authenticated
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Store owners can read own financial transactions" ON public.financial_transactions;
CREATE POLICY "Store owners can read own financial transactions"
ON public.financial_transactions
FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT s.id
    FROM public.stores s
    WHERE s.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.touch_financial_transactions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_financial_transactions_updated_at ON public.financial_transactions;
CREATE TRIGGER trg_touch_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.touch_financial_transactions_updated_at();

CREATE OR REPLACE FUNCTION public.generate_financial_reference(_prefix text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _clean_prefix text;
BEGIN
  _clean_prefix := upper(regexp_replace(COALESCE(_prefix, 'TX'), '[^A-Za-z0-9]', '', 'g'));
  RETURN '#' || _clean_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
END;
$$;

WITH aggregated AS (
  SELECT
    o.store_id,
    ROUND(COALESCE(SUM(
      CASE
        WHEN COALESCE(o.payment_method, '') IN ('pix', 'pix_app')
         AND o.status IN ('pendente', 'preparando', 'pronto_para_entrega', 'em_transito', 'saiu_entrega', 'entregue', 'finalizado')
        THEN COALESCE(o.subtotal, 0) * 0.85
        ELSE 0
      END
    ), 0), 2) AS repasse_pendente,
    ROUND(COALESCE(SUM(
      CASE
        WHEN COALESCE(o.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery')
         AND o.status = 'finalizado'
         AND COALESCE(o.return_to_store_confirmed, false) = true
        THEN COALESCE(o.subtotal, 0) * 0.15
        ELSE 0
      END
    ), 0), 2) AS comissao_pendente
  FROM public.orders o
  WHERE o.status NOT IN ('aguardando_pagamento', 'cancelado')
  GROUP BY o.store_id
)
INSERT INTO public.store_balances (store_id, repasse_pendente, comissao_pendente, pending_commission, updated_at)
SELECT
  a.store_id,
  a.repasse_pendente,
  a.comissao_pendente,
  a.comissao_pendente,
  now()
FROM aggregated a
ON CONFLICT (store_id) DO UPDATE
SET repasse_pendente = EXCLUDED.repasse_pendente,
    comissao_pendente = EXCLUDED.comissao_pendente,
    pending_commission = EXCLUDED.comissao_pendente,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _is_physical_payment boolean;
  _delivery_fee numeric;
  _commission numeric;
BEGIN
  SELECT id, status, driver_id, payment_method, subtotal, delivery_fee, store_id, return_to_store_confirmed, settlement_code
  INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF _order.status NOT IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedido precisa estar com status entregue ou finalizado.';
  END IF;

  IF _order.return_to_store_confirmed THEN
    RAISE EXCEPTION 'Retorno já confirmado.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _delivery_fee := COALESCE(_order.delivery_fee, 0);
  _commission := ROUND(COALESCE(_order.subtotal, 0) * 0.15, 2);

  IF NOT _is_physical_payment THEN
    RAISE EXCEPTION 'Este pedido não exige acerto físico com a loja.';
  END IF;

  IF _order.settlement_code IS NOT NULL THEN
    IF _settlement_code IS NULL OR _settlement_code != _order.settlement_code THEN
      RAISE EXCEPTION 'Código de acerto inválido. Solicite o código ao lojista.';
    END IF;
  END IF;

  UPDATE public.orders
  SET return_to_store_confirmed = true,
      status = 'finalizado'
  WHERE id = _order_id;

  INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (_order.store_id, _commission, _commission, 0, now())
  ON CONFLICT (store_id) DO UPDATE
  SET comissao_pendente = public.store_balances.comissao_pendente + _commission,
      pending_commission = public.store_balances.comissao_pendente + _commission,
      updated_at = now();

  UPDATE public.driver_earnings
  SET status = 'pago_loja'
  WHERE order_id = _order_id
    AND driver_user_id = auth.uid()
    AND status IN ('waiting_store_settlement', 'pendente');

  UPDATE public.driver_balances
  SET pending_amount = GREATEST(public.driver_balances.pending_amount - _delivery_fee, 0),
      paid_amount = public.driver_balances.paid_amount + _delivery_fee,
      updated_at = now()
  WHERE driver_user_id = auth.uid();
END;
$function$;