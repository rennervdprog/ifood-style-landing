
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
  _delivery_mode text;
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

  -- Commission based on delivery mode
  SELECT COALESCE(s.delivery_mode, 'platform') INTO _delivery_mode
  FROM public.stores s WHERE s.id = _order.store_id;

  IF _delivery_mode = 'own' THEN
    _commission := 0.90;
  ELSE
    _commission := ROUND(COALESCE(_order.subtotal, 0) * 0.15, 2);
  END IF;

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
