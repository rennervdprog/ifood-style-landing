-- ============================================================================
-- FASE 2 — Migração 02: baixa dentro da venda do PDV (L-02a/L-02b/L-03),
-- comanda com claim + variante + erro registrado (L-23) e peso nos triggers
-- de delivery (L-10).
--
-- pdv_finalize_sale v2: a chave de payload `decrement_stock` (default false)
-- liga a baixa DENTRO da transação, após o INSERT dos itens. Insuficiência
-- aborta a venda inteira (trava L-03: o 2º caixa espera o FOR UPDATE da
-- interna e aborta com insufficient_stock). Ramos idempotentes (early return
-- e CONFLICT) também baixam quando a chave vem setada — com raise=false,
-- porque a venda já existe; o claim torna a baixa idempotente. Isso cobre
-- payloads enfileirados offline por JS antigo e sincronizados por JS novo.
-- SEM a chave, comportamento idêntico ao v1 (JS antigo + testes Deno).
-- Retorno ganha 'stock_decremented' (os testes afirmam só order_id/idempotent).
--
-- pdv_close_tab v2: INSERT de itens com RETURNING id + claim; peso via
-- stock_effective_sale_qty; metadata.apparel_variant_id → apparel_adjust_stock
-- (reason 'sale', _ref_order_id); o swallow `EXCEPTION WHEN OTHERS THEN NULL`
-- vira registro em order_stock_alerts (kind decrement_error) — o fechamento
-- prossegue (L-23). Sem saldo no caminho direto: a interna já registra
-- insufficient_stock; nada mais a fazer.
--
-- Triggers de baixa do delivery: passam a usar stock_effective_sale_qty
-- (peso em delivery baixava "1"). Detecção de PDV NULL-safe intacta
-- (migração 07 da Fase 1) — só a quantidade calculada muda.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pdv_finalize_sale(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id        uuid := (_payload->>'store_id')::uuid;
  v_session_id      uuid := (_payload->>'session_id')::uuid;
  v_client_uuid     uuid := NULLIF(_payload->>'client_uuid','')::uuid;
  v_table_id        text := _payload->>'table_identifier';
  v_subtotal        numeric := (_payload->>'subtotal')::numeric;
  v_discount        numeric := COALESCE((_payload->>'pdv_discount')::numeric, 0);
  v_commission      numeric := COALESCE((_payload->>'commission_rate')::numeric, 0);
  v_total           numeric := (_payload->>'total_price')::numeric;
  v_primary_method  text := _payload->>'payment_method';
  v_payments        jsonb := COALESCE(_payload->'payments', '[]'::jsonb);
  v_items           jsonb := COALESCE(_payload->'items', '[]'::jsonb);
  v_created_by      uuid := NULLIF(_payload->>'created_by','')::uuid;
  v_operator_id     uuid := NULLIF(_payload->>'operator_id','')::uuid;
  v_do_decrement    boolean := COALESCE((_payload->>'decrement_stock')::boolean, false);
  v_decrement_ok    boolean := false;
  v_order_id        uuid;
  v_existing_id     uuid;
  v_item            jsonb;
  v_payment         jsonb;
  v_session_open    boolean;
BEGIN
  -- Idempotência: se já existe pedido com este client_uuid, retorna ele
  IF v_client_uuid IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.orders WHERE client_uuid = v_client_uuid LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      -- Fase 2 (L-02b): replay de venda já criada (ex.: payload enfileirado
      -- por JS antigo) ainda deve a baixa. O claim torna idempotente; sem
      -- saldo, registra o alerta e NÃO aborta — a venda já existe.
      IF v_do_decrement THEN
        SELECT public.pdv_decrement_order_items(v_existing_id, false) INTO v_decrement_ok;
      END IF;
      RETURN jsonb_build_object('order_id', v_existing_id, 'idempotent', true, 'stock_decremented', COALESCE(v_decrement_ok, false));
    END IF;
  END IF;

  IF v_store_id IS NULL OR v_session_id IS NULL THEN
    RAISE EXCEPTION 'store_id e session_id são obrigatórios';
  END IF;

  SELECT (status = 'open') INTO v_session_open
  FROM pdv_sessions WHERE id = v_session_id;
  IF v_session_open IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão de PDV não está aberta';
  END IF;

  INSERT INTO orders (
    store_id, client_id, order_source, pdv_session_id, table_identifier,
    subtotal, delivery_fee, pdv_discount, commission_rate, total_price,
    app_fee, payment_method, payments, neighborhood, address_details, status,
    client_uuid
  ) VALUES (
    v_store_id, NULL, 'pdv', v_session_id, v_table_id,
    v_subtotal, 0, v_discount, v_commission, v_total,
    0, v_primary_method, v_payments, 'Balcão',
    COALESCE(v_table_id || ' — Presencial', 'Pedido presencial'),
    'finalizado',
    v_client_uuid
  )
  ON CONFLICT (client_uuid) WHERE client_uuid IS NOT NULL DO NOTHING
  RETURNING id INTO v_order_id;

  -- Se o CONFLICT evitou o insert (corrida), busca o existente
  IF v_order_id IS NULL AND v_client_uuid IS NOT NULL THEN
    SELECT id INTO v_order_id FROM public.orders WHERE client_uuid = v_client_uuid LIMIT 1;
    -- Fase 2 (L-02b): mesmo tratamento do early return acima.
    IF v_do_decrement THEN
      SELECT public.pdv_decrement_order_items(v_order_id, false) INTO v_decrement_ok;
    END IF;
    RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true, 'stock_decremented', COALESCE(v_decrement_ok, false));
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO order_items (
      order_id, product_id, quantity, unit_price,
      addons, observations, metadata
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'quantity')::numeric, 1),
      (v_item->>'unit_price')::numeric,
      CASE WHEN v_item ? 'addons' AND v_item->'addons' <> 'null'::jsonb
           THEN v_item->'addons' ELSE NULL END,
      NULLIF(v_item->>'observations',''),
      CASE WHEN v_item ? 'metadata' AND v_item->'metadata' <> 'null'::jsonb
           THEN v_item->'metadata' ELSE NULL END
    );
  END LOOP;

  -- Fase 2 (L-02a/L-03): baixa DENTRO da transação, com claim. Insuficiência
  -- (caminho direto) aborta a venda inteira — o 2º caixa recebe
  -- insufficient_stock ANTES de concluir.
  IF v_do_decrement THEN
    PERFORM public.pdv_decrement_order_items(v_order_id, true);
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments) LOOP
    INSERT INTO pdv_movements (
      session_id, store_id, type, amount, payment_method,
      description, order_id, created_by, operator_id
    ) VALUES (
      v_session_id, v_store_id, 'sale',
      (v_payment->>'amount')::numeric,
      v_payment->>'method',
      COALESCE(v_table_id, 'Venda balcão'),
      v_order_id, v_created_by, v_operator_id
    );
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', false, 'stock_decremented', v_do_decrement);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pdv_close_tab(_tab_id uuid, _session_id uuid, _payments jsonb, _pdv_discount numeric DEFAULT 0, _commission_rate numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store uuid; _table uuid; _table_label text;
  _subtotal numeric := 0; _total numeric; _discount numeric := COALESCE(_pdv_discount,0);
  _order_id uuid; _primary_method text; _payment jsonb; _item RECORD;
  _session_open boolean;
  _payments_sum numeric := 0;
  _order_item_id uuid;
  _ok boolean;
BEGIN
  SELECT t.store_id, t.table_id INTO _store, _table
    FROM public.pdv_tabs t WHERE t.id=_tab_id AND t.status='open';
  IF _store IS NULL THEN RAISE EXCEPTION 'tab_not_found_or_closed'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);

  SELECT (status='open') INTO _session_open FROM public.pdv_sessions WHERE id=_session_id;
  IF _session_open IS NOT TRUE THEN RAISE EXCEPTION 'session_not_open'; END IF;

  IF _table IS NOT NULL THEN
    SELECT label INTO _table_label FROM public.pdv_tables WHERE id=_table;
  END IF;

  SELECT COALESCE(SUM(quantity * unit_price),0) INTO _subtotal FROM public.pdv_tab_items WHERE tab_id=_tab_id;
  IF _subtotal <= 0 THEN RAISE EXCEPTION 'empty_tab'; END IF;
  _total := GREATEST(_subtotal - _discount, 0);

  IF _payments IS NULL OR jsonb_array_length(_payments) = 0 THEN
    RAISE EXCEPTION 'no_payments';
  END IF;

  SELECT COALESCE(SUM((_p->>'amount')::numeric), 0) INTO _payments_sum
  FROM jsonb_array_elements(_payments) AS _p;
  IF ABS(_payments_sum - _total) > 0.01 THEN
    RAISE EXCEPTION 'payments_mismatch: soma dos pagamentos (%) difere do total da comanda (%)', _payments_sum, _total;
  END IF;

  SELECT (_payments->0->>'method') INTO _primary_method;

  INSERT INTO public.orders (
    store_id, client_id, order_source, pdv_session_id, pdv_tab_id, table_identifier,
    subtotal, delivery_fee, pdv_discount, commission_rate, total_price,
    app_fee, payment_method, payments, neighborhood, address_details, status
  ) VALUES (
    _store, NULL, 'pdv', _session_id, _tab_id, _table_label,
    _subtotal, 0, _discount, COALESCE(_commission_rate,0), _total,
    0, _primary_method, _payments, 'Balcão',
    COALESCE(_table_label || ' — Comanda', 'Comanda PDV'),
    'finalizado'
  ) RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM public.pdv_tab_items WHERE tab_id=_tab_id LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, addons, observations, metadata)
      VALUES (_order_id, _item.product_id, _item.quantity, _item.unit_price,
        _item.addons, _item.observations, _item.metadata)
      RETURNING id INTO _order_item_id;
    BEGIN
      -- Fase 1 (L-06): chamada interna — pdv_close_tab já verificou o dono
      -- via pdv_assert_store_owner acima; o wrapper recusaria service_role/
      -- contextos sem dono.
      IF _item.metadata->>'apparel_variant_id' IS NOT NULL THEN
        -- Fase 2 (L-23): variante boutique baixa em product_variants
        -- (nunca em product_stock). insufficient_stock vira alerta
        -- (sub-bloco abaixo), não trava o fechamento.
        PERFORM public.apparel_adjust_stock(
          (_item.metadata->>'apparel_variant_id')::uuid,
          -_item.quantity, 'sale', _order_id, 'Fechamento de comanda');
      ELSE
        SELECT public.stock_decrement_sale_internal(
          _item.product_id,
          public.stock_effective_sale_qty(_item.product_id, _item.quantity, (_item.metadata->>'weight_grams')::numeric),
          _order_id, _order_item_id) INTO _ok;
        -- _ok=false (sem saldo, caminho direto): a interna já registrou o
        -- alerta insufficient_stock; o fechamento prossegue (L-23).
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Fase 2 (L-23): falha de baixa NUNCA trava o fechamento — mas fica
      -- registrada (antes: EXCEPTION WHEN OTHERS THEN NULL, silêncio total).
      IF NOT EXISTS (
        SELECT 1 FROM public.order_stock_alerts a
        WHERE a.order_id = _order_id
          AND a.order_item_id = _order_item_id
          AND a.product_id = _item.product_id
          AND a.kind = 'decrement_error'
      ) THEN
        INSERT INTO public.order_stock_alerts
          (order_id, store_id, product_id, order_item_id, ingredient_product_id,
           kind, requested_qty, available_qty, shortfall_qty, unit, detail)
        VALUES
          (_order_id, _store, _item.product_id, _order_item_id, NULL,
           'decrement_error', GREATEST(_item.quantity, 0.001), 0, GREATEST(_item.quantity, 0.001), 'un',
           jsonb_build_object(
             'error', SQLERRM,
             'phase', 'close_tab',
             'apparel_variant_id', _item.metadata->>'apparel_variant_id',
             'note', 'available_qty=0 é placeholder: a quantidade disponível era desconhecida quando a baixa falhou.'));
      END IF;
    END;
  END LOOP;

  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    INSERT INTO public.pdv_movements (session_id, store_id, type, amount, payment_method, description, order_id, created_by)
    VALUES (_session_id, _store, 'sale', (_payment->>'amount')::numeric, _payment->>'method',
            COALESCE(_table_label, 'Comanda') || ' - Fechamento', _order_id, auth.uid());
  END LOOP;

  UPDATE public.pdv_tabs SET status='closed', closed_at=now(), order_id=_order_id, updated_at=now() WHERE id=_tab_id;
  IF _table IS NOT NULL THEN
    UPDATE public.pdv_tables SET status='free', opened_at=NULL, opened_by=NULL, updated_at=now() WHERE id=_table;
  END IF;

  RETURN _order_id;
END;
$function$;

-- Triggers de baixa do delivery: peso via stock_effective_sale_qty (L-10).
-- Corpos idênticos aos da migração 07 da Fase 1, exceto a quantidade calculada.
-- Detecção de PDV NULL-safe intacta; sem mudança de assinatura, trigger, grant
-- ou policy. Casts ::text preservados (enum order_status não tem
-- 'confirmado'/'pronto' — nunca usar literais de status inexistentes).
CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_order_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  v_ok boolean;
  v_qty numeric;
  v_is_pdv boolean := false;
BEGIN
  -- NULL-safe: COALESCE garante booleano puro (ver cabeçalho da migração).
  v_is_pdv := (NEW.pdv_session_id IS NOT NULL)
           OR (COALESCE(NEW.order_source, '') = 'pdv')
           OR (NEW.metadata->>'pdv_session_id' IS NOT NULL)
           OR (COALESCE(NEW.metadata->>'source', '') = 'pdv');

  IF NOT v_is_pdv
     AND NEW.status::text IN ('pendente', 'preparando')
     AND OLD.status::text IS DISTINCT FROM NEW.status::text
     AND OLD.status::text NOT IN ('preparando', 'pronto_para_entrega', 'saiu_entrega', 'em_transito', 'entregue', 'finalizado') THEN
    FOR item IN SELECT id, product_id, quantity, metadata FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      BEGIN
        v_qty := public.stock_effective_sale_qty(item.product_id, item.quantity, (item.metadata->>'weight_grams')::numeric);
        SELECT public.stock_decrement_sale_internal(item.product_id, v_qty, NEW.id, item.id) INTO v_ok;
      EXCEPTION WHEN OTHERS THEN
        -- Falha de baixa NUNCA falha o pedido — mas fica registrada.
        -- (O sub-bloco desfez o trabalho parcial deste item.)
        IF NOT EXISTS (
          SELECT 1 FROM public.order_stock_alerts a
          WHERE a.order_id = NEW.id
            AND a.order_item_id = item.id
            AND a.product_id = item.product_id
            AND a.kind = 'decrement_error'
        ) THEN
          INSERT INTO public.order_stock_alerts
            (order_id, store_id, product_id, order_item_id, ingredient_product_id,
             kind, requested_qty, available_qty, shortfall_qty, unit, detail)
          VALUES
            (NEW.id, NEW.store_id, item.product_id, item.id, NULL,
             'decrement_error', GREATEST(COALESCE(v_qty, item.quantity), 0.001), 0, GREATEST(COALESCE(v_qty, item.quantity), 0.001), 'un',
             jsonb_build_object(
               'error', SQLERRM,
               'phase', 'order_status_trigger',
               'note', 'available_qty=0 é placeholder: a quantidade disponível era desconhecida quando a baixa falhou.'));
        END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_item_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_source text;
  v_pdv_session uuid;
  v_metadata jsonb;
  v_store_id uuid;
  v_is_pdv boolean := false;
  v_ok boolean;
  v_qty numeric;
BEGIN
  SELECT o.status::text, o.order_source, o.pdv_session_id, o.metadata, o.store_id
    INTO v_status, v_source, v_pdv_session, v_metadata, v_store_id
    FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- NULL-safe: COALESCE garante booleano puro (ver cabeçalho da migração).
  v_is_pdv := (v_pdv_session IS NOT NULL)
           OR (COALESCE(v_source, '') = 'pdv')
           OR (v_metadata->>'pdv_session_id' IS NOT NULL)
           OR (COALESCE(v_metadata->>'source', '') = 'pdv');
  IF v_is_pdv THEN RETURN NEW; END IF;

  IF v_status NOT IN ('preparando', 'pronto_para_entrega', 'saiu_entrega', 'em_transito') THEN
    RETURN NEW;
  END IF;
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  BEGIN
    v_qty := public.stock_effective_sale_qty(NEW.product_id, NEW.quantity, (NEW.metadata->>'weight_grams')::numeric);
    SELECT public.stock_decrement_sale_internal(NEW.product_id, v_qty, NEW.order_id, NEW.id) INTO v_ok;
  EXCEPTION WHEN OTHERS THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_stock_alerts a
      WHERE a.order_id = NEW.order_id
        AND a.order_item_id = NEW.id
        AND a.product_id = NEW.product_id
        AND a.kind = 'decrement_error'
    ) THEN
      INSERT INTO public.order_stock_alerts
        (order_id, store_id, product_id, order_item_id, ingredient_product_id,
         kind, requested_qty, available_qty, shortfall_qty, unit, detail)
      VALUES
        (NEW.order_id, v_store_id, NEW.product_id, NEW.id, NULL,
         'decrement_error', GREATEST(COALESCE(v_qty, NEW.quantity), 0.001), 0, GREATEST(COALESCE(v_qty, NEW.quantity), 0.001), 'un',
         jsonb_build_object(
           'error', SQLERRM,
           'phase', 'confirmed_order_item_insert',
           'note', 'available_qty=0 é placeholder: a quantidade disponível era desconhecida quando a baixa falhou.'));
    END IF;
  END;
  RETURN NEW;
END; $function$;
