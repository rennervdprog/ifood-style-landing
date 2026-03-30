
-- Create a secure function for drivers to accept orders
-- This restricts what columns can be modified
CREATE OR REPLACE FUNCTION public.driver_accept_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET driver_id = auth.uid(), status = 'em_transito'
  WHERE id = _order_id
    AND status = 'pronto_para_entrega'
    AND driver_id IS NULL
    AND public.is_driver(auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível aceitar este pedido. Outro entregador pode ter aceitado primeiro.';
  END IF;
END;
$$;

-- Create a secure function for drivers to finish delivery
CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'entregue'
  WHERE id = _order_id
    AND status = 'em_transito'
    AND driver_id = auth.uid()
    AND public.is_driver(auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível finalizar esta entrega.';
  END IF;
END;
$$;

-- Drop the permissive UPDATE policy for drivers
DROP POLICY IF EXISTS "Drivers can accept or finish orders" ON public.orders;
