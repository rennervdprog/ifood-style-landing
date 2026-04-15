
CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _is_physical_payment boolean;
  _earning_status text;
  _next_order_status public.order_status;
  _platform_split numeric;
  _is_authorized boolean;
  _is_store_drv boolean;
BEGIN
  SELECT id, delivery_pin, status, driver_id, delivery_fee, payment_method, store_id
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

  _is_authorized := public.is_driver(auth.uid()) OR public.is_store_driver(auth.uid(), _order.store_id);
  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.delivery_pin IS NOT NULL AND (_pin IS NULL OR _pin != _order.delivery_pin) THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o cliente.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _is_store_drv := public.is_store_driver_member(auth.uid(), _order.store_id);

  -- Store drivers always finalize directly (payment already collected on delivery)
  IF _is_store_drv THEN
    _next_order_status := 'finalizado'::public.order_status;
    _earning_status := 'pendente';
  ELSE
    _earning_status := CASE WHEN _is_physical_payment THEN 'waiting_store_settlement' ELSE 'pendente' END;
    _next_order_status := CASE WHEN _is_physical_payment THEN 'entregue'::public.order_status ELSE 'finalizado'::public.order_status END;
  END IF;

  _platform_split := public.get_fixed_plan_platform_split(_order.store_id);

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
    CASE 
      WHEN _is_physical_payment AND NOT _is_store_drv THEN -_platform_split
      ELSE COALESCE(_order.delivery_fee, 0) - _platform_split
    END,
    0,
    now()
  )
  ON CONFLICT (driver_user_id) DO UPDATE SET
    total_earned = public.driver_balances.total_earned + COALESCE(_order.delivery_fee, 0),
    pending_amount = public.driver_balances.pending_amount + CASE 
      WHEN _is_physical_payment AND NOT _is_store_drv THEN -_platform_split
      ELSE COALESCE(_order.delivery_fee, 0) - _platform_split
    END,
    updated_at = now();
END;
$$;
