
-- Update driver_validate_collection to set status to em_transito instead of saiu_entrega
CREATE OR REPLACE FUNCTION public.driver_validate_collection(_order_id uuid, _code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
BEGIN
  SELECT id, status, driver_id, collection_code, collection_validated INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF NOT public.is_driver(auth.uid()) THEN
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

  -- Mark collection validated AND change status to em_transito
  UPDATE public.orders 
  SET collection_validated = true, status = 'em_transito'
  WHERE id = _order_id;
END;
$function$;

-- Update driver_finish_delivery to set status to finalizado instead of entregue
CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
BEGIN
  SELECT delivery_pin, status, driver_id INTO _order
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

  UPDATE public.orders
  SET status = 'finalizado', confirmed_at = now()
  WHERE id = _order_id;
END;
$function$;

-- Update driver_confirm_store_return to work with finalizado status
CREATE OR REPLACE FUNCTION public.driver_confirm_store_return(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
BEGIN
  SELECT id, status, driver_id, payment_method, subtotal, store_id, return_to_store_confirmed
  INTO _order FROM public.orders WHERE id = _order_id;

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

  UPDATE public.orders SET return_to_store_confirmed = true WHERE id = _order_id;

  IF _order.payment_method = 'dinheiro' THEN
    INSERT INTO public.store_balances (store_id, pending_commission, updated_at)
    VALUES (_order.store_id, ROUND(_order.subtotal * 0.12, 2), now())
    ON CONFLICT (store_id) DO UPDATE
    SET pending_commission = store_balances.pending_commission + ROUND(_order.subtotal * 0.12, 2),
        updated_at = now();
  END IF;
END;
$function$;
