
-- 1. Fix stores: allow public to read both ativo AND bloqueado stores
DROP POLICY IF EXISTS "Anyone can read active stores" ON public.stores;

CREATE POLICY "Anyone can read browsable stores"
ON public.stores
FOR SELECT
TO public
USING (status IN ('ativo'::store_status, 'bloqueado'::store_status));

-- 2. Fix store_plans: allow public read-only access (needed by useStorePlan on public store pages)
CREATE POLICY "Anyone can read store plan type"
ON public.store_plans
FOR SELECT
TO public
USING (true);
