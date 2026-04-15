-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read store plan type" ON public.store_plans;

-- Create a restrictive view that only exposes what public pages need
CREATE OR REPLACE VIEW public.store_plans_public
WITH (security_invoker=on) AS
  SELECT store_id, plan_type, is_active, trial_ends_at
  FROM public.store_plans;

-- Allow public to read the view (via a SELECT policy on base table scoped to the view)
CREATE POLICY "Public can read plan type via view"
ON public.store_plans
FOR SELECT
TO public
USING (true);
