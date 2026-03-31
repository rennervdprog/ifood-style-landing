
-- 1. Fix driver_accept_order: assign driver but keep status as pronto_para_entrega
CREATE OR REPLACE FUNCTION public.driver_accept_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders
  SET driver_id = auth.uid()
  WHERE id = _order_id
    AND status = 'pronto_para_entrega'
    AND driver_id IS NULL
    AND public.is_driver(auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível aceitar este pedido. Outro entregador pode ter aceitado primeiro.';
  END IF;
END;
$$;

-- 2. Fix driver_validate_collection: change status to saiu_entrega after validation
CREATE OR REPLACE FUNCTION public.driver_validate_collection(_order_id uuid, _code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

  -- Mark collection validated AND change status to saiu_entrega
  UPDATE public.orders 
  SET collection_validated = true, status = 'saiu_entrega'
  WHERE id = _order_id;
END;
$$;

-- 3. Fix driver_finish_delivery to work from saiu_entrega status
CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  SET status = 'entregue', confirmed_at = now()
  WHERE id = _order_id;
END;
$$;

-- 4. Update RLS policy for drivers to also see orders where they are assigned but still pronto_para_entrega
DROP POLICY IF EXISTS "Drivers can see ready orders" ON public.orders;
CREATE POLICY "Drivers can see ready orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    is_driver(auth.uid()) AND (
      (status = 'pronto_para_entrega' AND driver_id IS NULL) OR
      driver_id = auth.uid()
    )
  );
