-- Correção definitiva do catálogo público.
-- `plan_type` passa a ser retornado pela função SECURITY DEFINER existente,
-- permitindo que a view continue com security_invoker=true sem consultar `stores` diretamente.

BEGIN;

DROP VIEW public.stores_public;
DROP FUNCTION public.get_public_stores();

CREATE FUNCTION public.get_public_stores()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  slug_aliases text[],
  image_url text,
  category public.store_category,
  categories public.store_category[],
  rating numeric,
  is_open boolean,
  force_closed boolean,
  status public.store_status,
  delivery_mode text,
  delivery_enabled boolean,
  own_delivery_fee numeric,
  delivery_fee numeric,
  delivery_radius numeric,
  delivery_fee_type text,
  delivery_base_km numeric,
  delivery_fee_base numeric,
  delivery_fee_per_km numeric,
  minimum_order_value numeric,
  free_delivery_threshold numeric,
  estimated_delivery_time text,
  max_delivery_km numeric,
  owner_id uuid,
  address_cep text,
  address_city text,
  address_complement text,
  address_neighborhood text,
  address_number text,
  address_reference text,
  address_state text,
  address_street text,
  latitude double precision,
  longitude double precision,
  settings jsonb,
  platform_fee_split text,
  preorder_enabled boolean,
  preorder_minutes_before integer,
  pix_direto_enabled boolean,
  pix_direto_key text,
  pix_direto_key_type text,
  pix_direto_beneficiary text,
  pix_direto_instructions text,
  guest_checkout_enabled boolean,
  network_id uuid,
  is_matriz boolean,
  is_visible boolean,
  created_at timestamp with time zone,
  plan_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    s.id,
    s.name,
    s.slug,
    s.slug_aliases,
    s.image_url,
    s.category,
    s.categories,
    s.rating,
    s.is_open,
    s.force_closed,
    s.status,
    s.delivery_mode,
    s.delivery_enabled,
    s.own_delivery_fee,
    s.delivery_fee,
    s.delivery_radius,
    s.delivery_fee_type,
    s.delivery_base_km,
    s.delivery_fee_base,
    s.delivery_fee_per_km,
    s.minimum_order_value,
    s.free_delivery_threshold,
    s.estimated_delivery_time,
    s.max_delivery_km,
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
    jsonb_strip_nulls(jsonb_build_object(
      'accept_pix_online', s.settings -> 'accept_pix_online',
      'accept_pix_machine', s.settings -> 'accept_pix_machine',
      'accept_card', s.settings -> 'accept_card',
      'accept_cash', s.settings -> 'accept_cash',
      'delivery_base_km', s.settings -> 'delivery_base_km',
      'delivery_fee_base', s.settings -> 'delivery_fee_base',
      'delivery_fee_per_km', s.settings -> 'delivery_fee_per_km',
      'delivery_fee_type', s.settings -> 'delivery_fee_type',
      'delivery_time_min', s.settings -> 'delivery_time_min',
      'delivery_time_max', s.settings -> 'delivery_time_max',
      'pizza_half_enabled', s.settings -> 'pizza_half_enabled',
      'pizza_price_mode', s.settings -> 'pizza_price_mode',
      'pizza_config', s.settings -> 'pizza_config',
      'pizza_flavor_categories', s.settings -> 'pizza_flavor_categories',
      'pizza_price_matrix', s.settings -> 'pizza_price_matrix',
      'pizza_single_size', s.settings -> 'pizza_single_size',
      'pizza_sizes_catalog', s.settings -> 'pizza_sizes_catalog',
      'pastel_config', s.settings -> 'pastel_config'
    )),
    s.platform_fee_split,
    s.preorder_enabled,
    s.preorder_minutes_before,
    s.pix_direto_enabled,
    s.pix_direto_key,
    s.pix_direto_key_type,
    s.pix_direto_beneficiary,
    s.pix_direto_instructions,
    s.guest_checkout_enabled,
    s.network_id,
    s.is_matriz,
    s.is_visible,
    s.created_at,
    s.plan_type
  FROM public.stores AS s
  WHERE s.is_test = false OR s.is_test IS NULL;
$function$;

CREATE VIEW public.stores_public
WITH (security_invoker = true)
AS
SELECT * FROM public.get_public_stores();

GRANT EXECUTE ON FUNCTION public.get_public_stores() TO anon, authenticated;
GRANT SELECT ON public.stores_public TO anon, authenticated;

COMMENT ON VIEW public.stores_public IS
  'Catálogo público de lojas. plan_type permite ao cliente ocultar lojas exclusivamente PDV.';

COMMIT;
