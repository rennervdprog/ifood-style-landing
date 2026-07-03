BEGIN;

-- 5.1 Backup: cópia de segurança dos payloads
CREATE TABLE IF NOT EXISTS public.pdv_outbox_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid uuid,
  store_id uuid,
  session_id uuid,
  payload jsonb NOT NULL,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pdv_outbox_backup TO authenticated;
GRANT ALL ON public.pdv_outbox_backup TO service_role;
ALTER TABLE public.pdv_outbox_backup ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pdv_outbox_backup' AND policyname='pdv_outbox_backup_read') THEN
    CREATE POLICY "pdv_outbox_backup_read" ON public.pdv_outbox_backup
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 1. Idempotência: client_uuid em orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_uuid uuid;
CREATE UNIQUE INDEX IF NOT EXISTS orders_pdv_client_uuid_uniq
  ON public.orders (client_uuid)
  WHERE order_source = 'pdv' AND client_uuid IS NOT NULL;

-- 2. RPC v2: idempotente + backup
CREATE OR REPLACE FUNCTION public.pdv_finalize_sale(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_uuid     uuid := NULLIF(_payload->>'client_uuid','')::uuid;
  v_existing_order  uuid;
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
  IF v_store_id IS NULL OR v_session_id IS NULL THEN
    RAISE EXCEPTION 'store_id e session_id são obrigatórios';
  END IF;

  -- Idempotência: mesmo client_uuid retorna o pedido existente
  IF v_client_uuid IS NOT NULL THEN
    SELECT id INTO v_existing_order FROM orders
     WHERE client_uuid = v_client_uuid AND order_source = 'pdv' LIMIT 1;
    IF v_existing_order IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_existing_order, 'idempotent', true);
    END IF;
  END IF;

  SELECT (status = 'open') INTO v_session_open
  FROM pdv_sessions WHERE id = v_session_id;
  IF v_session_open IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão de PDV não está aberta';
  END IF;

  -- Backup best-effort do payload
  BEGIN
    INSERT INTO pdv_outbox_backup (client_uuid, store_id, session_id, payload)
    VALUES (v_client_uuid, v_store_id, v_session_id, _payload);
  EXCEPTION WHEN OTHERS THEN NULL; END;

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
    'finalizado', v_client_uuid
  )
  RETURNING id INTO v_order_id;

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
      description, order_id, created_by
    ) VALUES (
      v_session_id, v_store_id, 'sale',
      (v_payment->>'amount')::numeric,
      v_payment->>'method',
      COALESCE(v_table_id, 'Venda balcão'),
      v_order_id, v_created_by
    );
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.pdv_finalize_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO service_role;

COMMIT;
