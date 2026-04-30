CREATE OR REPLACE FUNCTION public.driver_accept_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _driver_city text;
  _store_city text;
  _store_id uuid;
  _is_platform_driver boolean;
  _is_store_driver boolean;
  _assigned uuid;
  _active_count int;
BEGIN
  -- Get order's store_id and assignment
  SELECT o.store_id, o.assigned_driver_id INTO _store_id, _assigned
  FROM public.orders o WHERE o.id = _order_id;

  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Block if driver already has an active delivery
  SELECT count(*) INTO _active_count
  FROM public.orders
  WHERE driver_id = auth.uid()
    AND status IN ('pronto_para_entrega','saiu_entrega','em_transito');

  IF _active_count > 0 THEN
    RAISE EXCEPTION 'Você já tem uma entrega ativa. Finalize-a antes de aceitar outra.';
  END IF;

  -- If order is assigned to a specific driver, only that driver can accept
  IF _assigned IS NOT NULL AND _assigned <> auth.uid() THEN
    RAISE EXCEPTION 'Este pedido foi designado para outro motoboy.';
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
    AND driver_id IS NULL
    AND (assigned_driver_id IS NULL OR assigned_driver_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível aceitar este pedido. Outro entregador pode ter aceitado primeiro.';
  END IF;
END;
$function$;