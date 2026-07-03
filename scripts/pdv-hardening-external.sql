-- ─────────────────────────────────────────────────────────────────────
-- PDV hardening — aplicar no Supabase EXTERNO (qkjhguziuchqsbxzruea).
-- Corresponde às fases 1 e 2 do plano em .lovable/plan.md.
--
-- Cobre:
--   1) RPC atômica `pdv_finalize_sale(_payload jsonb)` — evita pedido sem
--      itens / sem movimento quando um dos 3 inserts falhava no meio.
--   2) UNIQUE INDEX parcial em `pdv_sessions` — impede dois caixas
--      abertos simultâneos para a mesma loja.
--   3) CHECK constraints em `pdv_movements` — proíbe valor <= 0 e tipos
--      inválidos (defesa em profundidade além da validação do client).
--
-- Ordem importa: rodar tudo em uma única transação.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1) RPC atômica de finalização de venda no PDV.
--    O client (usePdvCheckout.ts) chama esta função primeiro; se ela não
--    existir ainda (rollout gradual), cai no fluxo antigo de 3 inserts.
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
  IF v_store_id IS NULL OR v_session_id IS NULL THEN
    RAISE EXCEPTION 'store_id e session_id são obrigatórios';
  END IF;

  -- Sessão precisa estar aberta.
  SELECT (status = 'open') INTO v_session_open
  FROM pdv_sessions WHERE id = v_session_id;
  IF v_session_open IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão de PDV não está aberta';
  END IF;

  -- 1) Pedido
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
  )
  RETURNING id INTO v_order_id;

  -- 2) Itens
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

  -- 3) Movimentações (uma por forma de pagamento)
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

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.pdv_finalize_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pdv_finalize_sale(jsonb) TO service_role;

-- 2) Impede duas sessões de PDV abertas para a mesma loja.
CREATE UNIQUE INDEX IF NOT EXISTS pdv_sessions_one_open_per_store
  ON public.pdv_sessions (store_id)
  WHERE status = 'open';

-- 3) CHECK constraints em pdv_movements.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdv_movements_amount_positive'
  ) THEN
    ALTER TABLE public.pdv_movements
      ADD CONSTRAINT pdv_movements_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdv_movements_type_valid'
  ) THEN
    ALTER TABLE public.pdv_movements
      ADD CONSTRAINT pdv_movements_type_valid
      CHECK (type IN ('sale','sangria','suprimento'));
  END IF;
END$$;

COMMIT;