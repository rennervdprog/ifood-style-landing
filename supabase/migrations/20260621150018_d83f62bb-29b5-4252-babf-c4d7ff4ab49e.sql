CREATE OR REPLACE VIEW public.stores_public AS
SELECT id, name, slug, image_url, category, categories, rating, is_open, force_closed, status,
       delivery_mode, own_delivery_fee, created_at, owner_id, address_cep, address_city,
       address_complement, address_neighborhood, address_number, address_reference,
       address_state, address_street, latitude, longitude, settings, platform_fee_split
  FROM public.stores s
 WHERE is_test = false OR is_test IS NULL;