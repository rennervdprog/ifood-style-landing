-- Drop and recreate the view to ensure column order doesn't cause issues
DROP VIEW IF EXISTS public.stores_public;

CREATE OR REPLACE VIEW public.stores_public AS
SELECT 
    id, name, slug, image_url, category, categories, rating, is_open, force_closed, 
    status, delivery_mode, own_delivery_fee, created_at, owner_id, address_cep, 
    address_city, address_complement, address_neighborhood, address_number, 
    address_reference, address_state, address_street, settings,
    delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km
FROM public.stores;
