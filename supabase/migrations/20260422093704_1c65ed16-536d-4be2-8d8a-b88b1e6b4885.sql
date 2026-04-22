CREATE POLICY "Store drivers can read linked stores"
ON public.stores
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT store_id FROM public.store_drivers
    WHERE driver_user_id = auth.uid()
  )
);