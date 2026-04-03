-- Fix: Restrict driver self-update to only is_online column
DROP POLICY IF EXISTS "Drivers can update own online status" ON public.drivers;
DROP POLICY IF EXISTS "No direct driver update" ON public.drivers;

-- Create a restrictive policy that only allows drivers to update is_online
CREATE POLICY "Drivers can update own online status"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND is_active = (SELECT d.is_active FROM public.drivers d WHERE d.user_id = auth.uid())
  AND name = (SELECT d.name FROM public.drivers d WHERE d.user_id = auth.uid())
);

-- Fix: Make order_ratings require authentication for reads
DROP POLICY IF EXISTS "Anyone can read ratings" ON public.order_ratings;

CREATE POLICY "Authenticated can read ratings"
ON public.order_ratings
FOR SELECT
TO authenticated
USING (true);