-- ============================================================================
-- Fase 1 Estoque + Ficha Técnica — 03/06: DRIFT RPCs do PDV
-- (versionamento, sem mudar comportamento).
--
-- pdv_close_tab e pdv_finalize_sale NÃO têm NENHUMA migration no repo
-- (grep em origin/production 5c48a68d: zero ocorrências). Definições abaixo
-- são as vivas verbatim (pg_get_functiondef, 2026-11-12; oids 39732/38536).
--
-- A migração 04 altera UMA linha de pdv_close_tab (a chamada de baixa passa
-- a usar a função interna). Este arquivo fixa o comportamento atual antes
-- dessa alteração, para que o diff 03→04 seja legível.
--
-- Tabelas pdv_* (pdv_tabs, pdv_tab_items, pdv_sessions, pdv_tables,
-- pdv_movements) NÃO são versionadas aqui: estão fora do escopo estoque e
-- as funções só as referenciam em runtime (corpo plpgsql não é validado
-- na criação). Aplicar em UMA transação. Idempotente (OR REPLACE).
-- ============================================================================

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

  -- L3: valida que a soma dos pagamentos bate com o total calculado
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
        _item.addons, _item.observations, _item.metadata);
    -- L2: baixa de estoque por item da comanda
    BEGIN
      PERFORM public.stock_decrement_sale(_item.product_id, _item.quantity, _order_id);
    EXCEPTION WHEN OTHERS THEN
      -- Não falha o fechamento se o produto não tem controle de estoque
      NULL;
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
      RETURN jsonb_build_object('order_id', v_existing_id, 'idempotent', true);
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
    RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true);
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

  RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', false);
END;
$function$;

-- Grants vivos exatos (proacl 2026-11-12).
REVOKE ALL ON FUNCTION public.pdv_close_tab(uuid, uuid, jsonb, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_close_tab(uuid, uuid, jsonb, numeric, numeric) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.pdv_finalize_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO authenticated, service_role;
