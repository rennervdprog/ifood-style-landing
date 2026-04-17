-- 1) New column: assigned_driver_id (NULL = open to all linked drivers)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver
  ON public.orders(assigned_driver_id)
  WHERE assigned_driver_id IS NOT NULL;

-- 2) Update RLS: store drivers see linked store orders ONLY when assignment matches
DROP POLICY IF EXISTS "Store drivers can see linked store orders" ON public.orders;
CREATE POLICY "Store drivers can see linked store orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_drivers sd
    WHERE sd.driver_user_id = auth.uid()
      AND sd.store_id = orders.store_id
  )
  AND (
    -- Already accepted by me
    orders.driver_id = auth.uid()
    -- Or assigned specifically to me
    OR orders.assigned_driver_id = auth.uid()
    -- Or open to all (no assignment) and still unclaimed
    OR (orders.assigned_driver_id IS NULL AND orders.driver_id IS NULL)
    -- Or fully accepted state needs to remain visible to me
    OR orders.driver_id IS NOT NULL AND orders.driver_id = auth.uid()
  )
);

-- 3) RPC: store owner assigns or releases an order to a driver
CREATE OR REPLACE FUNCTION public.store_assign_order_driver(
  _order_id uuid,
  _driver_user_id uuid  -- NULL releases to all linked drivers
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_id uuid;
  _owner uuid;
  _status order_status;
  _current_driver uuid;
BEGIN
  SELECT o.store_id, o.status, o.driver_id INTO _store_id, _status, _current_driver
  FROM public.orders o WHERE o.id = _order_id;

  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT s.owner_id INTO _owner FROM public.stores s WHERE s.id = _store_id;
  IF _owner IS DISTINCT FROM auth.uid() AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o lojista pode designar entregadores.';
  END IF;

  IF _current_driver IS NOT NULL THEN
    RAISE EXCEPTION 'Pedido já foi aceito por um entregador.';
  END IF;

  IF _status NOT IN ('pendente','preparando','pronto_para_entrega') THEN
    RAISE EXCEPTION 'Pedido não está em estado válido para designação.';
  END IF;

  -- If targeting a driver, ensure they are linked to this store
  IF _driver_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_drivers sd
      WHERE sd.store_id = _store_id AND sd.driver_user_id = _driver_user_id
    ) THEN
      RAISE EXCEPTION 'Esse entregador não está vinculado à sua loja.';
    END IF;
  END IF;

  UPDATE public.orders
  SET assigned_driver_id = _driver_user_id
  WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_assign_order_driver(uuid, uuid) TO authenticated;