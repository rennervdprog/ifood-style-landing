
-- Refund reason enum
CREATE TYPE public.refund_reason AS ENUM (
  'wrong_product', 'missing_items', 'damaged', 'late_delivery', 'poor_quality', 'other'
);

-- Refund status enum
CREATE TYPE public.refund_status AS ENUM (
  'pending', 'approved', 'processed', 'rejected'
);

-- Refund type enum
CREATE TYPE public.refund_type AS ENUM (
  'full', 'partial', 'wallet_credit'
);

-- Wallet transaction type enum
CREATE TYPE public.wallet_transaction_type AS ENUM (
  'credit', 'debit'
);

-- ========== REFUND REQUESTS TABLE ==========
CREATE TABLE public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  requester_id UUID NOT NULL,
  reason public.refund_reason NOT NULL DEFAULT 'other',
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  refund_type public.refund_type NOT NULL DEFAULT 'wallet_credit',
  requested_amount NUMERIC NOT NULL DEFAULT 0,
  approved_amount NUMERIC DEFAULT NULL,
  status public.refund_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Clients can view their own refund requests
CREATE POLICY "Clients can view own refund requests"
ON public.refund_requests FOR SELECT TO authenticated
USING (requester_id = auth.uid());

-- Store owners can view refund requests for their stores
CREATE POLICY "Store owners can view store refund requests"
ON public.refund_requests FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
);

-- Admins can view all
CREATE POLICY "Admins can view all refund requests"
ON public.refund_requests FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Clients can create refund requests for their orders
CREATE POLICY "Clients can create refund requests"
ON public.refund_requests FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND client_id = auth.uid())
);

-- Store owners can update status of their store refund requests
CREATE POLICY "Store owners can update refund requests"
ON public.refund_requests FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
);

-- Admins can update all
CREATE POLICY "Admins can update all refund requests"
ON public.refund_requests FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ========== USER WALLET TABLE ==========
CREATE TABLE public.user_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
ON public.user_wallet FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets"
ON public.user_wallet FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ========== WALLET TRANSACTIONS TABLE ==========
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type public.wallet_transaction_type NOT NULL,
  reference_type TEXT NOT NULL DEFAULT 'refund',
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions"
ON public.wallet_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all wallet transactions"
ON public.wallet_transactions FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ========== PROCESS REFUND FUNCTION ==========
CREATE OR REPLACE FUNCTION public.process_refund(
  _refund_id UUID,
  _approved_amount NUMERIC,
  _admin_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _refund RECORD;
  _is_admin boolean;
  _is_store_owner boolean;
BEGIN
  SELECT * INTO _refund FROM public.refund_requests WHERE id = _refund_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _refund.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  _is_admin := public.is_platform_admin(auth.uid());
  _is_store_owner := EXISTS (SELECT 1 FROM public.stores WHERE id = _refund.store_id AND owner_id = auth.uid());

  IF NOT _is_admin AND NOT _is_store_owner THEN
    RAISE EXCEPTION 'Sem permissão para processar reembolsos.';
  END IF;

  IF _approved_amount <= 0 THEN
    -- Reject
    UPDATE public.refund_requests SET
      status = 'rejected',
      admin_notes = COALESCE(_admin_notes, admin_notes),
      resolved_by = auth.uid(),
      resolved_at = now()
    WHERE id = _refund_id;
    RETURN;
  END IF;

  -- Approve and credit wallet
  UPDATE public.refund_requests SET
    status = 'processed',
    approved_amount = _approved_amount,
    admin_notes = COALESCE(_admin_notes, admin_notes),
    resolved_by = auth.uid(),
    resolved_at = now()
  WHERE id = _refund_id;

  -- Upsert wallet balance
  INSERT INTO public.user_wallet (user_id, balance, updated_at)
  VALUES (_refund.requester_id, _approved_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = public.user_wallet.balance + _approved_amount,
    updated_at = now();

  -- Record transaction
  INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    _refund.requester_id,
    _approved_amount,
    'credit',
    'refund',
    _refund.order_id,
    'Reembolso do pedido #' || substr(_refund.order_id::text, 1, 8)
  );
END;
$$;

-- ========== CANCELLATION FEE FUNCTION ==========
CREATE OR REPLACE FUNCTION public.apply_cancellation_policy(
  _order_id UUID,
  _reason TEXT DEFAULT 'Cancelado pelo cliente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _fee_percent NUMERIC;
  _fee_amount NUMERIC;
  _refund_amount NUMERIC;
  _is_pix boolean;
  _result jsonb;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;

  -- Only the client, store owner or admin can cancel
  IF _order.client_id != auth.uid()
     AND NOT public.is_platform_admin(auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _order.store_id AND owner_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este pedido.';
  END IF;

  -- Block cancellation for delivered/finalized orders
  IF _order.status IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedidos entregues/finalizados não podem ser cancelados. Abra uma solicitação de reembolso.';
  END IF;

  IF _order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido já está cancelado.';
  END IF;

  -- Fee based on status
  CASE _order.status
    WHEN 'aguardando_pagamento' THEN _fee_percent := 0;
    WHEN 'pendente' THEN _fee_percent := 0;
    WHEN 'preparando' THEN _fee_percent := 20;
    WHEN 'pronto_para_entrega' THEN _fee_percent := 40;
    WHEN 'saiu_entrega' THEN _fee_percent := 60;
    WHEN 'em_transito' THEN _fee_percent := 60;
    ELSE _fee_percent := 0;
  END CASE;

  _fee_amount := ROUND(_order.subtotal * (_fee_percent / 100.0), 2);
  _refund_amount := GREATEST(0, _order.subtotal - _fee_amount);
  _is_pix := COALESCE(_order.payment_method, '') = 'pix';

  -- Cancel the order
  UPDATE public.orders SET status = 'cancelado' WHERE id = _order_id;

  -- Credit wallet with refund amount (if any)
  IF _refund_amount > 0 THEN
    INSERT INTO public.user_wallet (user_id, balance, updated_at)
    VALUES (_order.client_id, _refund_amount, now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.user_wallet.balance + _refund_amount,
      updated_at = now();

    INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
    VALUES (
      _order.client_id,
      _refund_amount,
      'credit',
      'cancellation',
      _order_id,
      CASE
        WHEN _fee_percent = 0 THEN 'Reembolso total - cancelamento pedido #' || substr(_order_id::text, 1, 8)
        ELSE 'Reembolso parcial (' || (100 - _fee_percent) || '%) - cancelamento pedido #' || substr(_order_id::text, 1, 8)
      END
    );
  END IF;

  _result := jsonb_build_object(
    'cancelled', true,
    'fee_percent', _fee_percent,
    'fee_amount', _fee_amount,
    'refund_amount', _refund_amount,
    'refund_method', 'wallet_credit',
    'is_pix', _is_pix
  );

  RETURN _result;
END;
$$;

-- ========== USE WALLET BALANCE FUNCTION ==========
CREATE OR REPLACE FUNCTION public.use_wallet_balance(
  _user_id UUID,
  _amount NUMERIC,
  _order_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance NUMERIC;
  _deducted NUMERIC;
BEGIN
  IF auth.uid() != _user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  SELECT balance INTO _current_balance
  FROM public.user_wallet
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND OR _current_balance <= 0 THEN
    RETURN 0;
  END IF;

  _deducted := LEAST(_current_balance, _amount);

  UPDATE public.user_wallet
  SET balance = balance - _deducted, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    _user_id,
    _deducted,
    'debit',
    'order_payment',
    _order_id,
    'Crédito usado no pedido #' || substr(_order_id::text, 1, 8)
  );

  RETURN _deducted;
END;
$$;
