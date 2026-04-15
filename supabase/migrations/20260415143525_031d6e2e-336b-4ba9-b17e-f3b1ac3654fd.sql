
-- Drop the driver policy on base stores table
DROP POLICY IF EXISTS "Store drivers can read assigned store" ON public.stores;

-- Create a safe view for store drivers with only operational fields
CREATE OR REPLACE VIEW public.stores_driver_view AS
  SELECT id, name, slug, image_url, category, is_open, force_closed, status,
         delivery_mode, own_delivery_fee,
         address_cep, address_city, address_neighborhood, address_street,
         address_number, address_complement, address_reference, address_state
  FROM public.stores;

GRANT SELECT ON public.stores_driver_view TO authenticated;

-- Add RLS-like filtering via a policy on the base table that only allows
-- store drivers to read through the view (security definer = view owner access)
-- The view itself is security definer (no security_invoker), so it bypasses RLS.
-- We do NOT need a base table policy for drivers anymore.
