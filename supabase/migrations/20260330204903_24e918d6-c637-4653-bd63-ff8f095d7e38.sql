
-- Allow store owners to read profiles of clients who ordered from their store
CREATE POLICY "Store owners can read client profiles for orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT o.client_id FROM public.orders o
    JOIN public.stores s ON o.store_id = s.id
    WHERE s.owner_id = auth.uid()
  )
);

-- Allow drivers to read profiles of clients/store owners for their deliveries
CREATE POLICY "Drivers can read profiles for their deliveries"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_driver(auth.uid()) AND (
    user_id IN (
      SELECT o.client_id FROM public.orders o WHERE o.driver_id = auth.uid()
    )
    OR
    user_id IN (
      SELECT s.owner_id FROM public.stores s
      JOIN public.orders o ON o.store_id = s.id
      WHERE o.driver_id = auth.uid()
    )
  )
);
