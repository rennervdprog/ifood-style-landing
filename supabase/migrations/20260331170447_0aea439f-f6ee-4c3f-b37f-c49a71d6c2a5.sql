
-- Update trigger to also cover 'cartao' payment method
CREATE OR REPLACE FUNCTION public.generate_settlement_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_method IN ('dinheiro', 'cartao')
     AND NEW.status IN ('entregue', 'finalizado') 
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.settlement_code IS NULL THEN
    NEW.settlement_code := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill settlement codes for unconfirmed cash/card orders that are missing them
UPDATE public.orders 
SET settlement_code = lpad(floor(random() * 10000)::text, 4, '0')
WHERE payment_method IN ('dinheiro', 'cartao')
  AND status IN ('entregue', 'finalizado')
  AND settlement_code IS NULL
  AND return_to_store_confirmed = false;

-- Also update driver_confirm_store_return to accept both dinheiro and cartao
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

  -- Validate settlement code for cash/card orders
  IF _order.payment_method IN ('dinheiro', 'cartao') AND _order.settlement_code IS NOT NULL THEN
    IF _settlement_code IS NULL OR _settlement_code != _order.settlement_code THEN
      RAISE EXCEPTION 'Código de acerto inválido. Solicite o código ao lojista.';
    END IF;
  END IF;

  UPDATE public.orders SET return_to_store_confirmed = true WHERE id = _order_id;

  IF _order.payment_method IN ('dinheiro', 'cartao') THEN
    INSERT INTO public.store_balances (store_id, pending_commission, updated_at)
    VALUES (_order.store_id, ROUND(_order.subtotal * 0.12, 2), now())
    ON CONFLICT (store_id) DO UPDATE
    SET pending_commission = store_balances.pending_commission + ROUND(_order.subtotal * 0.12, 2),
        updated_at = now();
  END IF;
END;
$function$;
