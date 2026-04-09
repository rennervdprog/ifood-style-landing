
-- Drop the restrictive policy that was already applied
DROP POLICY IF EXISTS "Authenticated can read stores for orders" ON public.stores;

-- Drop and recreate view with settings column
DROP VIEW IF EXISTS public.stores_public;

CREATE VIEW public.stores_public AS
SELECT
  id, name, slug, image_url, category, rating, is_open, force_closed,
  status, delivery_mode, own_delivery_fee, created_at, owner_id,
  address_cep, address_city, address_complement, address_neighborhood,
  address_number, address_reference, address_state, address_street,
  settings
FROM public.stores;

GRANT SELECT ON public.stores_public TO anon;
GRANT SELECT ON public.stores_public TO authenticated;
