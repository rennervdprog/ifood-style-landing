-- 1. Remove overly broad public SELECT on stores (exposes asaas_account_id, asaas_wallet_id)
DROP POLICY IF EXISTS "Public can read active stores" ON public.stores;

-- 2. Re-create public policy on the stores_public VIEW only (which already excludes sensitive fields)
-- The stores_public view already exists and excludes asaas_account_id, asaas_wallet_id, commission_rate, settings
-- Public users should use stores_public; authenticated users keep their existing policies on stores table

-- 3. Fix driver city self-update: restrict drivers from changing their own city
DROP POLICY IF EXISTS "Drivers can update own online status" ON public.drivers;

CREATE POLICY "Drivers can update own online status"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND is_active = (SELECT d.is_active FROM drivers d WHERE d.user_id = auth.uid())
  AND name = (SELECT d.name FROM drivers d WHERE d.user_id = auth.uid())
  AND city IS NOT DISTINCT FROM (SELECT d.city FROM drivers d WHERE d.user_id = auth.uid())
);