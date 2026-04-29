-- Function to get client name from order
CREATE OR REPLACE FUNCTION public.get_order_client_name(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _name text;
BEGIN
  SELECT p.full_name INTO _name
  FROM public.orders o
  JOIN public.profiles p ON p.user_id = o.client_id
  WHERE o.id = _order_id;
  
  RETURN _name;
END;
$$;

-- Function to handle order status changes and update financial transactions metadata
CREATE OR REPLACE FUNCTION public.handle_order_payment_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _client_name text;
BEGIN
  -- When order is paid (moves to pendente or confirmed)
  IF (OLD.status = 'aguardando_pagamento' AND NEW.status = 'pendente') THEN
    _client_name := public.get_order_client_name(NEW.id);
    
    -- Update existing financial transactions for this order
    -- (This happens when the order is paid and the system moves it forward)
    UPDATE public.financial_transactions
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{client_name}',
      to_jsonb(COALESCE(_client_name, 'Cliente ItaSuper'))
    )
    WHERE metadata->> 'order_id' = NEW.id::text;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on orders
DROP TRIGGER IF EXISTS on_order_payment_metadata ON public.orders;
CREATE TRIGGER on_order_payment_metadata
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_payment_metadata();
