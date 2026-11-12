-- ============================================================================
-- FASE 2 — Migração 01: helpers da baixa (peso + baixa por pedido) e kind
-- 'restore_error' em order_stock_alerts.
--
-- stock_effective_sale_qty: quantidade que a baixa deve usar para uma linha
-- de venda. Sem peso, a quantidade da linha (comportamento atual). Com peso
-- (metadata.weight_grams, diálogo de pesagem do PDV): ficha técnica lê o
-- peso em kg (multiplicador da ficha); sem ficha, converte gramas para a
-- unidade do estoque via convert_stock_unit. PREMISSA DOCUMENTADA: zero
-- produtos vendidos por peso têm ficha no vivo (2026-11-12) — o ramo de
-- ficha é defensivo e fica travado pela prova Q05b.
--
-- pdv_decrement_order_items: baixa de TODAS as linhas de um pedido já
-- persistido, com claim (order_item_id) — usada pelo finalize (caminho novo
-- e replays idempotentes). Pula linhas boutique (metadata.apparel_variant_id:
-- outro estoque, product_variants). Com _raise_on_insufficient=true, a
-- falta de saldo (caminho direto) aborta a transação chamadora — é a trava
-- de concorrência L-03. Com false, registra o alerta e retorna false.
--
-- Sem grants: como stock_decrement_sale_internal, só postgres executa
-- (chamadas sempre a partir de funções SECURITY DEFINER).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.stock_effective_sale_qty(_product_id uuid, _quantity numeric, _weight_grams numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit text;
  v_has_recipe boolean;
BEGIN
  -- Sem peso (ou peso inválido): a quantidade da linha manda, como sempre.
  IF _weight_grams IS NULL OR _weight_grams <= 0 THEN RETURN _quantity; END IF;

  -- Com ficha técnica: o multiplicador é o peso em kg. A interna multiplica
  -- recipe.quantity × _quantity e converte da unidade da ficha para a do
  -- insumo; logo a ficha de um produto vendido por peso é lida como "por kg".
  SELECT EXISTS (
    SELECT 1 FROM public.product_recipes WHERE product_id = _product_id
  ) INTO v_has_recipe;
  IF v_has_recipe THEN RETURN _weight_grams / 1000; END IF;

  -- Sem ficha: converte gramas para a unidade do estoque (g→kg, etc.).
  -- Unidade incompatível/ausente: convert_stock_unit devolve gramas sem
  -- conversão (não quebra a venda) — e sem linha de estoque a interna
  -- retorna true sem baixar.
  SELECT unit INTO v_unit FROM public.product_stock WHERE product_id = _product_id;
  RETURN public.convert_stock_unit(_weight_grams, 'g', v_unit);
END;
$function$;

-- Supabase concede EXECUTE a anon/authenticated/service_role por default
-- privileges (não só via PUBLIC): revogar os 4 explicitamente, como a
-- interna (Fase 1, L-06). Só postgres executa.
REVOKE EXECUTE ON FUNCTION public.stock_effective_sale_qty(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pdv_decrement_order_items(_order_id uuid, _raise_on_insufficient boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  v_qty numeric;
  v_ok boolean;
  v_any_failed boolean := false;
BEGIN
  FOR item IN
    SELECT id, product_id, quantity, metadata
      FROM public.order_items
     WHERE order_id = _order_id AND product_id IS NOT NULL
  LOOP
    -- Linhas boutique (variante apparel): outro estoque (product_variants),
    -- tratado por apparel_adjust_stock no fechamento de comanda e no loop
    -- client-side do balcão — nunca pela baixa de product_stock.
    IF item.metadata->>'apparel_variant_id' IS NOT NULL THEN CONTINUE; END IF;

    v_qty := public.stock_effective_sale_qty(
      item.product_id, item.quantity, (item.metadata->>'weight_grams')::numeric);

    SELECT public.stock_decrement_sale_internal(item.product_id, v_qty, _order_id, item.id) INTO v_ok;
    IF v_ok IS NOT TRUE THEN
      v_any_failed := true;
      IF _raise_on_insufficient THEN
        RAISE EXCEPTION 'insufficient_stock: product_id=% requested=%', item.product_id, v_qty;
      END IF;
    END IF;
  END LOOP;
  RETURN NOT v_any_failed;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pdv_decrement_order_items(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- Novo kind para falhas de REPOSIÇÃO no cancelamento (migração 03). Estender o
-- CHECK não invalida nenhuma linha existente (só adiciona um valor permitido).
ALTER TABLE public.order_stock_alerts DROP CONSTRAINT order_stock_alerts_kind_check;
ALTER TABLE public.order_stock_alerts ADD CONSTRAINT order_stock_alerts_kind_check
  CHECK (kind = ANY (ARRAY['insufficient_stock'::text, 'recipe_shortfall'::text, 'decrement_error'::text, 'restore_error'::text]));
