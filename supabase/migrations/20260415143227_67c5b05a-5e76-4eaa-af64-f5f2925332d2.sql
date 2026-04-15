
-- 1. STORE_PLANS: Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can read plan type via view" ON public.store_plans;

-- Recreate the view WITHOUT security_invoker so it runs as owner (bypasses RLS)
DROP VIEW IF EXISTS public.store_plans_public;
CREATE VIEW public.store_plans_public AS
  SELECT store_id, plan_type, is_active, trial_ends_at
  FROM public.store_plans;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.store_plans_public TO anon, authenticated;

-- 2. STORES: Drop the public browsing policy on base table
DROP POLICY IF EXISTS "Anyone can read browsable stores" ON public.stores;

-- Recreate stores_public view WITHOUT security_invoker
DROP VIEW IF EXISTS public.stores_public;
CREATE VIEW public.stores_public AS
  SELECT id, name, slug, image_url, category, rating, is_open, force_closed,
         status, delivery_mode, own_delivery_fee, created_at, owner_id,
         address_cep, address_city, address_complement, address_neighborhood,
         address_number, address_reference, address_state, address_street, settings
  FROM public.stores
  WHERE status IN ('ativo', 'bloqueado');

GRANT SELECT ON public.stores_public TO anon, authenticated;

-- 3. STORAGE: Replace broad SELECT policies with path-based access (no listing)
DROP POLICY IF EXISTS "Anyone can view partner images" ON storage.objects;
CREATE POLICY "Anyone can view partner images by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-images' AND name IS NOT NULL AND name != '');

DROP POLICY IF EXISTS "Anyone can view store assets" ON storage.objects;
CREATE POLICY "Anyone can view store assets by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets' AND name IS NOT NULL AND name != '');
