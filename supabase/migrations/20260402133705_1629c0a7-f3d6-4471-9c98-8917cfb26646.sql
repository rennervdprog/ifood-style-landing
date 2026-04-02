
CREATE OR REPLACE FUNCTION public.confirm_order_payment(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'pendente'
  WHERE id = _order_id
    AND client_id = auth.uid()
    AND status = 'aguardando_pagamento';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou não está aguardando pagamento.';
  END IF;
END;
$$;
