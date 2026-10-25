-- Fase 4 — taxa exibida igual a cobrada (P1-N1) + "A partir de" so para km (P2-9)
--
-- Causa raiz: o payload publico da loja nao trazia o split da plataforma
-- (platform_delivery_split_override mora em store_plans, que o anon nao
-- enxerga), entao o front (describeStoreFee) caia sempre no padrao R$ 0,99.
-- A Aguia exibia R$ 4,99 e cobrava R$ 4,00; a Duda exibia R$ 0,99 e a
-- entrega e gratis (override 0 nos dois casos). A vitrine carregada ja se
-- corrigia via RPC get_store_platform_split; os cards nao tinham o contorno.
--
-- O que muda aqui: get_public_stores() passa a devolver o split JA RESOLVIDO
-- pelo servidor — platform_split_effective = COALESCE(override do plano
-- ativo, 0,99 do admin_settings), 0 quando autonomia — exatamente a mesma
-- regra de compute_store_delivery_fee (fonte da verdade do que e cobrado).
-- Verificado no banco antes de escrever: o valor novo bate com o
-- platform_split_full da RPC nas 25 lojas visiveis (0 divergencias).
-- Um lugar so: a view stores_public e o store_bootstrap herdam o campo.
--
-- ATENCAO — DDL: adicionar uma coluna ao RETURNS TABLE muda o tipo de
-- retorno, e CREATE OR REPLACE FUNCTION nao aceita mudar o tipo de retorno.
-- Por isso o DROP + CREATE abaixo. Inventario feito no banco antes:
--   * unico dependente de get_public_stores() e a view stores_public
--     (1 linha em pg_depend; o store_bootstrap referencia a funcao no corpo
--     mas nao tem entrada em pg_depend — ele e recriado igual no passo 4
--     para revalidar o corpo contra a funcao nova);
--   * a view nao tem RLS nem policies; os grants (ALL para anon,
--     authenticated e service_role) sao perdidos no DROP e reaplicados
--     no passo 3;
--   * a funcao nova nasce com EXECUTE para PUBLIC por padrao (igual a ACL
--     anterior); os grants explicitos do passo 2 espelham a ACL anterior.
-- Rollback: restaurar a definicao anterior da funcao + view (a exibicao
-- volta ao comportamento atual; nada do que e cobrado muda — quote-delivery
-- e create_order_with_items nao sao tocados por esta fase).
--
-- 1. DROP: o CASCADE derruba so a view stores_public.
DROP FUNCTION public.get_public_stores() CASCADE;

-- 2. Recria a funcao com platform_split_effective (ultima coluna).
CREATE FUNCTION public.get_public_stores()
 RETURNS TABLE(id uuid, name text, slug text, slug_aliases text[], image_url text, category store_category, categories store_category[], rating numeric, is_open boolean, force_closed boolean, status store_status, delivery_mode text, delivery_enabled boolean, own_delivery_fee numeric, delivery_fee numeric, delivery_radius numeric, delivery_fee_type text, delivery_base_km numeric, delivery_fee_base numeric, delivery_fee_per_km numeric, minimum_order_value numeric, free_delivery_threshold numeric, estimated_delivery_time text, max_delivery_km numeric, owner_id uuid, address_cep text, address_city text, address_complement text, address_neighborhood text, address_number text, address_reference text, address_state text, address_street text, latitude double precision, longitude double precision, settings jsonb, platform_fee_split text, preorder_enabled boolean, preorder_minutes_before integer, pix_direto_enabled boolean, pix_direto_key text, pix_direto_key_type text, pix_direto_beneficiary text, pix_direto_instructions text, guest_checkout_enabled boolean, network_id uuid, is_matriz boolean, is_visible boolean, created_at timestamp with time zone, plan_type text, platform_split_effective numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.name, s.slug, s.slug_aliases, s.image_url, s.category, s.categories, s.rating, s.is_open, s.force_closed, s.status, s.delivery_mode, s.delivery_enabled, s.own_delivery_fee, s.delivery_fee, s.delivery_radius, s.delivery_fee_type, s.delivery_base_km, s.delivery_fee_base, s.delivery_fee_per_km, s.minimum_order_value, s.free_delivery_threshold, s.estimated_delivery_time, s.max_delivery_km, s.owner_id, s.address_cep, s.address_city, s.address_complement, s.address_neighborhood, s.address_number, s.address_reference, s.address_state, s.address_street, s.latitude, s.longitude,
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
    s.platform_fee_split, s.preorder_enabled, s.preorder_minutes_before, s.pix_direto_enabled, s.pix_direto_key, s.pix_direto_key_type, s.pix_direto_beneficiary, s.pix_direto_instructions, s.guest_checkout_enabled, s.network_id, s.is_matriz, s.is_visible, s.created_at, s.plan_type,
    -- Split resolvido no servidor (mesma regra de compute_store_delivery_fee):
    -- override do plano ativo > 0,99 do admin_settings; 0 quando autonomia.
    CASE WHEN ap.ptype::text = 'autonomy' OR COALESCE(ap.autofree, false) THEN 0
         ELSE COALESCE(ap.override, adm.admin_split, 0.99)
    END AS platform_split_effective
  FROM public.stores AS s
  LEFT JOIN LATERAL (
    SELECT sp.platform_delivery_split_override AS override,
           sp.plan_type AS ptype,
           sp.autonomy_lifetime_free AS autofree
    FROM public.store_plans sp
    WHERE sp.store_id = s.id AND sp.is_active = true
    ORDER BY sp.started_at DESC LIMIT 1
  ) ap ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(((value->>'platform_split')::numeric), 0.99) AS admin_split
    FROM public.admin_settings WHERE key = 'delivery_fee_config' LIMIT 1
  ) adm ON true
  WHERE (s.is_test = false OR s.is_test IS NULL) AND s.is_visible IS TRUE;
$function$;

-- Grants da funcao (espelham a ACL anterior: PUBLIC + anon/authenticated/service_role).
GRANT EXECUTE ON FUNCTION public.get_public_stores() TO anon, authenticated, service_role;

-- 3. Recria a view (derrubada pelo CASCADE) com o campo novo por ultimo.
CREATE VIEW public.stores_public AS
 SELECT id,
    name,
    slug,
    slug_aliases,
    image_url,
    category,
    categories,
    rating,
    is_open,
    force_closed,
    status,
    delivery_mode,
    delivery_enabled,
    own_delivery_fee,
    delivery_fee,
    delivery_radius,
    delivery_fee_type,
    delivery_base_km,
    delivery_fee_base,
    delivery_fee_per_km,
    minimum_order_value,
    free_delivery_threshold,
    estimated_delivery_time,
    max_delivery_km,
    owner_id,
    address_cep,
    address_city,
    address_complement,
    address_neighborhood,
    address_number,
    address_reference,
    address_state,
    address_street,
    latitude,
    longitude,
    settings,
    platform_fee_split,
    preorder_enabled,
    preorder_minutes_before,
    pix_direto_enabled,
    pix_direto_key,
    pix_direto_key_type,
    pix_direto_beneficiary,
    pix_direto_instructions,
    guest_checkout_enabled,
    network_id,
    is_matriz,
    is_visible,
    created_at,
    plan_type,
    platform_split_effective
   FROM get_public_stores() get_public_stores(id, name, slug, slug_aliases, image_url, category, categories, rating, is_open, force_closed, status, delivery_mode, delivery_enabled, own_delivery_fee, delivery_fee, delivery_radius, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, minimum_order_value, free_delivery_threshold, estimated_delivery_time, max_delivery_km, owner_id, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings, platform_fee_split, preorder_enabled, preorder_minutes_before, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, pix_direto_instructions, guest_checkout_enabled, network_id, is_matriz, is_visible, created_at, plan_type, platform_split_effective);

-- Grants da view (perdidos no DROP; espelham o estado anterior: ALL para
-- anon, authenticated e service_role; postgres e o dono e ja tem tudo).
GRANT ALL ON public.stores_public TO anon, authenticated, service_role;

-- 4. Revalida o store_bootstrap contra a funcao nova (mesmo corpo e mesma
-- assinatura da definicao ao vivo — CREATE OR REPLACE mantem as ACLs dele).
CREATE OR REPLACE FUNCTION public.store_bootstrap(_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH s AS (
    SELECT *
    FROM public.get_public_stores()
    WHERE slug = _slug
       OR id::text = _slug
       OR _slug = ANY(slug_aliases)
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'store', (SELECT to_jsonb(s) FROM s),
    'hours', COALESCE((
      SELECT jsonb_agg(to_jsonb(h.*))
      FROM public.opening_hours AS h
      WHERE h.store_id = (SELECT id FROM s)
    ), '[]'::jsonb),
    'sections', COALESCE((
      SELECT jsonb_agg(to_jsonb(sec.*) ORDER BY sec.sort_order)
      FROM public.menu_sections AS sec
      WHERE sec.store_id = (SELECT id FROM s)
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*))
      FROM public.products AS p
      WHERE p.store_id = (SELECT id FROM s)
        AND p.is_available IS NOT FALSE
        AND COALESCE((p.metadata->'hidden')::boolean, false) = false
    ), '[]'::jsonb),
    'owner_profile', (
      SELECT jsonb_build_object('id', pr.id, 'whatsapp_number', pr.whatsapp_number)
      FROM public.profiles AS pr
      WHERE pr.user_id = (SELECT owner_id FROM s)
    ),
    'online_drivers_count', COALESCE((
      SELECT public.store_active_drivers_count((SELECT id FROM s))
    ), 0)
  );
$function$;
