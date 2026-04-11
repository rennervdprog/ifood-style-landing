
-- Update driver_accept_order to allow store drivers
CREATE OR REPLACE FUNCTION public.driver_accept_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _driver_city text;
  _store_city text;
  _store_id uuid;
  _is_platform_driver boolean;
  _is_store_driver boolean;
BEGIN
  -- Get order's store_id
  SELECT o.store_id INTO _store_id FROM public.orders o WHERE o.id = _order_id;
  
  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Check if user is a platform driver
  _is_platform_driver := public.is_driver(auth.uid());
  
  -- Check if user is a store driver for this store
  _is_store_driver := public.is_store_driver(auth.uid(), _store_id);

  IF NOT _is_platform_driver AND NOT _is_store_driver THEN
    RAISE EXCEPTION 'Você não é um entregador autorizado para este pedido.';
  END IF;

  -- City check only for platform drivers (store drivers are already linked to the store)
  IF _is_platform_driver AND NOT _is_store_driver THEN
    SELECT city INTO _driver_city FROM public.drivers WHERE user_id = auth.uid();
    
    SELECT COALESCE(s.address_city, 'itatinga') INTO _store_city
    FROM public.stores s WHERE s.id = _store_id;

    IF _driver_city IS DISTINCT FROM _store_city THEN
      RAISE EXCEPTION 'Este pedido é de outra cidade. Você só pode aceitar pedidos da sua cidade.';
    END IF;
  END IF;

  UPDATE public.orders
  SET driver_id = auth.uid()
  WHERE id = _order_id
    AND status = 'pronto_para_entrega'
    AND driver_id IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível aceitar este pedido. Outro entregador pode ter aceitado primeiro.';
  END IF;
END;
$$;

-- Update driver_finish_delivery to also allow store drivers
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

  -- Check authorization: platform driver OR store driver
  _is_authorized := public.is_driver(auth.uid()) OR public.is_store_driver(auth.uid(), _order.store_id);
  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.delivery_pin IS NOT NULL AND (_pin IS NULL OR _pin != _order.delivery_pin) THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o cliente.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _earning_status := CASE WHEN _is_physical_payment THEN 'waiting_store_settlement' ELSE 'pendente' END;
  _next_order_status := CASE WHEN _is_physical_payment THEN 'entregue'::public.order_status ELSE 'finalizado'::public.order_status END;

  -- Get platform split for fixed plans
  _platform_split := public.get_fixed_plan_platform_split(_order.store_id);

  UPDATE public.orders
  SET status = _next_order_status,
      confirmed_at = now()
  WHERE id = _order_id;

  -- Record driver earning
  INSERT INTO public.driver_earnings (driver_user_id, order_id, amount, status)
  VALUES (auth.uid(), _order_id, COALESCE(_order.delivery_fee, 0), _earning_status);

  -- Update driver balance
  INSERT INTO public.driver_balances (driver_user_id, total_earned, pending_amount, paid_amount, updated_at)
  VALUES (
    auth.uid(),
    COALESCE(_order.delivery_fee, 0),
    CASE 
      WHEN _is_physical_payment THEN -_platform_split
      ELSE COALESCE(_order.delivery_fee, 0) - _platform_split
    END,
    0,
    now()
  )
  ON CONFLICT (driver_user_id) DO UPDATE SET
    total_earned = public.driver_balances.total_earned + COALESCE(_order.delivery_fee, 0),
    pending_amount = public.driver_balances.pending_amount + CASE 
      WHEN _is_physical_payment THEN -_platform_split
      ELSE COALESCE(_order.delivery_fee, 0) - _platform_split
    END,
    updated_at = now();
END;
$$;

-- Update driver_validate_collection to also allow store drivers
CREATE OR REPLACE FUNCTION public.driver_validate_collection(_order_id uuid, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _is_authorized boolean;
BEGIN
  SELECT id, status, driver_id, collection_code, collection_validated, store_id INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  _is_authorized := public.is_driver(auth.uid()) OR public.is_store_driver(auth.uid(), _order.store_id);
  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.status != 'pronto_para_entrega' THEN
    RAISE EXCEPTION 'Pedido não está no status correto para validação de coleta.';
  END IF;

  IF _order.collection_code IS NULL THEN
    RAISE EXCEPTION 'Este pedido não possui código de coleta.';
  END IF;

  IF _code IS NULL OR _code != _order.collection_code THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o lojista.';
  END IF;

  UPDATE public.orders 
  SET collection_validated = true, status = 'em_transito'
  WHERE id = _order_id;
END;
$$;

-- Also allow store drivers to see order items
CREATE POLICY "Store drivers can read linked order items"
ON public.order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.store_drivers sd ON sd.store_id = o.store_id
    WHERE o.id = order_items.order_id
      AND sd.driver_user_id = auth.uid()
  )
);

-- Allow store drivers to read order messages
CREATE POLICY "Store drivers can read linked order messages"
ON public.order_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.store_drivers sd ON sd.store_id = o.store_id
    WHERE o.id = order_messages.order_id
      AND sd.driver_user_id = auth.uid()
  )
);

-- Allow store drivers to send messages on linked orders
CREATE POLICY "Store drivers can send messages on linked orders"
ON public.order_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.store_drivers sd ON sd.store_id = o.store_id
    WHERE o.id = order_messages.order_id
      AND sd.driver_user_id = auth.uid()
  )
);
