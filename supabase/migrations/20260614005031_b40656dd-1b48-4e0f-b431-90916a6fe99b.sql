DROP POLICY IF EXISTS "Store owners can read linked driver profiles" ON public.profiles;

CREATE POLICY "Store owners can read linked driver profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.store_drivers sd
    WHERE sd.driver_user_id = profiles.user_id
      AND public.is_store_owner(auth.uid(), sd.store_id)
  )
);