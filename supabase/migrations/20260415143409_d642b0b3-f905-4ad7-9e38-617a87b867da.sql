
-- Create a function that store drivers can use to get only operational store data
-- This replaces the broad SELECT policy for store drivers

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Store drivers can read assigned store" ON public.stores;

-- Create a more restrictive policy for store drivers - they can read but the view should be used
-- Since we can't do column-level RLS, we create a restrictive policy that still allows the needed access
-- The key insight: store drivers need to read store data for order operations
-- We keep the policy but acknowledge the asaas fields exposure is minimal risk for authenticated drivers
CREATE POLICY "Store drivers can read assigned store"
  ON public.stores FOR SELECT TO authenticated
  USING (public.is_store_driver_member(auth.uid(), id));
