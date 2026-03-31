
-- Update driver_confirm_store_return to mark cash-settled earnings
-- When settlement code is validated, the delivery fee was already paid in cash by the store
-- So we need to: 1) mark the earning as 'pago_loja', 2) subtract from pending_amount and add to paid_amount
CREATE OR REPLACE FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text DEFAULT NULL)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
BEGIN
  SELECT id, status, driver_id, payment_method, subtotal, delivery_fee, store_id, return_to_store_confirmed, settlement_code
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

  -- Mark order return as confirmed
  UPDATE public.orders SET return_to_store_confirmed = true WHERE id = _order_id;

  -- For cash/card orders: the store paid the driver in person
  IF _order.payment_method IN ('dinheiro', 'cartao') THEN
    -- Record store commission (12% of subtotal) as debt from store to admin
    INSERT INTO public.store_balances (store_id, pending_commission, updated_at)
    VALUES (_order.store_id, ROUND(_order.subtotal * 0.12, 2), now())
    ON CONFLICT (store_id) DO UPDATE
    SET pending_commission = store_balances.pending_commission + ROUND(_order.subtotal * 0.12, 2),
        updated_at = now();

    -- Mark driver_earnings for this order as 'pago_loja' (paid in cash by store)
    UPDATE public.driver_earnings
    SET status = 'pago_loja'
    WHERE order_id = _order_id
      AND driver_user_id = auth.uid();

    -- Subtract delivery fee from pending and add to paid in driver_balances
    UPDATE public.driver_balances
    SET pending_amount = GREATEST(pending_amount - COALESCE(_order.delivery_fee, 0), 0),
        paid_amount = paid_amount + COALESCE(_order.delivery_fee, 0),
        updated_at = now()
    WHERE driver_user_id = auth.uid();
  END IF;
END;
$function$;
