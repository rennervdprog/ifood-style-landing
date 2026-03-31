
-- Add settlement_code column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settlement_code text;

-- Create trigger function to generate settlement_code for cash orders when delivered
CREATE OR REPLACE FUNCTION public.generate_settlement_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_method = 'dinheiro' 
     AND NEW.status IN ('entregue', 'finalizado') 
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.settlement_code IS NULL THEN
    NEW.settlement_code := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_settlement_code ON public.orders;
CREATE TRIGGER trg_generate_settlement_code
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_settlement_code();

-- Update driver_confirm_store_return to require settlement code validation
CREATE OR REPLACE FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text DEFAULT NULL)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
BEGIN
  SELECT id, status, driver_id, payment_method, subtotal, store_id, return_to_store_confirmed, settlement_code
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

  -- Validate settlement code for cash orders
  IF _order.payment_method = 'dinheiro' AND _order.settlement_code IS NOT NULL THEN
    IF _settlement_code IS NULL OR _settlement_code != _order.settlement_code THEN
      RAISE EXCEPTION 'Código de acerto inválido. Solicite o código ao lojista.';
    END IF;
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
