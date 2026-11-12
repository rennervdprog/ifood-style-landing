-- ============================================================================
-- FASE 1 — Migração 07: detecção de PDV NULL-safe nos dois triggers de baixa.
--
-- ACHADO DAS PROVAS P03/P04 (2026-11-12): a detecção de PDV herdada verbatim
-- do trigger vivo tinha um bug de lógica trivalente:
--   v_is_pdv := (... IS NOT NULL) OR (order_source = 'pdv')
--            OR (... IS NOT NULL) OR (metadata->>'source' = 'pdv');
-- Para pedidos com metadata NULL (448 de 458 pedidos no banco) ou sem a
-- chave 'source', o último termo vale NULL, logo v_is_pdv vale NULL, logo
-- `IF NOT v_is_pdv` nunca entra. Prova no banco: as 15 movimentações
-- type='sale' existentes são TODAS de pedidos PDV (via pdv_close_tab /
-- chamada direta) — ZERO de delivery. O trigger de baixa do delivery NUNCA
-- disparou em produção; a auditoria leu a condição como "só Pix Direto",
-- mas na prática era "nunca".
--
-- Correção: COALESCE nos dois termos de comparação (= 'pdv'), garantindo
-- booleano puro. Os termos IS NOT NULL já são sempre true/false.
-- O trigger de itens usava `IF v_is_pdv THEN RETURN` (NULL = não retorna),
-- por isso P05 passava mesmo com o bug; recebe o mesmo COALESCE por
-- consistência e defesa (um refactor futuro para `IF NOT v_is_pdv`
-- reintroduziria o bug silenciosamente).
--
-- Corpos idênticos aos da migração 05, exceto as 4 linhas de v_is_pdv.
-- Sem mudança de assinatura, trigger, grant ou policy.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_order_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  v_ok boolean;
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
    FOR item IN SELECT id, product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      BEGIN
        SELECT public.stock_decrement_sale_internal(item.product_id, item.quantity, NEW.id, item.id) INTO v_ok;
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
             'decrement_error', item.quantity, 0, item.quantity, 'un',
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
    SELECT public.stock_decrement_sale_internal(NEW.product_id, NEW.quantity, NEW.order_id, NEW.id) INTO v_ok;
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
         'decrement_error', NEW.quantity, 0, NEW.quantity, 'un',
         jsonb_build_object(
           'error', SQLERRM,
           'phase', 'confirmed_order_item_insert',
           'note', 'available_qty=0 é placeholder: a quantidade disponível era desconhecida quando a baixa falhou.'));
    END IF;
  END;
  RETURN NEW;
END; $function$;
