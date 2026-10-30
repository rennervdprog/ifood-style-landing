-- Fase 3 — correção do checkout (2026-10-25).
-- BUG: a RPC declarava v_order_status text, mas orders.status é o enum
-- order_status; o INSERT falhava com 42804 e todo pedido válido era
-- rejeitado. Correção: cast v_order_status::order_status no INSERT.
-- Os três valores possíveis ('pendente', 'scheduled',
-- 'aguardando_comprovante') são rótulos válidos do enum — o cast nunca
-- falha em tempo de execução. Corpo idêntico ao que está no banco ao vivo
-- (pg_get_functiondef), com essa única alteração.
-- NÃO editar a migration 20261025120000 (já aplicada em produção).

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
$function$
