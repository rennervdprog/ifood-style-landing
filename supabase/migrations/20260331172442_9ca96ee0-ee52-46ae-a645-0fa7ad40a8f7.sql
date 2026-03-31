CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _is_physical_payment boolean;
  _earning_status text;
  _next_order_status public.order_status;
BEGIN
  SELECT id, delivery_pin, status, driver_id, delivery_fee, payment_method
  INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.status NOT IN ('em_transito', 'saiu_entrega') THEN
    RAISE EXCEPTION 'Este pedido não está em rota de entrega.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF NOT public.is_driver(auth.uid()) THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.delivery_pin IS NOT NULL AND (_pin IS NULL OR _pin != _order.delivery_pin) THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o cliente.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _earning_status := CASE WHEN _is_physical_payment THEN 'waiting_store_settlement' ELSE 'pendente' END;
  _next_order_status := CASE WHEN _is_physical_payment THEN 'entregue'::public.order_status ELSE 'finalizado'::public.order_status END;

  UPDATE public.orders
  SET status = _next_order_status,
      confirmed_at = now()
  WHERE id = _order_id;

  INSERT INTO public.driver_earnings (driver_user_id, order_id, amount, status)
  VALUES (auth.uid(), _order_id, COALESCE(_order.delivery_fee, 0), _earning_status);

  INSERT INTO public.driver_balances (driver_user_id, total_earned, pending_amount, paid_amount, updated_at)
  VALUES (
    auth.uid(),
    COALESCE(_order.delivery_fee, 0),
    CASE WHEN _is_physical_payment THEN 0 ELSE COALESCE(_order.delivery_fee, 0) END,
    0,
    now()
  )
  ON CONFLICT (driver_user_id) DO UPDATE SET
    total_earned = public.driver_balances.total_earned + COALESCE(_order.delivery_fee, 0),
    pending_amount = public.driver_balances.pending_amount + CASE WHEN _is_physical_payment THEN 0 ELSE COALESCE(_order.delivery_fee, 0) END,
    updated_at = now();
END;
$function$;

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

  INSERT INTO public.store_balances (store_id, pending_commission, updated_at)
  VALUES (_order.store_id, ROUND(_order.subtotal * 0.15, 2), now())
  ON CONFLICT (store_id) DO UPDATE
  SET pending_commission = public.store_balances.pending_commission + ROUND(_order.subtotal * 0.15, 2),
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