
-- Create driver_balances table
CREATE TABLE public.driver_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id uuid NOT NULL,
  total_earned numeric NOT NULL DEFAULT 0,
  pending_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_user_id)
);

-- Create driver_earnings table for individual delivery records
CREATE TABLE public.driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

-- RLS: Drivers can read own balance
CREATE POLICY "Drivers can read own balance" ON public.driver_balances
  FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid());

-- RLS: Admin can read all balances
CREATE POLICY "Admin can read all driver balances" ON public.driver_balances
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- RLS: Admin can update balances (for marking as paid)
CREATE POLICY "Admin can update driver balances" ON public.driver_balances
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- RLS: Drivers can read own earnings
CREATE POLICY "Drivers can read own earnings" ON public.driver_earnings
  FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid());

-- RLS: Admin can read all earnings
CREATE POLICY "Admin can read all driver earnings" ON public.driver_earnings
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- RLS: Admin can update earnings (mark as paid)
CREATE POLICY "Admin can update driver earnings" ON public.driver_earnings
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Update driver_finish_delivery to also track earnings
CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order RECORD;
BEGIN
  SELECT delivery_pin, status, driver_id, delivery_fee INTO _order
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

  -- Update order status
  UPDATE public.orders
  SET status = 'finalizado', confirmed_at = now()
  WHERE id = _order_id;

  -- Record driver earning
  INSERT INTO public.driver_earnings (driver_user_id, order_id, amount, status)
  VALUES (auth.uid(), _order_id, COALESCE(_order.delivery_fee, 0), 'pendente');

  -- Update driver balance
  INSERT INTO public.driver_balances (driver_user_id, total_earned, pending_amount, updated_at)
  VALUES (auth.uid(), COALESCE(_order.delivery_fee, 0), COALESCE(_order.delivery_fee, 0), now())
  ON CONFLICT (driver_user_id) DO UPDATE SET
    total_earned = driver_balances.total_earned + COALESCE(_order.delivery_fee, 0),
    pending_amount = driver_balances.pending_amount + COALESCE(_order.delivery_fee, 0),
    updated_at = now();
END;
$$;
