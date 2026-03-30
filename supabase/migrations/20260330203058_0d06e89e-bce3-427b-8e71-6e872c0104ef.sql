
-- Add cash payment fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS needs_change boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS change_for numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_to_store_confirmed boolean NOT NULL DEFAULT false;

-- Create store_balances table for tracking commissions on cash orders
CREATE TABLE IF NOT EXISTS public.store_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  pending_commission numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

ALTER TABLE public.store_balances ENABLE ROW LEVEL SECURITY;

-- Store owners can read their own balance
CREATE POLICY "Store owners can read own balance" ON public.store_balances
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Platform admin can read all balances
CREATE POLICY "Platform admin can read all balances" ON public.store_balances
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Platform admin can update balances
CREATE POLICY "Platform admin can update balances" ON public.store_balances
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Function to confirm return to store (driver confirms cash handoff)
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

  IF _order.status != 'entregue' THEN
    RAISE EXCEPTION 'Pedido precisa estar com status entregue.';
  END IF;

  IF _order.return_to_store_confirmed THEN
    RAISE EXCEPTION 'Retorno já confirmado.';
  END IF;

  -- Mark return confirmed
  UPDATE public.orders SET return_to_store_confirmed = true WHERE id = _order_id;

  -- If cash payment, add commission to store_balances
  IF _order.payment_method = 'dinheiro' THEN
    INSERT INTO public.store_balances (store_id, pending_commission, updated_at)
    VALUES (_order.store_id, ROUND(_order.subtotal * 0.12, 2), now())
    ON CONFLICT (store_id) DO UPDATE
    SET pending_commission = store_balances.pending_commission + ROUND(_order.subtotal * 0.12, 2),
        updated_at = now();
  END IF;
END;
$function$;
