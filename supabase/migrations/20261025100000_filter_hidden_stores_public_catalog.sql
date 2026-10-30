-- Fase 1 — fechar o vazamento de lojas ocultas (P0-N1)
-- get_public_stores() filtrava so is_test: lojas com is_visible=false
-- (Bittenca's, Loja Demonstracao e outras 7) apareciam na vitrine publica
-- e aceitavam pedido. A view stores_public le esta funcao, entao herda
-- o filtro sozinha — nenhuma mudanca nela nem no store_bootstrap.
-- Nenhuma linha de dado muda; o rollback e so restaurar a definicao anterior.

CREATE OR REPLACE FUNCTION public.get_public_stores()
 RETURNS TABLE(id uuid, name text, slug text, slug_aliases text[], image_url text, category store_category, categories store_category[], rating numeric, is_open boolean, force_closed boolean, status store_status, delivery_mode text, delivery_enabled boolean, own_delivery_fee numeric, delivery_fee numeric, delivery_radius numeric, delivery_fee_type text, delivery_base_km numeric, delivery_fee_base numeric, delivery_fee_per_km numeric, minimum_order_value numeric, free_delivery_threshold numeric, estimated_delivery_time text, max_delivery_km numeric, owner_id uuid, address_cep text, address_city text, address_complement text, address_neighborhood text, address_number text, address_reference text, address_state text, address_street text, latitude double precision, longitude double precision, settings jsonb, platform_fee_split text, preorder_enabled boolean, preorder_minutes_before integer, pix_direto_enabled boolean, pix_direto_key text, pix_direto_key_type text, pix_direto_beneficiary text, pix_direto_instructions text, guest_checkout_enabled boolean, network_id uuid, is_matriz boolean, is_visible boolean, created_at timestamp with time zone, plan_type text)
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
    s.platform_fee_split, s.preorder_enabled, s.preorder_minutes_before, s.pix_direto_enabled, s.pix_direto_key, s.pix_direto_key_type, s.pix_direto_beneficiary, s.pix_direto_instructions, s.guest_checkout_enabled, s.network_id, s.is_matriz, s.is_visible, s.created_at, s.plan_type
  FROM public.stores AS s
  WHERE (s.is_test = false OR s.is_test IS NULL) AND s.is_visible IS TRUE;
$function$;

-- RPC estreita para o historico do motoboy (DriverRideHistory.tsx):
-- o motoboy NAO pode ler a tabela stores direto (RLS: so dono/gestor/admin),
-- mas precisa do nome + coordenadas das lojas onde entregou. Devolve so
-- id/nome/lat/lng, e so das lojas onde ele tem pedido entregue ou das
-- quais e dono/gestor/admin.
CREATE OR REPLACE FUNCTION public.get_driver_history_stores(p_store_ids uuid[])
 RETURNS TABLE(id uuid, name text, latitude double precision, longitude double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.name, s.latitude, s.longitude
  FROM public.stores s
  WHERE s.id = ANY(p_store_ids)
    AND (
      s.owner_id = auth.uid()
      OR public.is_platform_admin(auth.uid())
      OR public.is_unit_manager(auth.uid(), s.id)
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.store_id = s.id AND o.driver_id = auth.uid()
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.get_driver_history_stores(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_history_stores(uuid[]) TO authenticated;

-- RPC estreita para o pagamento Pix Direto (PixDiretoPaymentPage.tsx):
-- o cliente NAO pode ler a tabela stores direto (RLS), mas precisa da
-- chave Pix da loja do pedido dele. Devolve so os campos do Pix Direto,
-- e so se quem chama for o cliente do pedido, o dono da loja, gestor
-- da unidade ou admin da plataforma.
CREATE OR REPLACE FUNCTION public.get_store_pix_direto(p_order_id uuid)
 RETURNS TABLE(name text, pix_direto_key text, pix_direto_key_type text, pix_direto_beneficiary text, pix_direto_instructions text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.name, s.pix_direto_key, s.pix_direto_key_type, s.pix_direto_beneficiary, s.pix_direto_instructions
  FROM public.stores s
  JOIN public.orders o ON o.store_id = s.id
  WHERE o.id = p_order_id
    AND (
      o.client_id = auth.uid()
      OR s.owner_id = auth.uid()
      OR public.is_platform_admin(auth.uid())
      OR public.is_unit_manager(auth.uid(), s.id)
    );
$function$;

REVOKE ALL ON FUNCTION public.get_store_pix_direto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_pix_direto(uuid) TO authenticated;
