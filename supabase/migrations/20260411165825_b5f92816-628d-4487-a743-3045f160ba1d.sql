CREATE POLICY "Store owners can read linked driver profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT sd.driver_user_id
    FROM public.store_drivers sd
    JOIN public.stores s ON sd.store_id = s.id
    WHERE s.owner_id = auth.uid()
  )
);