
-- 3. Restrict online drivers visibility
DROP POLICY IF EXISTS "Authenticated can read online drivers" ON public.drivers;
CREATE POLICY "Admins and store owners can read online drivers"
  ON public.drivers FOR SELECT
  TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.stores WHERE owner_id = auth.uid()
    )
  );
