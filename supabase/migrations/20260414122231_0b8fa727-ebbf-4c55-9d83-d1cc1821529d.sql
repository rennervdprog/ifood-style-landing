
CREATE OR REPLACE FUNCTION public.apply_cancellation_policy(_order_id uuid, _reason text DEFAULT 'Cancelado pelo cliente')
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
  _is_prepaid boolean;
  _result jsonb;
  _minutes_in_status NUMERIC;
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

  IF _order.status IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedidos entregues/finalizados não podem ser cancelados. Abra uma solicitação de reembolso.';
  END IF;

  IF _order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido já está cancelado.';
  END IF;

  -- Determine if payment was prepaid (PIX or wallet) vs pay-on-delivery (dinheiro/cartao)
  _is_prepaid := COALESCE(_order.payment_method, '') IN ('pix', 'wallet', 'saldo');

  -- Calculate minutes since confirmed
  _minutes_in_status := EXTRACT(EPOCH FROM (now() - COALESCE(_order.confirmed_at, _order.created_at))) / 60.0;

  -- Fee based on status with time-based override
  CASE _order.status
    WHEN 'aguardando_pagamento' THEN _fee_percent := 0;
    WHEN 'pendente' THEN _fee_percent := 0;
    WHEN 'preparando' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 20; END IF;
    WHEN 'pronto_para_entrega' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 40; END IF;
    WHEN 'saiu_entrega' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 60; END IF;
    WHEN 'em_transito' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 60; END IF;
    ELSE _fee_percent := 0;
  END CASE;

  _fee_amount := ROUND(_order.subtotal * (_fee_percent / 100.0), 2);
  _refund_amount := GREATEST(0, _order.subtotal - _fee_amount);

  -- Cancel the order
  UPDATE public.orders SET status = 'cancelado' WHERE id = _order_id;

  -- Only credit wallet if payment was prepaid (PIX/wallet)
  -- For cash/card: client hasn't paid yet, no refund needed
  IF _is_prepaid AND _refund_amount > 0 THEN
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
    'refund_amount', CASE WHEN _is_prepaid THEN _refund_amount ELSE 0 END,
    'refund_method', CASE WHEN _is_prepaid THEN 'wallet_credit' ELSE 'none' END,
    'is_prepaid', _is_prepaid,
    'payment_method', COALESCE(_order.payment_method, 'unknown'),
    'time_override', _minutes_in_status >= 20
  );

  RETURN _result;
END;
$$;
