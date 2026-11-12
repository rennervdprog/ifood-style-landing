-- ============================================================================
-- FASE 2 — Migração 03: cancelamento repõe estoque (L-04) + devolução manual
-- com motivo (só mecanismo — a UI precisa de preview e fica fora desta fase).
--
-- stock_returnable_qty: quanto ainda pode voltar para um escopo
-- (order_item_id + produto; order_item_id NULL = baixas sem claim, PDV
-- pré-Fase 1). vendido_efetivo − já_devolvido, onde vendido_efetivo =
-- soma das 'sale' − shortfall de ficha casado (alertas recipe_shortfall:
-- ingredient_product_id = produto, ou ramo defensivo ingredient NULL +
-- product_id = produto). Nunca negativa. É a fórmula única usada pelo
-- restore automático e pela RPC manual.
--
-- stock_restore_sale_internal: chamada pelo trigger de cancelamento.
-- Trava a linha do pedido (serializa restores concorrentes), itera os
-- escopos com movimentação 'sale', repõe o restante com INSERT
-- type='return' (reason 'cancelamento', order_id + order_item_id ligados),
-- limpa out_of_stock quando o saldo volta > 0 (padrão stock_adjust) e
-- registra kind 'restore_error' por escopo em caso de falha — o
-- cancelamento NUNCA falha por causa da reposição. Pula produtos sem
-- linha de estoque ou track_stock=false (espelha a baixa). Idempotência
-- pelo cálculo do restante: 2º cancelamento do mesmo pedido encontra
-- restante 0. NÃO há índice único para 'return' (conflitaria com o
-- restante agregado + devoluções manuais).
--
-- Trigger trg_order_cancel_restore_stock: AFTER UPDATE OF status, dispara
-- só na transição PARA 'cancelado' (OLD IS DISTINCT FROM NEW). Sem checagem
-- de auth.uid() — mesmo padrão dos triggers de baixa: cancelam também
-- pg_cron (uid NULL) e service_role (webhooks). Casts ::text preservados
-- (enum order_status não tem 'confirmado'/'pronto').
--
-- stock_register_return: devolução manual de restaurante. Motivo
-- obrigatório, qty > 0, produto com controle de estoque. Quando ligada a
-- pedido/linha, nunca devolve mais que o restante (mesma fórmula).
-- Checagem de permissão idêntica à do wrapper stock_decrement_sale
-- (Fase 1, L-06): dono/admin/gestor/service_role. Grants: authenticated +
-- service_role; PUBLIC/anon revogados.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.stock_returnable_qty(_order_id uuid, _order_item_id uuid, _product_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sold numeric;
  v_short numeric;
  v_returned numeric;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_sold
    FROM public.product_stock_movements
   WHERE order_id = _order_id AND type = 'sale' AND product_id = _product_id
     AND order_item_id IS NOT DISTINCT FROM _order_item_id;
  SELECT COALESCE(SUM(shortfall_qty), 0) INTO v_short
    FROM public.order_stock_alerts
   WHERE order_id = _order_id AND kind = 'recipe_shortfall'
     AND order_item_id IS NOT DISTINCT FROM _order_item_id
     AND (ingredient_product_id = _product_id
          OR (ingredient_product_id IS NULL AND product_id = _product_id));
  SELECT COALESCE(SUM(quantity), 0) INTO v_returned
    FROM public.product_stock_movements
   WHERE order_id = _order_id AND type = 'return' AND product_id = _product_id
     AND order_item_id IS NOT DISTINCT FROM _order_item_id;
  RETURN GREATEST(v_sold - v_short - v_returned, 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.stock_returnable_qty(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.stock_restore_sale_internal(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_scope record;
  v_rest numeric;
  v_row public.product_stock;
  v_new_qty numeric;
BEGIN
  SELECT id, store_id INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;
  -- Serializa restores deste pedido (2 cancelamentos concorrentes não
  -- repõem 2×: o 2º espera e encontra restante 0).
  PERFORM 1 FROM public.orders WHERE id = _order_id FOR UPDATE;

  FOR v_scope IN
    SELECT m.order_item_id, m.product_id
      FROM public.product_stock_movements m
     WHERE m.order_id = _order_id AND m.type = 'sale'
     GROUP BY m.order_item_id, m.product_id
  LOOP
    v_rest := public.stock_returnable_qty(_order_id, v_scope.order_item_id, v_scope.product_id);
    IF v_rest IS NULL OR v_rest <= 0 THEN CONTINUE; END IF;

    BEGIN
      SELECT * INTO v_row FROM public.product_stock
       WHERE product_id = v_scope.product_id FOR UPDATE;
      IF v_row IS NULL OR NOT v_row.track_stock THEN CONTINUE; END IF;

      v_new_qty := v_row.quantity + v_rest;
      UPDATE public.product_stock
         SET quantity = v_new_qty, updated_at = now()
       WHERE product_id = v_scope.product_id;

      INSERT INTO public.product_stock_movements
        (product_id, store_id, type, quantity, balance_after, order_id, order_item_id, reason, created_by)
      VALUES
        (v_scope.product_id, v_row.store_id, 'return', v_rest, v_new_qty,
         _order_id, v_scope.order_item_id, 'cancelamento', auth.uid());

      -- Limpa out_of_stock quando o saldo volta (espelha stock_adjust).
      IF v_new_qty > 0 THEN
        UPDATE public.products
           SET metadata = COALESCE(metadata, '{}'::jsonb) - 'out_of_stock'
         WHERE id = v_scope.product_id AND (metadata->>'out_of_stock') IS NOT NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Falha de reposição NUNCA falha o cancelamento — fica registrada.
      IF NOT EXISTS (
        SELECT 1 FROM public.order_stock_alerts a
        WHERE a.order_id = _order_id
          AND a.order_item_id IS NOT DISTINCT FROM v_scope.order_item_id
          AND a.product_id = v_scope.product_id
          AND a.kind = 'restore_error'
      ) THEN
        INSERT INTO public.order_stock_alerts
          (order_id, store_id, product_id, order_item_id, ingredient_product_id,
           kind, requested_qty, available_qty, shortfall_qty, unit, detail)
        VALUES
          (_order_id, v_order.store_id, v_scope.product_id, v_scope.order_item_id, NULL,
           'restore_error', v_rest, COALESCE(v_row.quantity, 0), v_rest,
           COALESCE(v_row.unit, 'un'),
           jsonb_build_object('error', SQLERRM, 'phase', 'order_cancel_restore'));
      END IF;
    END;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.stock_restore_sale_internal(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_restore_stock_on_order_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text = 'cancelado' AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    PERFORM public.stock_restore_sale_internal(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_order_cancel_restore_stock ON public.orders;
CREATE TRIGGER trg_order_cancel_restore_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_restore_stock_on_order_cancel();

CREATE OR REPLACE FUNCTION public.stock_register_return(_product_id uuid, _quantity numeric, _reason text, _order_id uuid DEFAULT NULL::uuid, _order_item_id uuid DEFAULT NULL::uuid)
 RETURNS product_stock
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_uid uuid := auth.uid();
  v_order_id uuid := _order_id;
  v_remaining numeric;
  v_row public.product_stock;
  v_new_qty numeric;
BEGIN
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
  SELECT store_id INTO v_store_id FROM public.products WHERE id = _product_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  -- Mesma checagem do wrapper stock_decrement_sale (Fase 1, L-06).
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND owner_id = v_uid)
     AND NOT public.is_platform_admin(v_uid)
     AND NOT public.is_unit_manager(v_uid, v_store_id)
  THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Deriva o pedido da linha quando só a linha foi informada.
  IF v_order_id IS NULL AND _order_item_id IS NOT NULL THEN
    SELECT order_id INTO v_order_id FROM public.order_items WHERE id = _order_item_id;
  END IF;

  -- Quando ligada a pedido/linha: nunca devolver mais que o restante
  -- (vendido efetivo − já devolvido, mesma fórmula do restore automático).
  IF v_order_id IS NOT NULL THEN
    v_remaining := public.stock_returnable_qty(v_order_id, _order_item_id, _product_id);
    IF _quantity > v_remaining THEN
      RAISE EXCEPTION 'return_exceeds_sold: quantity=% returnable=%', _quantity, v_remaining;
    END IF;
  END IF;

  SELECT * INTO v_row FROM public.product_stock
   WHERE product_id = _product_id FOR UPDATE;
  IF v_row IS NULL OR NOT v_row.track_stock THEN
    RAISE EXCEPTION 'Produto sem controle de estoque';
  END IF;

  v_new_qty := v_row.quantity + _quantity;
  UPDATE public.product_stock
     SET quantity = v_new_qty, updated_at = now()
   WHERE product_id = _product_id
   RETURNING * INTO v_row;

  INSERT INTO public.product_stock_movements
    (product_id, store_id, type, quantity, balance_after, order_id, order_item_id, reason, created_by)
  VALUES
    (_product_id, v_store_id, 'return', _quantity, v_new_qty, v_order_id, _order_item_id, _reason, v_uid);

  IF v_new_qty > 0 THEN
    UPDATE public.products
       SET metadata = COALESCE(metadata, '{}'::jsonb) - 'out_of_stock'
     WHERE id = _product_id AND (metadata->>'out_of_stock') IS NOT NULL;
  END IF;

  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.stock_register_return(uuid, numeric, text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stock_register_return(uuid, numeric, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.stock_register_return(uuid, numeric, text, uuid, uuid) TO authenticated, service_role;
