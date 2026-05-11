DROP VIEW IF EXISTS public.stores_public;

CREATE VIEW public.stores_public
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.image_url,
  s.category,
  s.categories,
  s.rating,
  s.is_open,
  s.force_closed,
  s.status,
  s.delivery_mode,
  s.own_delivery_fee,
  s.created_at,
  s.owner_id,
  s.address_cep,
  s.address_city,
  s.address_complement,
  s.address_neighborhood,
  s.address_number,
  s.address_reference,
  s.address_state,
  s.address_street,
  s.latitude,
  s.longitude,
  s.settings
FROM public.stores s
WHERE s.is_test = false OR s.is_test IS NULL;

GRANT SELECT ON public.stores_public TO anon, authenticated;