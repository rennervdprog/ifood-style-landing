-- ============================================================================
-- Fase 6A (plano guest/bot §8, 6A) — endurecer a RPC create_order_with_items
-- NAO APLICAR AINDA: esta migration vai no PR draft sem aplicar em producao.
-- A publicacao (merge + apply) pede a palavra do Renner a parte.
--
--  P1-6 (decisao f: MANTER + LOGAR): o fallback de preco do helper
--       (adicional nao resolvido + produto com grupo price_replaces_base)
--       continua devolvendo o preco do cliente, mas agora registra cada
--       disparo em price_fallback_log para a loja corrigir o catalogo.
--       A funcao create_order_expected_item_price passa de STABLE para
--       VOLATILE porque agora escreve (log) — STABLE permitiria ao
--       planner avaliar/cachear a chamada e sumir com o log.
--  P2-1: whitelist de payment_method na RPC: so pix_direto, pix_machine,
--       cartao, dinheiro. Verificado: todos os chamadores atuais mandam
--       so esses valores (guest-checkout, checkout logado, bot mapeado).
--  P2-2: change_for validado na RPC: needs_change=true exige change_for
--       >= total do pedido.
--  P2-4: award_loyalty_points nao credita pedido guest.
--
-- As funcoes sao redefinidas INTEIRAS (CREATE OR REPLACE) com os corpos
-- exatos das fontes + os edits acima, nada mais.
-- Origens: 20261025120000_fase3_pedido_transacional.sql (preco),
-- 20261025130000_fase3_status_cast_fix.sql (RPC) e o corpo AO VIVO de
-- award_loyalty_points (pg_get_functiondef, 2026-10-26).
--
-- DIVERGENCIAS DO PLANO (o plano mandava copiar os corpos dos arquivos
-- indicados; os corpos ao vivo sao diferentes em 2 pontos — provado no
-- dry-run, que falhou com 42804 antes do ajuste):
--  1. RPC: o arquivo da Fase 3 nao tem o cast v_order_status::order_status
--     (migration 20261025130000). Redefinir a partir dele faria o INSERT
--     falhar ("column status is of type order_status but expression is
--     of type text") e rejeitaria TODO pedido valido. Fonte corrigida
--     para o arquivo do cast-fix, identico ao vivo (diff vazio).
--  2. award_loyalty_points: o arquivo 20260409 (linha 26, citado no plano)
--     NAO e o corpo ao vivo. O vivo tem o guarda
--     IF NEW.client_id IS NULL THEN RETURN NEW; END IF; e a base de
--     calculo _base_value = subtotal - loyalty_discount. Nenhuma migration
--     do repo define o corpo vivo — ele foi aplicado fora das migrations.
--     Redefinir a partir do arquivo 20260409 regrediria os dois pontos.
--     Fonte corrigida para o pg_get_functiondef ao vivo (2026-10-26),
--     guardado em live_award_loyalty_points_20261026.sql (apoio, fora
--     do commit).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- P1-6: log de disparos do atalho de preco
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_fallback_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid,
  product_id uuid,
  addon_entry jsonb,
  client_price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_fallback_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can read own price fallback log"
  ON public.price_fallback_log;
CREATE POLICY "Store owners can read own price fallback log"
  ON public.price_fallback_log FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS price_fallback_log_store_created_idx
  ON public.price_fallback_log (store_id, created_at DESC);

COMMENT ON TABLE public.price_fallback_log IS
  'Fase 6A (P1-6): cada disparo do atalho de preco do helper (adicional nao resolvido + grupo price_replaces_base). A loja corrige o catalogo a partir daqui.';

-- ---------------------------------------------------------------------------
-- P1-6: create_order_expected_item_price redefinida (corpo exato da Fase 3
-- + INSERT no log no fallback; STABLE -> VOLATILE, ver cabecalho)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_expected_item_price(
  p_store_id uuid,
  p_product_id uuid,
  p_client_price numeric,
  p_addons jsonb
)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product record;
  v_addons jsonb := '[]'::jsonb;
  v_tmp jsonb;
  v_entry jsonb;
  v_lookup_entry jsonb;
  v_name text;
  v_lookup_name text;
  v_entry_price numeric;
  v_qty integer;
  v_size_name text;
  v_size_price numeric := 0;
  v_eff_promo numeric;
  v_eff_plain numeric;
  v_base_promo numeric;
  v_base_plain numeric;
  v_mode text;
  v_has_repl boolean := false;
  v_is_builder boolean := false;
  v_half_count integer := 0;
  v_third_count integer := 0;
  v_quarter_count integer := 0;
  v_normal_total numeric := 0;
  v_repl_gkeys text[] := '{}';
  v_repl_names text[] := '{}';
  v_repl_unit_prices numeric[] := '{}';
  v_repl_line_prices numeric[] := '{}';
  v_flavor_prices_promo numeric[] := '{}';
  v_flavor_prices_plain numeric[] := '{}';
  v_lookup record;
  v_repl_total numeric := 0;
  v_exp_promo numeric;
  v_exp_plain numeric;
  v_flavor_product record;
  v_flavor_name text;
  v_flavor_stripped text;
  v_flavor_id_text text;
  v_flavor_size_price numeric;
  v_flavor_eff_promo numeric;
  v_flavor_eff_plain numeric;
  v_n integer;
BEGIN
  -- 3.1 Normalizar adicionais (array, string duplamente codificada ou nulo).
  IF p_addons IS NOT NULL THEN
    IF jsonb_typeof(p_addons) = 'array' THEN
      v_addons := p_addons;
    ELSIF jsonb_typeof(p_addons) = 'string' THEN
      BEGIN
        v_tmp := (p_addons #>> '{}')::jsonb;
        IF jsonb_typeof(v_tmp) = 'array' THEN v_addons := v_tmp; END IF;
      EXCEPTION WHEN OTHERS THEN
        v_addons := '[]'::jsonb;
      END;
    END IF;
  END IF;

  -- 3.2 Produto (precisa existir e ser da loja; disponibilidade é checada
  -- pela RPC antes de qualquer escrita).
  SELECT p.id, p.store_id, p.price, p.promo_price, p.promo_active,
         p.promo_starts_at, p.promo_ends_at, p.metadata
    INTO v_product
  FROM public.products p WHERE p.id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O produto do pedido não foi encontrado.';
  END IF;
  IF v_product.store_id <> p_store_id THEN
    RAISE EXCEPTION 'O produto não pertence a esta loja.';
  END IF;

  -- 3.3 Primeira passada: tamanho + detecção do montador (meio a meio).
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_addons) LOOP
    v_name := COALESCE(v_entry ->> 'name', '');
    IF v_size_name IS NULL AND v_name LIKE 'Tamanho: %' THEN
      v_size_name := substring(v_name from 10);
    END IF;
    IF v_name LIKE '½ %' THEN
      v_half_count := v_half_count + 1;
    ELSIF v_name LIKE '⅓ %' THEN
      v_third_count := v_third_count + 1;
    ELSIF v_name LIKE '¼ %' THEN
      v_quarter_count := v_quarter_count + 1;
    END IF;
  END LOOP;
  -- Montador = algum prefixo de fração com 2–4 entradas (o picker do
  -- "Monte sua pizza" só permite 2–4 sabores distintos).
  v_is_builder := (v_half_count BETWEEN 2 AND 4)
    OR (v_third_count BETWEEN 2 AND 4)
    OR (v_quarter_count BETWEEN 2 AND 4);

  -- 3.4 Preço do tamanho (metadata.sizes) e preços efetivos (com/sem promo).
  IF v_size_name IS NOT NULL THEN
    SELECT (elem ->> 'price')::numeric INTO v_size_price
    FROM jsonb_array_elements(COALESCE(v_product.metadata -> 'sizes', '[]'::jsonb)) elem
    WHERE (elem ->> 'name') = v_size_name
      AND (elem ->> 'price')::numeric > 0
    LIMIT 1;
    v_size_price := COALESCE(v_size_price, 0);
  END IF;

  v_eff_plain := COALESCE(v_product.price, 0);
  v_eff_promo := CASE
    WHEN v_product.promo_active IS TRUE
     AND v_product.promo_price IS NOT NULL AND v_product.promo_price > 0
     AND (v_product.promo_starts_at IS NULL OR v_product.promo_starts_at <= now())
     AND (v_product.promo_ends_at IS NULL OR v_product.promo_ends_at >= now())
    THEN v_product.promo_price
    ELSE v_product.price END;
  v_eff_promo := COALESCE(v_eff_promo, 0);

  v_base_promo := CASE WHEN v_size_price > 0 THEN v_size_price ELSE v_eff_promo END;
  v_base_plain := CASE WHEN v_size_price > 0 THEN v_size_price ELSE v_eff_plain END;

  -- Modo de preço da pizza da loja ("maior" = Anota AI; outro/ausente = soma).
  SELECT (s.settings ->> 'pizza_price_mode') INTO v_mode
  FROM public.stores s WHERE s.id = p_store_id;

  -- O produto tem algum grupo que substitui a base? (dois caminhos de vínculo)
  SELECT EXISTS (
    SELECT 1 FROM public.addon_groups ag
    WHERE COALESCE(ag.price_replaces_base, false)
      AND (ag.product_id = p_product_id
        OR EXISTS (SELECT 1 FROM public.product_addon_groups pag
                   WHERE pag.addon_group_id = ag.id AND pag.product_id = p_product_id))
  ) INTO v_has_repl;

  -- 3.5 Segunda passada: classificar cada adicional.
  FOR v_entry IN SELECT * FROM jsonb_array_elements(v_addons) LOOP
    v_name := COALESCE(v_entry ->> 'name', '');
    v_entry_price := COALESCE((v_entry ->> 'price')::numeric, 0);
    v_qty := COALESCE((v_entry ->> 'qty')::int, 1);
    IF v_qty < 1 THEN v_qty := 1; END IF;

    -- Marcador de tamanho (preço 0): já usado para o preço do tamanho.
    IF v_name LIKE 'Tamanho: %' THEN CONTINUE; END IF;

    -- Nome para o lookup: o montador prefixa a borda ("Borda: Catupiry"),
    -- o item no banco se chama "Catupiry".
    v_lookup_name := v_name;
    IF v_name LIKE 'Borda: %' THEN
      v_lookup_name := substring(v_name from 8);
    END IF;
    v_lookup_entry := jsonb_set(v_entry, '{name}', to_jsonb(v_lookup_name));

    IF v_is_builder AND (v_name LIKE '½ %' OR v_name LIKE '⅓ %' OR v_name LIKE '¼ %') THEN
      -- Sabor do montador: resolver o PRODUTO do sabor.
      v_flavor_name := substring(v_name from 3);
      v_flavor_product := NULL;
      -- (a) id prefixado flavor-<uuid>
      IF (v_entry ->> 'id') LIKE 'flavor-%' THEN
        v_flavor_id_text := substring(v_entry ->> 'id' from 8);
        IF v_flavor_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          SELECT p.id, p.price, p.promo_price, p.promo_active,
                 p.promo_starts_at, p.promo_ends_at, p.metadata
            INTO v_flavor_product
          FROM public.products p
          WHERE p.id = v_flavor_id_text::uuid AND p.store_id = p_store_id;
        END IF;
      END IF;
      -- (b) pelo nome completo, depois sem o prefixo do tipo
      -- ("Pastel - Carne" -> "Carne").
      IF v_flavor_product IS NULL THEN
        SELECT count(*) INTO v_n FROM public.products p
        WHERE p.store_id = p_store_id AND lower(p.name) = lower(v_flavor_name);
        IF v_n = 1 THEN
          SELECT p.id, p.price, p.promo_price, p.promo_active,
                 p.promo_starts_at, p.promo_ends_at, p.metadata
            INTO v_flavor_product
          FROM public.products p
          WHERE p.store_id = p_store_id AND lower(p.name) = lower(v_flavor_name);
        ELSIF v_n = 0 AND position(' - ' in v_flavor_name) > 0 THEN
          v_flavor_stripped := substring(v_flavor_name from position(' - ' in v_flavor_name) + 3);
          SELECT count(*) INTO v_n FROM public.products p
          WHERE p.store_id = p_store_id AND lower(p.name) = lower(v_flavor_stripped);
          IF v_n = 1 THEN
            SELECT p.id, p.price, p.promo_price, p.promo_active,
                   p.promo_starts_at, p.promo_ends_at, p.metadata
              INTO v_flavor_product
            FROM public.products p
            WHERE p.store_id = p_store_id AND lower(p.name) = lower(v_flavor_stripped);
          END IF;
        END IF;
      END IF;
      IF v_flavor_product IS NULL THEN
        -- Sabor não resolvível (cadastro mudou): não dá para validar o item.
        RETURN p_client_price;
      END IF;
      -- Preço do sabor: preço do tamanho no produto do sabor, senão efetivo.
      v_flavor_size_price := 0;
      IF v_size_name IS NOT NULL THEN
        SELECT (elem ->> 'price')::numeric INTO v_flavor_size_price
        FROM jsonb_array_elements(COALESCE(v_flavor_product.metadata -> 'sizes', '[]'::jsonb)) elem
        WHERE (elem ->> 'name') = v_size_name
          AND (elem ->> 'price')::numeric > 0
        LIMIT 1;
        v_flavor_size_price := COALESCE(v_flavor_size_price, 0);
      END IF;
      v_flavor_eff_plain := COALESCE(v_flavor_product.price, 0);
      v_flavor_eff_promo := CASE
        WHEN v_flavor_product.promo_active IS TRUE
         AND v_flavor_product.promo_price IS NOT NULL AND v_flavor_product.promo_price > 0
         AND (v_flavor_product.promo_starts_at IS NULL OR v_flavor_product.promo_starts_at <= now())
         AND (v_flavor_product.promo_ends_at IS NULL OR v_flavor_product.promo_ends_at >= now())
        THEN v_flavor_product.promo_price
        ELSE v_flavor_product.price END;
      v_flavor_eff_promo := COALESCE(v_flavor_eff_promo, 0);
      v_flavor_prices_promo := v_flavor_prices_promo
        || ARRAY[COALESCE(NULLIF(v_flavor_size_price, 0), v_flavor_eff_promo)];
      v_flavor_prices_plain := v_flavor_prices_plain
        || ARRAY[COALESCE(NULLIF(v_flavor_size_price, 0), v_flavor_eff_plain)];
    ELSE
      -- Adicional comum (modal ou borda/extra do montador): preço do banco.
      SELECT * INTO v_lookup
      FROM public.create_order_lookup_addon(p_store_id, p_product_id, v_lookup_entry);
      IF v_lookup.found THEN
        IF abs(v_lookup.item_price - v_entry_price) > 0.01 THEN
          RAISE EXCEPTION 'Preço do adicional % divergente do catálogo (R$ % esperado, R$ % no carrinho). Revise o carrinho e tente novamente.', v_name, v_lookup.item_price, v_entry_price;
        END IF;
        IF v_lookup.replaces_base THEN
          v_repl_gkeys := v_repl_gkeys || ARRAY[v_lookup.group_id::text];
          v_repl_names := v_repl_names || ARRAY[v_name];
          v_repl_unit_prices := v_repl_unit_prices || ARRAY[v_lookup.item_price];
          v_repl_line_prices := v_repl_line_prices || ARRAY[v_lookup.item_price * v_qty];
        ELSE
          v_normal_total := v_normal_total + v_lookup.item_price * v_qty;
        END IF;
      ELSE
        IF v_entry_price < 0 THEN
          RAISE EXCEPTION 'Preço de adicional inválido.';
        END IF;
        -- Não resolvível (marcador preço 0 ou cadastro que mudou): se o
        -- produto tem grupo substituidor, não dá para saber se este item
        -- substituiria a base — o item inteiro fica sem validação.
        IF v_entry_price > 0 AND v_has_repl THEN
          -- Fase 6A (P1-6): manter o atalho, mas registrar cada disparo para
          -- a loja corrigir o catalogo.
          INSERT INTO public.price_fallback_log (store_id, product_id, addon_entry, client_price)
          VALUES (p_store_id, p_product_id, v_entry, p_client_price);
          RETURN p_client_price;
        END IF;
        v_normal_total := v_normal_total + v_entry_price * v_qty;
      END IF;
    END IF;
  END LOOP;

  -- 3.6 Totais esperados (com e sem promoção) e decisão.
  IF v_is_builder THEN
    IF v_mode = 'maior' THEN
      SELECT COALESCE(max(u), 0) INTO v_exp_promo FROM unnest(v_flavor_prices_promo) AS t(u);
      SELECT COALESCE(max(u), 0) INTO v_exp_plain FROM unnest(v_flavor_prices_plain) AS t(u);
    ELSE
      SELECT COALESCE(avg(u), 0) INTO v_exp_promo FROM unnest(v_flavor_prices_promo) AS t(u);
      SELECT COALESCE(avg(u), 0) INTO v_exp_plain FROM unnest(v_flavor_prices_plain) AS t(u);
    END IF;
    v_exp_promo := v_exp_promo + v_normal_total;
    v_exp_plain := v_exp_plain + v_normal_total;
  ELSIF v_has_repl THEN
    IF array_length(v_repl_gkeys, 1) IS NULL THEN
      -- Grupo substituidor existe mas nada foi escolhido: base 0 (transitório).
      v_exp_promo := v_normal_total;
      v_exp_plain := v_normal_total;
    ELSIF v_mode = 'maior' THEN
      SELECT COALESCE(SUM(gmax), 0) INTO v_repl_total FROM (
        SELECT gkey, MAX(price) AS gmax FROM (
          SELECT DISTINCT gkey, name, price
          FROM unnest(v_repl_gkeys, v_repl_names, v_repl_unit_prices) AS t(gkey, name, price)
        ) d GROUP BY gkey
      ) s;
      v_exp_promo := v_repl_total + v_normal_total;
      v_exp_plain := v_repl_total + v_normal_total;
    ELSE
      SELECT COALESCE(SUM(u), 0) INTO v_repl_total FROM unnest(v_repl_line_prices) AS t(u);
      v_exp_promo := v_repl_total + v_normal_total;
      v_exp_plain := v_repl_total + v_normal_total;
    END IF;
  ELSE
    v_exp_promo := v_base_promo + v_normal_total;
    v_exp_plain := v_base_plain + v_normal_total;
  END IF;

  -- Aceita o preço com ou sem promoção (a promoção pode ligar/desligar
  -- entre o item entrar no carrinho e o pedido).
  IF abs(v_exp_promo - p_client_price) <= 0.01 THEN
    RETURN v_exp_promo;
  ELSIF abs(v_exp_plain - p_client_price) <= 0.01 THEN
    RETURN v_exp_plain;
  ELSE
    RAISE EXCEPTION 'Preço do item divergente do catálogo (esperado R$ %, no carrinho R$ %). Revise o carrinho e tente novamente.', v_exp_plain, p_client_price;
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- P2-1 + P2-2: create_order_with_items redefinida (corpo exato da Fase 3
-- + whitelist de payment_method + validacao de change_for)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_client_id uuid, p_store_id uuid, p_idempotency_key uuid, p_items jsonb, p_delivery_fee numeric, p_delivery_fee_absorbed numeric DEFAULT 0, p_payment_method text DEFAULT 'pix_direto'::text, p_neighborhood text DEFAULT NULL::text, p_address_details text DEFAULT NULL::text, p_delivery_cep text DEFAULT NULL::text, p_delivery_city text DEFAULT NULL::text, p_delivery_state text DEFAULT NULL::text, p_client_lat numeric DEFAULT NULL::numeric, p_client_lng numeric DEFAULT NULL::numeric, p_needs_change boolean DEFAULT false, p_change_for numeric DEFAULT NULL::numeric, p_is_pickup boolean DEFAULT false, p_is_preorder boolean DEFAULT false, p_scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone, p_coupon_id uuid DEFAULT NULL::uuid, p_coupon_discount numeric DEFAULT 0, p_loyalty_points integer DEFAULT 0, p_loyalty_discount numeric DEFAULT 0, p_wallet_discount numeric DEFAULT 0, p_empties_discount numeric DEFAULT 0, p_empties jsonb DEFAULT '[]'::jsonb, p_delivery_quote jsonb DEFAULT NULL::jsonb, p_is_guest boolean DEFAULT false, p_delivery_pin text DEFAULT NULL::text, p_order_source text DEFAULT 'delivery'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := auth.role();
  v_uid uuid := auth.uid();
  v_existing record;
  v_order record;
  v_store record;
  v_item jsonb;
  v_product_id uuid;
  v_product_id_text text;
  v_qty integer;
  v_client_price numeric;
  v_addons_raw jsonb;
  v_addons_norm jsonb;
  v_observations text;
  v_product record;
  v_expected_price numeric;
  v_subtotal numeric := 0;
  v_validated_items jsonb := '[]'::jsonb;
  v_now_tz timestamp;
  v_today_dow integer;
  v_now_minutes integer;
  v_now_date date;
  v_hours_count integer;
  v_is_open boolean := false;
  v_accept_preorder boolean := false;
  v_release_at timestamptz;
  v_t_hours record;
  v_y_hours record;
  v_open_min integer;
  v_close_min integer;
  v_y_open_min integer;
  v_y_close_min integer;
  v_orig_fee numeric;
  v_fee numeric;
  v_absorbed numeric;
  v_coupon record;
  v_coupon_expected numeric := 0;
  v_loy_cfg record;
  v_loy_expected numeric := 0;
  v_empties_elem jsonb;
  v_empties_expected numeric := 0;
  v_total_no_wallet numeric;
  v_order_status text;
  v_metadata jsonb;
  v_redeem jsonb;
  v_n integer;
BEGIN
  -- 0. Autorização.
  IF v_role = 'service_role' THEN
    IF NOT p_is_guest THEN
      RAISE EXCEPTION 'Apenas pedidos guest podem ser criados via service_role.';
    END IF;
  ELSIF v_role = 'authenticated' THEN
    IF v_uid IS NULL OR v_uid <> p_client_id THEN
      RAISE EXCEPTION 'Não autorizado a criar pedido para outro cliente.';
    END IF;
    IF p_is_guest THEN
      RAISE EXCEPTION 'Pedido guest não pode ser criado por usuário autenticado.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Não autorizado.';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key é obrigatória.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa de ao menos um item.';
  END IF;
  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 THEN
    RAISE EXCEPTION 'Taxa de entrega inválida.';
  END IF;
  IF p_delivery_fee_absorbed IS NULL OR p_delivery_fee_absorbed < 0 THEN
    RAISE EXCEPTION 'Taxa de entrega inválida.';
  END IF;
  IF p_is_pickup AND (p_delivery_fee <> 0 OR p_delivery_fee_absorbed <> 0) THEN
    RAISE EXCEPTION 'Retirada não tem taxa de entrega.';
  END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;
  -- Fase 6A (P2-1): whitelist — so os 4 valores que os chamadores mandam
  -- (guest-checkout, checkout logado e bot mapeado). Valores legados no
  -- banco (pix/card/cash/maquininha_*) vem de INSERTs diretos, nao desta RPC.
  IF p_payment_method NOT IN ('pix_direto', 'pix_machine', 'cartao', 'dinheiro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  -- 1. Idempotência: retry com a mesma chave devolve o pedido existente.
  SELECT id, order_number, status, subtotal, delivery_fee, total_price,
         wallet_discount, delivery_pin
    INTO v_existing
  FROM public.orders
  WHERE idempotency_key = p_idempotency_key
    AND client_id = p_client_id AND store_id = p_store_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'status', v_existing.status, 'subtotal', v_existing.subtotal,
      'delivery_fee', v_existing.delivery_fee, 'total_price', v_existing.total_price,
      'wallet_discount', v_existing.wallet_discount,
      'delivery_pin', v_existing.delivery_pin, 'is_new', false);
  END IF;

  -- 2. Loja: existe, ativa e visível (Fase 1: oculta não vende).
  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;
  IF v_store.status <> 'ativo' THEN
    RAISE EXCEPTION 'Loja indisponível no momento.';
  END IF;
  IF v_store.is_visible IS NOT TRUE THEN
    RAISE EXCEPTION 'Loja indisponível no momento.';
  END IF;

  -- 3. Itens: validar + calcular o subtotal com preços do banco.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id_text := NULLIF(v_item ->> 'product_id', '');
    IF v_product_id_text IS NULL
       OR v_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Produto do pedido inválido.';
    END IF;
    v_product_id := v_product_id_text::uuid;
    v_qty := COALESCE((v_item ->> 'quantity')::int, 0);
    IF v_qty < 1 THEN
      RAISE EXCEPTION 'Quantidade do item inválida.';
    END IF;
    v_client_price := (v_item ->> 'unit_price')::numeric;
    IF v_client_price IS NULL OR v_client_price <= 0 THEN
      RAISE EXCEPTION 'O item do pedido precisa ter preço maior que zero.';
    END IF;
    v_addons_raw := v_item -> 'addons';
    v_observations := NULLIF(v_item ->> 'observations', '');

    SELECT p.id, p.store_id, p.is_available, p.metadata, p.name
      INTO v_product
    FROM public.products p WHERE p.id = v_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O produto do pedido não foi encontrado.';
    END IF;
    IF v_product.store_id <> p_store_id THEN
      RAISE EXCEPTION 'O produto não pertence a esta loja.';
    END IF;
    -- Mesmo guarda da Fase 2 (o trigger também barraria, mas aqui é antes
    -- de qualquer escrita — nada é persistido se um item for inválido).
    IF v_product.is_available IS FALSE
       OR (v_product.metadata ->> 'hidden')::boolean IS TRUE THEN
      RAISE EXCEPTION 'O produto % está indisponível.', v_product.name;
    END IF;

    -- Normalizar adicionais p/ array (o front logado manda string JSON).
    v_addons_norm := '[]'::jsonb;
    IF v_addons_raw IS NOT NULL THEN
      IF jsonb_typeof(v_addons_raw) = 'array' THEN
        v_addons_norm := v_addons_raw;
      ELSIF jsonb_typeof(v_addons_raw) = 'string' THEN
        BEGIN
          IF jsonb_typeof((v_addons_raw #>> '{}')::jsonb) = 'array' THEN
            v_addons_norm := (v_addons_raw #>> '{}')::jsonb;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_addons_norm := '[]'::jsonb;
        END;
      END IF;
    END IF;

    v_expected_price := public.create_order_expected_item_price(
      p_store_id, v_product_id, v_client_price, v_addons_norm);
    IF v_expected_price IS NULL OR v_expected_price <= 0 THEN
      RAISE EXCEPTION 'O item do pedido precisa ter preço maior que zero.';
    END IF;
    v_subtotal := v_subtotal + v_expected_price * v_qty;

    v_validated_items := v_validated_items || jsonb_build_object(
      'product_id', v_product_id,
      'quantity', v_qty,
      'unit_price', v_expected_price,
      'addons', CASE WHEN jsonb_array_length(v_addons_norm) = 0 THEN NULL ELSE v_addons_norm END,
      'observations', v_observations);
  END LOOP;

  -- 4. Aberto / pré-pedido (espelha getStoreOpenStatus) + pedido mínimo.
  v_now_tz := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_today_dow := EXTRACT(DOW FROM v_now_tz)::int;
  v_now_minutes := EXTRACT(HOUR FROM v_now_tz)::int * 60 + EXTRACT(MINUTE FROM v_now_tz)::int;
  v_now_date := v_now_tz::date;

  IF v_store.force_closed IS TRUE THEN
    RAISE EXCEPTION 'Loja fechada no momento.';
  END IF;

  SELECT count(*) INTO v_hours_count
  FROM public.opening_hours WHERE store_id = p_store_id;
  IF v_hours_count = 0 THEN
    -- Sem horários: vale o is_open manual; sem pré-pedido.
    IF v_store.is_open IS NOT TRUE THEN
      RAISE EXCEPTION 'Loja fechada no momento.';
    END IF;
    v_is_open := true;
  ELSE
    -- Ontem (overnight): ex. terça 18h–02h, à 00:30 de quarta está aberta.
    SELECT open_time, close_time, is_closed_all_day INTO v_y_hours
    FROM public.opening_hours
    WHERE store_id = p_store_id AND day_of_week = (v_today_dow + 6) % 7;
    IF FOUND AND NOT COALESCE(v_y_hours.is_closed_all_day, false) THEN
      v_y_open_min := EXTRACT(HOUR FROM v_y_hours.open_time)::int * 60
        + EXTRACT(MINUTE FROM v_y_hours.open_time)::int;
      v_y_close_min := EXTRACT(HOUR FROM v_y_hours.close_time)::int * 60
        + EXTRACT(MINUTE FROM v_y_hours.close_time)::int;
      IF v_y_close_min <= v_y_open_min AND v_now_minutes < v_y_close_min THEN
        v_is_open := true;
      END IF;
    END IF;
    -- Hoje.
    IF NOT v_is_open THEN
      SELECT open_time, close_time, is_closed_all_day INTO v_t_hours
      FROM public.opening_hours
      WHERE store_id = p_store_id AND day_of_week = v_today_dow;
      IF FOUND AND NOT COALESCE(v_t_hours.is_closed_all_day, false) THEN
        v_open_min := EXTRACT(HOUR FROM v_t_hours.open_time)::int * 60
          + EXTRACT(MINUTE FROM v_t_hours.open_time)::int;
        v_close_min := EXTRACT(HOUR FROM v_t_hours.close_time)::int * 60
          + EXTRACT(MINUTE FROM v_t_hours.close_time)::int;
        IF v_close_min <= v_open_min THEN
          IF v_now_minutes >= v_open_min OR v_now_minutes < v_close_min THEN
            v_is_open := true;
          END IF;
        ELSIF v_now_minutes >= v_open_min AND v_now_minutes < v_close_min THEN
          v_is_open := true;
        END IF;
        IF NOT v_is_open AND v_now_minutes < v_open_min THEN
          IF v_store.preorder_enabled IS TRUE
             AND COALESCE(v_store.preorder_minutes_before, 0) > 0
             AND v_now_minutes >= v_open_min - v_store.preorder_minutes_before THEN
            v_accept_preorder := true;
            v_release_at := ((v_now_date + v_t_hours.open_time) AT TIME ZONE 'America/Sao_Paulo');
          END IF;
        END IF;
      END IF;
    END IF;
    IF NOT v_is_open AND NOT v_accept_preorder THEN
      RAISE EXCEPTION 'Loja fechada no momento.';
    END IF;
  END IF;

  IF COALESCE(v_store.minimum_order_value, 0) > 0
     AND v_subtotal < v_store.minimum_order_value THEN
    RAISE EXCEPTION 'Pedido mínimo desta loja: R$ %.', v_store.minimum_order_value;
  END IF;

  -- 5. Taxa: espelha `enforce_free_delivery_threshold` (o trigger roda no
  -- INSERT e grava os mesmos valores — o total precisa usar o pós-trigger).
  -- A taxa em si vem da cotação (quote-delivery); aqui só se aplica a regra
  -- do frete grátis e se exige taxa >= 0. A loja com split "lojista" tem a
  -- parte absorvida somada à taxa pelo trigger (comportamento atual).
  v_orig_fee := p_delivery_fee + p_delivery_fee_absorbed;
  IF p_is_pickup THEN
    v_fee := 0;
    v_absorbed := 0;
  ELSIF COALESCE(v_store.free_delivery_threshold, 0) > 0
        AND v_subtotal >= v_store.free_delivery_threshold THEN
    v_fee := 0;
    v_absorbed := v_orig_fee;
  ELSE
    v_fee := v_orig_fee;
    v_absorbed := 0;
  END IF;

  -- 6. Cupom: validar e conferir o desconto esperado (o consumo é no passo 13).
  IF p_coupon_id IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE id = p_coupon_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom não encontrado.';
    END IF;
    IF NOT v_coupon.is_active THEN
      RAISE EXCEPTION 'Cupom inativo.';
    END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
      RAISE EXCEPTION 'Cupom expirado.';
    END IF;
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
      RAISE EXCEPTION 'Cupom esgotado.';
    END IF;
    IF v_coupon.store_id IS NOT NULL AND v_coupon.store_id <> p_store_id THEN
      RAISE EXCEPTION 'Este cupom não é válido para esta loja.';
    END IF;
    IF v_subtotal < COALESCE(v_coupon.min_order_value, 0) THEN
      RAISE EXCEPTION 'Pedido mínimo de R$ % para este cupom.', v_coupon.min_order_value;
    END IF;
    IF EXISTS (SELECT 1 FROM public.coupon_uses
               WHERE coupon_id = p_coupon_id AND user_id = p_client_id) THEN
      RAISE EXCEPTION 'Você já utilizou este cupom.';
    END IF;
    IF v_coupon.first_order_only IS TRUE THEN
      SELECT count(*) INTO v_n FROM public.orders
      WHERE client_id = p_client_id AND status <> 'cancelado';
      IF v_n > 0 THEN
        RAISE EXCEPTION 'Este cupom é válido apenas para o primeiro pedido.';
      END IF;
    END IF;
    IF v_coupon.discount_type = 'percentage' THEN
      v_coupon_expected := ROUND(v_subtotal * (v_coupon.discount_value / 100), 2);
    ELSIF v_coupon.discount_type = 'fixed' THEN
      v_coupon_expected := LEAST(v_coupon.discount_value, v_subtotal);
    ELSIF v_coupon.discount_type = 'free_shipping' THEN
      -- Crédito do frete = taxa cotada (0 se o frete já era grátis por teto).
      v_coupon_expected := p_delivery_fee;
    ELSE
      RAISE EXCEPTION 'Tipo de cupom desconhecido.';
    END IF;
    IF abs(v_coupon_expected - COALESCE(p_coupon_discount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Desconto do cupom divergente. Revise o carrinho e tente novamente.';
    END IF;
  ELSE
    IF COALESCE(p_coupon_discount, 0) <> 0 THEN
      RAISE EXCEPTION 'Desconto de cupom sem cupom.';
    END IF;
  END IF;

  -- 7. Fidelidade: pré-validar config/mínimo/valor esperado (o débito é no
  -- passo 14 e levanta se o saldo for insuficiente — rollback total).
  IF COALESCE(p_loyalty_points, 0) > 0 THEN
    SELECT * INTO v_loy_cfg FROM public.loyalty_config
    WHERE store_id = p_store_id AND is_enabled = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fidelidade não ativa nesta loja.';
    END IF;
    IF p_loyalty_points < v_loy_cfg.min_points_redeem THEN
      RAISE EXCEPTION 'Mínimo de % pontos para resgatar.', v_loy_cfg.min_points_redeem;
    END IF;
    v_loy_expected := p_loyalty_points * v_loy_cfg.discount_per_point;
    IF abs(v_loy_expected - COALESCE(p_loyalty_discount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Desconto de fidelidade divergente. Revise o carrinho e tente novamente.';
    END IF;
  ELSE
    IF COALESCE(p_loyalty_discount, 0) <> 0 THEN
      RAISE EXCEPTION 'Desconto de fidelidade sem pontos.';
    END IF;
  END IF;

  -- 8. Vasilhames: desconto = soma(qty × unit_price).
  IF p_empties IS NOT NULL AND jsonb_typeof(p_empties) = 'array'
     AND jsonb_array_length(p_empties) > 0 THEN
    FOR v_empties_elem IN SELECT * FROM jsonb_array_elements(p_empties) LOOP
      v_empties_expected := v_empties_expected
        + COALESCE((v_empties_elem ->> 'qty')::int, 0)
        * COALESCE((v_empties_elem ->> 'unit_price')::numeric, 0);
    END LOOP;
    IF abs(v_empties_expected - COALESCE(p_empties_discount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Desconto de vasilhames divergente. Revise o carrinho e tente novamente.';
    END IF;
  ELSE
    IF COALESCE(p_empties_discount, 0) <> 0 THEN
      RAISE EXCEPTION 'Desconto de vasilhames sem vasilhames.';
    END IF;
  END IF;

  -- 9. Total sem carteira (o débito da carteira entra no passo 16).
  v_total_no_wallet := GREATEST(0, v_subtotal + v_fee
    - COALESCE(p_coupon_discount, 0) - v_loy_expected - COALESCE(p_empties_discount, 0));
  -- Fase 6A (P2-2): troco tem que cobrir o total do pedido.
  IF COALESCE(p_needs_change, false)
     AND (p_change_for IS NULL OR p_change_for < v_total_no_wallet) THEN
    RAISE EXCEPTION 'Troco inválido: informe um valor maior ou igual ao total do pedido (R$ %).', v_total_no_wallet;
  END IF;

  -- 10. Status (+release_at do pré-pedido).
  IF p_payment_method = 'pix_direto' THEN
    v_order_status := 'aguardando_comprovante';
  ELSIF v_accept_preorder THEN
    v_order_status := 'scheduled';
  ELSE
    v_order_status := 'pendente';
  END IF;

  v_metadata := NULL;
  IF p_delivery_quote IS NOT NULL
     OR (p_empties IS NOT NULL AND jsonb_typeof(p_empties) = 'array'
         AND jsonb_array_length(p_empties) > 0) THEN
    v_metadata := '{}'::jsonb;
    IF p_delivery_quote IS NOT NULL THEN
      v_metadata := v_metadata || jsonb_build_object('delivery_quote', p_delivery_quote);
    END IF;
    IF p_empties IS NOT NULL AND jsonb_typeof(p_empties) = 'array'
       AND jsonb_array_length(p_empties) > 0 THEN
      v_metadata := v_metadata || jsonb_build_object('empties_exchange', p_empties);
    END IF;
  END IF;

  -- 11. INSERT do pedido (ON CONFLICT cobre a corrida entre dois submits).
  -- commission_rate/app_fee ficam com o trigger (validate_order_prices);
  -- wallet_discount começa 0 (o trigger zera) e é ajustado no passo 16.
  INSERT INTO public.orders (
    client_id, store_id, subtotal, delivery_fee, delivery_fee_absorbed_by_store,
    total_price, wallet_discount, payment_method, neighborhood, address_details,
    delivery_cep, delivery_city, delivery_state, client_lat, client_lng,
    needs_change, change_for, status, scheduled_for, release_at,
    is_guest, is_preorder, metadata, idempotency_key, order_source, delivery_pin
  ) VALUES (
    p_client_id, p_store_id, v_subtotal, v_fee, v_absorbed,
    v_total_no_wallet, 0, p_payment_method, p_neighborhood, p_address_details,
    p_delivery_cep, p_delivery_city, p_delivery_state, p_client_lat, p_client_lng,
    p_needs_change, p_change_for, v_order_status::order_status, p_scheduled_for, v_release_at,
    p_is_guest, v_accept_preorder, v_metadata, p_idempotency_key, p_order_source, p_delivery_pin
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id, order_number, status, subtotal, delivery_fee, total_price,
    wallet_discount, delivery_pin
  INTO v_order;

  IF v_order.id IS NULL THEN
    -- Corrida: outro submit com a mesma chave já criou o pedido.
    SELECT id, order_number, status, subtotal, delivery_fee, total_price,
           wallet_discount, delivery_pin
      INTO v_existing
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key
      AND client_id = p_client_id AND store_id = p_store_id;
    RETURN jsonb_build_object(
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'status', v_existing.status, 'subtotal', v_existing.subtotal,
      'delivery_fee', v_existing.delivery_fee, 'total_price', v_existing.total_price,
      'wallet_discount', v_existing.wallet_discount,
      'delivery_pin', v_existing.delivery_pin, 'is_new', false);
  END IF;

  -- 12. INSERT dos itens (preços validados; addons como array).
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_validated_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, addons, observations)
    VALUES (
      v_order.id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'quantity')::int,
      (v_item ->> 'unit_price')::numeric,
      CASE WHEN (v_item -> 'addons') IS NULL OR (v_item -> 'addons') = 'null'::jsonb
        THEN NULL ELSE (v_item -> 'addons') END,
      NULLIF(v_item ->> 'observations', '')
    );
  END LOOP;

  -- 13. Cupom (dentro da transação; falha → rollback total).
  IF p_coupon_id IS NOT NULL THEN
    PERFORM public.use_coupon(p_coupon_id, p_client_id, v_order.id);
  END IF;

  -- 14. Fidelidade (redeem devolve {ok:false} em vez de levantar).
  IF COALESCE(p_loyalty_points, 0) > 0 THEN
    v_redeem := public.redeem_loyalty_points(v_order.id, p_store_id, p_loyalty_points);
    IF NOT COALESCE((v_redeem ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'Fidelidade: %', COALESCE(v_redeem ->> 'error', 'não foi possível resgatar os pontos.');
    END IF;
  END IF;

  -- 15. Carteira (levanta se saldo insuficiente → rollback total). É o fix
  -- do P1-N3: o débito acontece dentro da transação, junto com o total.
  IF COALESCE(p_wallet_discount, 0) > 0 THEN
    PERFORM public.apply_wallet_discount(v_order.id, p_client_id, p_wallet_discount);
  END IF;

  -- 16. UPDATE final com os totais definitivos. Sem ele, o
  -- `verify_order_subtotal` (AFTER INSERT em order_items) deixaria
  -- total_price = subtotal + delivery_fee, apagando os descontos.
  UPDATE public.orders
  SET subtotal = v_subtotal,
      total_price = GREATEST(0, v_total_no_wallet - COALESCE(p_wallet_discount, 0)),
      wallet_discount = COALESCE(p_wallet_discount, 0)
  WHERE id = v_order.id
  RETURNING id, order_number, status, subtotal, delivery_fee, total_price,
    wallet_discount, delivery_pin
  INTO v_order;

  RETURN jsonb_build_object(
    'order_id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee, 'total_price', v_order.total_price,
    'wallet_discount', v_order.wallet_discount,
    'delivery_pin', v_order.delivery_pin, 'is_new', true);
END;
$function$;

-- ---------------------------------------------------------------------------
-- P2-4: award_loyalty_points redefinida (corpo AO VIVO + guarda
-- IF NEW.is_guest no topo; ver divergencia 2 no cabecalho).
-- A trigger existente award_loyalty_on_order_finalized nao muda.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _config record;
  _points integer;
  _base_value numeric;
BEGIN
  -- Fase 6A (P2-4): guest nao acumula fidelidade (os pontos ficariam
  -- presos no usuario sintetico).
  IF NEW.is_guest THEN RETURN NEW; END IF;
  IF NEW.status = 'finalizado' AND OLD.status IS DISTINCT FROM 'finalizado' THEN
    -- Só acumular se tem cliente identificado
    IF NEW.client_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT * INTO _config FROM public.loyalty_config
    WHERE store_id = NEW.store_id AND is_enabled = true;
    
    IF FOUND THEN
      -- Base de cálculo: subtotal menos desconto de fidelidade já usado
      _base_value := GREATEST(0, COALESCE(NEW.subtotal, 0) - COALESCE(NEW.loyalty_discount, 0));
      _points := GREATEST(1, floor(_base_value * _config.points_per_real));
      
      INSERT INTO public.loyalty_points (user_id, store_id, points, total_orders, last_order_at)
      VALUES (NEW.client_id, NEW.store_id, _points, 1, now())
      ON CONFLICT (user_id, store_id) DO UPDATE SET
        points = loyalty_points.points + _points,
        total_orders = loyalty_points.total_orders + 1,
        last_order_at = now(),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
