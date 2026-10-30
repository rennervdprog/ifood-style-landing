-- Fase 5 do plano guest/bot — chave Pix fora da vista pública (P1-5) +
-- rate limit no rastreio público (P1-3).
--
-- PARTE A — chave Pix fora de stores_public
--
-- Causa raiz (auditoria 25/10, P1-5): a view stores_public (SELECT liberado
-- para anon) expunha pix_direto_key, pix_direto_key_type,
-- pix_direto_beneficiary, pix_direto_instructions e owner_id de todas as
-- lojas visíveis. Conferido ao vivo antes de escrever: SELECT anônimo em
-- stores_public devolveu a chave Pix real de 2 lojas (Cantinho da Silvia e
-- Pastelão Carioca) e o owner_id de todas. A exposição não era só na view:
-- a RPC store_bootstrap faz SELECT * FROM get_public_stores() e a edge
-- /api/store/:slug devolve o payload sem filtrar nada — a chave vazava
-- também pelo bootstrap (com cache de CDN).
--
-- O que muda aqui:
--   * get_public_stores() perde as 4 colunas de chave Pix e owner_id, e
--     ganha pix_direto_key_configured boolean (key IS NOT NULL AND
--     trim(key) <> '') para o checkout continuar sabendo se o Pix Direto
--     existe — sem ver a chave.
--   * store_bootstrap é recriado com o mesmo corpo, exceto a subquery de
--     owner_profile, que passa a resolver o dono com JOIN na tabela stores
--     (a função é SECURITY DEFINER e lê a tabela direto) em vez de ler
--     owner_id da CTE — sem isso a RPC quebraria com a coluna removida.
--   * Consumidores de owner_id em stores_public, conferidos no grep:
--       - StorePage.tsx: botão de WhatsApp da loja (vitrine anônima).
--         O id do dono passa a vir do bootstrap (owner_profile) e, no
--         sandbox, da tabela stores — front ajustado no mesmo PR.
--       - CheckoutPage.tsx (fundo, após criar o pedido): push "Novo
--         Pedido!" para o dono. Passa a usar a RPC estreita
--         get_order_store_owner (abaixo), no mesmo padrão de
--         get_store_pix_direto (só o cliente do pedido pode chamar).
--       - Todo o resto que lê owner_id já lia a tabela stores direto
--         (painel, admin, finanças) — nada muda.
--   * Nada muda em: PixDiretoPaymentPage (já usa get_store_pix_direto),
--     PublicOrderTracking (a chave chega pela edge guest-order-status,
--     validada por pedido), guest-checkout (lê stores direto, service_role),
--     painel do lojista (lê stores direto), public-store-catalog (o
--     baseSelect não tem as colunas removidas).
--
-- DDL (mesmo padrão da migration 20261025150000): trocar colunas do RETURNS
-- TABLE exige DROP + CREATE. O CASCADE derruba só a view stores_public
-- (inventário: único dependente de get_public_stores(); o store_bootstrap
-- referencia a função no corpo mas não tem entrada em pg_depend — é
-- recriado igual para revalidar). Grants reaplicados (perdidos no DROP).
-- Rollback: restaurar a definição anterior da função + view.
--
-- PARTE B — rate limit no rastreio público
--
-- Causa raiz (P1-3): guest-order-status aceita UUID + últimos 4 sem limite
-- de tentativas e devolve o pedido inteiro + PIN. Nova tabela
-- guest_tracking_attempts + checagem no início da edge: mais de 10
-- tentativas erradas em 10 min para o mesmo pedido → 429; mais de 30
-- erradas em 10 min para o mesmo IP (x-forwarded-for, quando disponível)
-- → 429. O últimos-4 CORRETO sempre passa (a trava é só contra
-- adivinhação). A própria função apaga registros com mais de 1 dia.
-- O PIN e a chave Pix continuam sendo devolvidos — o rate limit é a
-- proteção. Rollback: redeploy da versão anterior da edge; a tabela fica
-- parada, sem efeito.
--
-- Aplicação: esta migration vai no PR sem ser aplicada (a aplicação pede
-- palavra à parte). Exceção documentada: a tabela guest_tracking_attempts
-- (CREATE TABLE IF NOT EXISTS, inerte — nenhuma função de produção a lê
-- até o redeploy da edge) pode ser criada antes, só para o teste ao vivo
-- da cópia guest-order-status-teste; a aplicação da migration depois é
-- idempotente para a tabela.

-- ============ PARTE A ============

-- 1. DROP: o CASCADE derruba só a view stores_public.
DROP FUNCTION public.get_public_stores() CASCADE;

-- 2. Recria a função sem as colunas de chave Pix e sem owner_id, com
-- pix_direto_key_configured no lugar (logo após pix_direto_enabled).
CREATE FUNCTION public.get_public_stores()
 RETURNS TABLE(id uuid, name text, slug text, slug_aliases text[], image_url text, category store_category, categories store_category[], rating numeric, is_open boolean, force_closed boolean, status store_status, delivery_mode text, delivery_enabled boolean, own_delivery_fee numeric, delivery_fee numeric, delivery_radius numeric, delivery_fee_type text, delivery_base_km numeric, delivery_fee_base numeric, delivery_fee_per_km numeric, minimum_order_value numeric, free_delivery_threshold numeric, estimated_delivery_time text, max_delivery_km numeric, address_cep text, address_city text, address_complement text, address_neighborhood text, address_number text, address_reference text, address_state text, address_street text, latitude double precision, longitude double precision, settings jsonb, platform_fee_split text, preorder_enabled boolean, preorder_minutes_before integer, pix_direto_enabled boolean, pix_direto_key_configured boolean, guest_checkout_enabled boolean, network_id uuid, is_matriz boolean, is_visible boolean, created_at timestamp with time zone, plan_type text, platform_split_effective numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.name, s.slug, s.slug_aliases, s.image_url, s.category, s.categories, s.rating, s.is_open, s.force_closed, s.status, s.delivery_mode, s.delivery_enabled, s.own_delivery_fee, s.delivery_fee, s.delivery_radius, s.delivery_fee_type, s.delivery_base_km, s.delivery_fee_base, s.delivery_fee_per_km, s.minimum_order_value, s.free_delivery_threshold, s.estimated_delivery_time, s.max_delivery_km, s.address_cep, s.address_city, s.address_complement, s.address_neighborhood, s.address_number, s.address_reference, s.address_state, s.address_street, s.latitude, s.longitude,
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
    s.platform_fee_split, s.preorder_enabled, s.preorder_minutes_before, s.pix_direto_enabled,
    -- Pix Direto configurado, sem expor a chave (Fase 5).
    (s.pix_direto_key IS NOT NULL AND trim(s.pix_direto_key) <> '') AS pix_direto_key_configured,
    s.guest_checkout_enabled, s.network_id, s.is_matriz, s.is_visible, s.created_at, s.plan_type,
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

-- 3. Recria a view (derrubada pelo CASCADE) sem as colunas removidas.
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
    pix_direto_key_configured,
    guest_checkout_enabled,
    network_id,
    is_matriz,
    is_visible,
    created_at,
    plan_type,
    platform_split_effective
   FROM get_public_stores() get_public_stores(id, name, slug, slug_aliases, image_url, category, categories, rating, is_open, force_closed, status, delivery_mode, delivery_enabled, own_delivery_fee, delivery_fee, delivery_radius, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, minimum_order_value, free_delivery_threshold, estimated_delivery_time, max_delivery_km, address_cep, address_city, address_complement, address_neighborhood, address_number, address_reference, address_state, address_street, latitude, longitude, settings, platform_fee_split, preorder_enabled, preorder_minutes_before, pix_direto_enabled, pix_direto_key_configured, guest_checkout_enabled, network_id, is_matriz, is_visible, created_at, plan_type, platform_split_effective);

-- Grants da view (perdidos no DROP; espelham o estado anterior: ALL para
-- anon, authenticated e service_role; postgres e o dono e ja tem tudo).
GRANT ALL ON public.stores_public TO anon, authenticated, service_role;

-- 4. Revalida o store_bootstrap contra a funcao nova. Mesmo corpo da
-- definicao ao vivo, exceto owner_profile: o dono passa a ser resolvido
-- com JOIN na tabela stores (a funcao e SECURITY DEFINER), porque a CTE
-- nao tem mais owner_id. CREATE OR REPLACE mantem as ACLs dele.
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
      JOIN public.stores AS st ON st.owner_id = pr.user_id
      WHERE st.id = (SELECT id FROM s)
    ),
    'online_drivers_count', COALESCE((
      SELECT public.store_active_drivers_count((SELECT id FROM s))
    ), 0)
  );
$function$;

-- 5. RPC estreita para o push "Novo Pedido!" (CheckoutPage.tsx): devolve
-- o dono da loja do pedido, e só se quem chama for o cliente do pedido.
-- Mesmo padrão de get_store_pix_direto (migration 20261025100000).
CREATE OR REPLACE FUNCTION public.get_order_store_owner(p_order_id uuid)
 RETURNS TABLE(owner_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.owner_id
  FROM public.stores s
  JOIN public.orders o ON o.store_id = s.id
  WHERE o.id = p_order_id
    AND o.client_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.get_order_store_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_store_owner(uuid) TO authenticated;

-- ============ PARTE B ============

-- 6. Tabela do rate limit no rastreio público (Fase 5, parte B).
-- Idempotente (IF NOT EXISTS) para a tabela poder ser criada antes, só
-- para o teste ao vivo da cópia guest-order-status-teste — sem ela nenhuma
-- função de produção lê a tabela, então é inerte até o redeploy da edge.
CREATE TABLE IF NOT EXISTS public.guest_tracking_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  ip text
);

CREATE INDEX IF NOT EXISTS idx_guest_tracking_attempts_order_time
  ON public.guest_tracking_attempts (order_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_tracking_attempts_ip_time
  ON public.guest_tracking_attempts (ip, attempted_at DESC);

-- Sem policies: só service_role (a edge) lê/escreve; anon e authenticated
-- não veem nada.
ALTER TABLE public.guest_tracking_attempts ENABLE ROW LEVEL SECURITY;
