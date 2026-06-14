DROP POLICY IF EXISTS "Store drivers can read linked stores" ON public.stores;
DROP POLICY IF EXISTS "Store drivers can read assigned store" ON public.stores;

CREATE POLICY "Store drivers can read linked stores"
ON public.stores
FOR SELECT
TO authenticated
USING (public.is_store_driver_member(auth.uid(), id));