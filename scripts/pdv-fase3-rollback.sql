-- ROLLBACK Fase 3 — aplicar no Supabase externo se algo der errado.
-- Reverte a RPC pdv_finalize_sale para a versão da Fase 1 (sem idempotência)
-- e remove a coluna client_uuid + índice + tabela de backup.

BEGIN;

-- Restaura RPC v1 (sem client_uuid, sem backup)
CREATE OR REPLACE FUNCTION public.pdv_finalize_sale(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id        uuid := (_payload->>'store_id')::uuid;
  v_session_id      uuid := (_payload->>'session_id')::uuid;
  v_table_id        text := _payload->>'table_identifier';
  v_subtotal        numeric := (_payload->>'subtotal')::numeric;
  v_discount        numeric := COALESCE((_payload->>'pdv_discount')::numeric, 0);
  v_commission      numeric := COALESCE((_payload->>'commission_rate')::numeric, 0);
  v_total           numeric := (_payload->>'total_price')::numeric;
  v_primary_method  text := _payload->>'payment_method';
  v_payments        jsonb := COALESCE(_payload->'payments', '[]'::jsonb);
  v_items           jsonb := COALESCE(_payload->'items', '[]'::jsonb);
  v_created_by      uuid := NULLIF(_payload->>'created_by','')::uuid;
  v_order_id        uuid;
  v_item            jsonb;
  v_payment         jsonb;
  v_session_open    boolean;
BEGIN
  SELECT (status = 'open') INTO v_session_open FROM pdv_sessions WHERE id = v_session_id;
  IF v_session_open IS NOT TRUE THEN RAISE EXCEPTION 'Sessão de PDV não está aberta'; END IF;

  INSERT INTO orders (
    store_id, client_id, order_source, pdv_session_id, table_identifier,
    subtotal, delivery_fee, pdv_discount, commission_rate, total_price,
    app_fee, payment_method, payments, neighborhood, address_details, status
  ) VALUES (
    v_store_id, NULL, 'pdv', v_session_id, v_table_id,
    v_subtotal, 0, v_discount, v_commission, v_total,
    0, v_primary_method, v_payments, 'Balcão',
    COALESCE(v_table_id || ' — Presencial', 'Pedido presencial'),
    'finalizado'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, addons, observations, metadata)
    VALUES (v_order_id, (v_item->>'product_id')::uuid,
      COALESCE((v_item->>'quantity')::numeric, 1), (v_item->>'unit_price')::numeric,
      CASE WHEN v_item ? 'addons' AND v_item->'addons' <> 'null'::jsonb THEN v_item->'addons' ELSE NULL END,
      NULLIF(v_item->>'observations',''),
      CASE WHEN v_item ? 'metadata' AND v_item->'metadata' <> 'null'::jsonb THEN v_item->'metadata' ELSE NULL END);
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments) LOOP
    INSERT INTO pdv_movements (session_id, store_id, type, amount, payment_method, description, order_id, created_by)
    VALUES (v_session_id, v_store_id, 'sale', (v_payment->>'amount')::numeric, v_payment->>'method',
      COALESCE(v_table_id, 'Venda balcão'), v_order_id, v_created_by);
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id);
END; $$;

DROP INDEX IF EXISTS public.orders_pdv_client_uuid_uniq;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_uuid;
-- Mantém pdv_outbox_backup por segurança; para remover: DROP TABLE public.pdv_outbox_backup;

COMMIT;
