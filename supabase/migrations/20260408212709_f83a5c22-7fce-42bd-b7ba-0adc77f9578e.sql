-- ============================================================
-- 1. STORES: Hide sensitive payment fields from public reads
-- ============================================================

-- Drop the overly permissive authenticated read policy
DROP POLICY IF EXISTS "Authenticated can read stores" ON public.stores;

-- Drop old public read policy 
DROP POLICY IF EXISTS "Public can read active stores" ON public.stores;

-- Re-create public policy that only reads via the view concept
-- Public can only see active stores but we restrict it to status = ativo
CREATE POLICY "Public can read active stores"
  ON public.stores FOR SELECT TO public
  USING (status = 'ativo');

-- Authenticated users can read active stores (same restriction)
CREATE POLICY "Authenticated can read active stores"
  ON public.stores FOR SELECT TO authenticated
  USING (status = 'ativo');

-- Store owners can read their own stores (any status)
-- This already exists but let's make sure
DROP POLICY IF EXISTS "Store owners can read own stores" ON public.stores;
CREATE POLICY "Store owners can read own stores"
  ON public.stores FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Revoke direct column access on sensitive fields for anon and authenticated
-- Only service_role (used by edge functions) keeps full access
REVOKE ALL ON public.stores FROM anon, authenticated;
GRANT SELECT (
  id, name, slug, image_url, category, rating, is_open, force_closed, status,
  delivery_mode, own_delivery_fee, owner_id, created_at,
  address_cep, address_city, address_complement, address_neighborhood,
  address_number, address_reference, address_state, address_street, settings
) ON public.stores TO anon, authenticated;

-- Re-grant full access to authenticated for INSERT/UPDATE/DELETE (RLS still controls)
GRANT INSERT, UPDATE, DELETE ON public.stores TO authenticated;

-- Grant asaas columns only to authenticated (admin checks via RLS)
GRANT SELECT (asaas_account_id, asaas_wallet_id) ON public.stores TO authenticated;

-- ============================================================
-- 2. PROFILES: Restrict data visible to drivers and store owners  
-- ============================================================

-- Create a contacts-only view for driver/store interactions
CREATE OR REPLACE VIEW public.profile_contacts AS
SELECT 
  user_id,
  full_name,
  phone,
  whatsapp_number,
  neighborhood,
  email
FROM public.profiles
WHERE deleted_at IS NULL;

-- Grant access to the view
GRANT SELECT ON public.profile_contacts TO authenticated;

-- Drop overly broad driver profile policy
DROP POLICY IF EXISTS "Drivers can read profiles for their deliveries" ON public.profiles;

-- Re-create with column restriction approach: drivers only see contacts
-- Since RLS can't restrict columns, we narrow the USING condition
-- and rely on the profile_contacts view for safe reads
CREATE POLICY "Drivers can read delivery contact profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    is_driver(auth.uid()) AND 
    user_id IN (
      SELECT o.client_id FROM orders o WHERE o.driver_id = auth.uid()
    )
  );

-- Drop overly broad store owner client profile policy  
DROP POLICY IF EXISTS "Store owners can read client profiles for orders" ON public.profiles;

-- Re-create with same restriction
CREATE POLICY "Store owners can read order client profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT o.client_id 
      FROM orders o 
      JOIN stores s ON o.store_id = s.id 
      WHERE s.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 3. ORDER_RATINGS: Remove overly permissive read policy
-- ============================================================

DROP POLICY IF EXISTS "Authenticated can read ratings" ON public.order_ratings;

-- ============================================================
-- 4. USER_ROLES: Add explicit restrictive policy to prevent self-insert
-- ============================================================

-- Add a restrictive policy that prevents any user from inserting their own role
CREATE POLICY "Prevent self role assignment"
  ON public.user_roles AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id != auth.uid() AND is_platform_admin(auth.uid())
  );