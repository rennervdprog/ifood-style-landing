-- 1) Create a public-safe view for stores (excludes Asaas credentials)
CREATE OR REPLACE VIEW public.stores_public AS
SELECT
  id, name, slug, image_url, category, rating, is_open, force_closed,
  status, delivery_mode, own_delivery_fee, created_at, owner_id,
  address_cep, address_city, address_complement, address_neighborhood,
  address_number, address_reference, address_state, address_street
FROM public.stores;

-- 2) Drop the overly permissive public SELECT policy on stores
DROP POLICY IF EXISTS "Anyone can read stores" ON public.stores;

-- 3) Add authenticated-only read policy
CREATE POLICY "Authenticated can read stores"
ON public.stores FOR SELECT TO authenticated
USING (true);

-- 4) Create a public-safe view for coupons (excludes business metrics)
CREATE OR REPLACE VIEW public.coupons_public AS
SELECT
  id, code, discount_type, discount_value, min_order_value,
  expires_at, is_active, store_id, first_order_only, description
FROM public.coupons
WHERE is_active = true;

-- 5) Drop overly permissive public coupon policy  
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;

-- 6) Add authenticated-only read for active coupons
CREATE POLICY "Authenticated can read active coupons"
ON public.coupons FOR SELECT TO authenticated
USING (is_active = true);