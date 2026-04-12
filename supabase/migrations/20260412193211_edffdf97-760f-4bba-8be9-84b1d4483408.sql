
-- Remove overly broad SELECT policies that expose sensitive financial fields
DROP POLICY IF EXISTS "Authenticated can browse active stores" ON public.stores;
DROP POLICY IF EXISTS "Public can read active stores via view" ON public.stores;

-- Add a policy so drivers linked to a store can read it (needed for delivery flow)
CREATE POLICY "Store drivers can read assigned store"
ON public.stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_drivers sd
    WHERE sd.store_id = stores.id
    AND sd.driver_user_id = auth.uid()
  )
);
