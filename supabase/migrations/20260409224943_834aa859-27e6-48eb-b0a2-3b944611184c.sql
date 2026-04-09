
-- 1. STORES: Remove policy that exposes full row to all authenticated users
DROP POLICY IF EXISTS "Authenticated can read active stores" ON public.stores;

-- Add policy for anon/public to read via stores_public view (view already excludes sensitive columns)
-- The stores_public view is defined as SELECT without asaas_account_id, asaas_wallet_id, commission_rate, settings
-- Grant anon access to stores_public so unauthenticated store browsing works
GRANT SELECT ON public.stores_public TO anon;
GRANT SELECT ON public.stores_public TO authenticated;

-- Add a restricted stores policy: only active stores, only for browsing (uses view)
-- Store owners and admins already have their own policies
CREATE POLICY "Public can read active stores via view"
ON public.stores
FOR SELECT
TO anon
USING (status = 'ativo'::store_status);

-- Authenticated non-owner, non-admin users need stores access for orders/checkout
-- But restrict to only active/blocked stores they interact with
CREATE POLICY "Authenticated can read stores for orders"
ON public.stores
FOR SELECT
TO authenticated
USING (
  status IN ('ativo'::store_status, 'bloqueado'::store_status)
  AND (
    -- Store owner
    owner_id = auth.uid()
    -- Admin
    OR is_platform_admin(auth.uid())
    -- Client with orders at this store
    OR id IN (SELECT store_id FROM orders WHERE client_id = auth.uid())
    -- Driver with orders at this store  
    OR id IN (SELECT store_id FROM orders WHERE driver_id = auth.uid())
  )
);

-- 2. PROFILES: Replace broad policies with restricted ones
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Store owners can read order client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Drivers can read delivery contact profiles" ON public.profiles;

-- Grant access to the profile_contacts view (already has only name, phone, whatsapp, neighborhood)
GRANT SELECT ON public.profile_contacts TO authenticated;

-- 3. COUPONS: Replace broad policy with view access
DROP POLICY IF EXISTS "Authenticated can read active coupons" ON public.coupons;

-- Grant access to coupons_public view (excludes used_count, max_uses)
GRANT SELECT ON public.coupons_public TO authenticated;
GRANT SELECT ON public.coupons_public TO anon;
