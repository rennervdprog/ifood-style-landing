-- ============================================================================
-- Fase 1 Estoque + Ficha Técnica — 04/06: SEGURANÇA DA BAIXA (L-06).
--
-- Problema: stock_decrement_sale e get_recipe_stock_alerts eram
-- SECURITY DEFINER com grant PUBLIC+anon e SEM verificação de dono — qualquer
-- chamador com a chave anônima pública + UUIDs da vitrine podia zerar o
-- estoque (ou os insumos via ficha) de qualquer loja, e ler níveis de
-- estoque de ingredientes de qualquer loja.
--
-- Desenho (decidido com evidência — ver desenho-fase1.md §3):
--   1. A lógica de baixa vive numa função INTERNA sem grant
--      (stock_decrement_sale_internal), chamada só por código confiável do
--      banco: a função de trigger e pdv_close_tab (ambas SECURITY DEFINER,
--      dono postgres — o dono executa as próprias funções sem grant).
--   2. A função PÚBLICA stock_decrement_sale (mesma assinatura — o PDV não
--      muda) vira um wrapper que verifica autorização e delega à interna.
--   3. get_recipe_stock_alerts ganha a mesma verificação de autorização.
--   4. Grants: PUBLIC/anon revogados nas funções de estoque; ficam
--      authenticated + service_role (+ postgres, dono).
--
-- POR QUE NÃO um simples `auth.uid()` dentro da função única?
-- O caminho do trigger NÃO tem dono no contexto: o aceite automático roda
-- com auth.uid() = CLIENTE (INSERT feito pelo cliente), a liberação de
-- pré-pedido roda via pg_cron (auth.uid() NULL) e os webhooks legados rodam
-- com service_role (auth.uid() NULL). Uma checagem de dono dentro da função
-- única quebraria esses três caminhos. A separação interna/wrapper é o que
-- permite recusar o anônimo SEM quebrar o trigger. Provas: P01, P02, P12.
--
-- Única mudança de comportamento além da autorização: guarda contra
-- quantidade <= 0 na função interna (hoje quantidade negativa AUMENTARIA o
-- estoque — não há CHECK em order_items.quantity nem validação no trigger
-- de item; o PDV passa Math.abs, então nenhum fluxo legítimo é afetado).
-- Chamada com produto inexistente passa a levantar 'Produto não encontrado'
-- (padrão de stock_adjust) em vez de retornar true silencioso.
--
-- Aplicar em UMA transação (cutover atômico: entre o wrapper e o repoint do
-- trigger não pode haver janela em que o trigger chame o wrapper).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Função interna: lógica de baixa atual, verbatim + guarda de quantidade.
--    SEM GRANT para nenhum role (só o dono postgres executa).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_decrement_sale_internal(
  _product_id uuid,
  _quantity numeric,
  _order_id uuid DEFAULT NULL::uuid
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.product_stock;
  v_new_qty numeric;
  v_has_recipe boolean;
  v_recipe record;
  v_ing public.product_stock;
  v_decrement numeric;
  v_ing_new_qty numeric;
BEGIN
  -- Endurecimento Fase 1: quantidade inválida nunca mexe no estoque.
  -- (Sem CHECK em order_items.quantity, um valor <= 0 chegaria aqui e, no
  -- caminho direto, quantidade negativa SOMARIA estoque.)
  IF _quantity IS NULL OR _quantity <= 0 THEN RETURN false; END IF;

  -- Ficha técnica tem precedência: baixa os ingredientes, não o produto
  SELECT EXISTS (
    SELECT 1 FROM public.product_recipes WHERE product_id = _product_id
  ) INTO v_has_recipe;

  IF v_has_recipe THEN
    FOR v_recipe IN
      SELECT ingredient_product_id, quantity, unit
      FROM public.product_recipes
      WHERE product_id = _product_id
    LOOP
      SELECT * INTO v_ing FROM public.product_stock
        WHERE product_id = v_recipe.ingredient_product_id;
      -- Ingrediente sem controle de estoque: pula, não bloqueia a venda
      IF v_ing IS NULL OR NOT v_ing.track_stock THEN CONTINUE; END IF;

      v_decrement := public.convert_stock_unit(
        v_recipe.quantity * _quantity, v_recipe.unit, v_ing.unit);
      -- Nunca negativo (respeita o CHECK) e nunca bloqueia a venda
      v_ing_new_qty := GREATEST(0, v_ing.quantity - v_decrement);

      UPDATE public.product_stock
         SET quantity = v_ing_new_qty, updated_at = now()
       WHERE product_id = v_recipe.ingredient_product_id;

      INSERT INTO public.product_stock_movements
        (product_id, store_id, type, quantity, balance_after, order_id, created_by)
      VALUES
        (v_recipe.ingredient_product_id, v_ing.store_id, 'sale',
         v_decrement, v_ing_new_qty, _order_id, auth.uid());

      -- Marca ingrediente como esgotado quando zera
      IF v_ing_new_qty <= 0 THEN
        UPDATE public.products
           SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
         WHERE id = v_recipe.ingredient_product_id;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- Sem ficha técnica: comportamento original (baixa o próprio produto)
  SELECT * INTO v_row FROM public.product_stock WHERE product_id = _product_id;
  -- Produto sem controle de estoque: permite a venda
  IF v_row IS NULL OR NOT v_row.track_stock THEN RETURN true; END IF;

  IF v_row.quantity < _quantity THEN RETURN false; END IF;

  v_new_qty := v_row.quantity - _quantity;
  UPDATE public.product_stock
     SET quantity = v_new_qty, updated_at = now()
   WHERE product_id = _product_id;

  INSERT INTO public.product_stock_movements
    (product_id, store_id, type, quantity, balance_after, order_id, created_by)
  VALUES
    (_product_id, v_row.store_id, 'sale', _quantity, v_new_qty, _order_id, auth.uid());

  -- Marca esgotado no metadata quando zera
  IF v_new_qty <= 0 THEN
    UPDATE public.products
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
     WHERE id = _product_id;
  END IF;

  RETURN true;
END;
$function$;

COMMENT ON FUNCTION public.stock_decrement_sale_internal(uuid, numeric, uuid) IS
  'Fase 1 (L-06): baixa de estoque — USO INTERNO do banco (trigger de pedido e pdv_close_tab). Sem grant para nenhum role. Chamadas externas devem usar stock_decrement_sale (wrapper com verificação de dono).';

-- Sem grant: nem PUBLIC, nem anon/authenticated/service_role.
REVOKE ALL ON FUNCTION public.stock_decrement_sale_internal(uuid, numeric, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Wrapper público: MESMA assinatura (compatibilidade com o PDV) +
--    verificação de autorização. Autorizados: dono da loja, platform admin,
--    gestor da unidade (mesmo conjunto de store_transition_order_status) ou
--    service_role. Padrão de lookup do dono copiado de stock_adjust.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_decrement_sale(
  _product_id uuid,
  _quantity numeric,
  _order_id uuid DEFAULT NULL::uuid
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  SELECT store_id INTO v_store_id FROM public.products WHERE id = _product_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND owner_id = v_uid)
     AND NOT public.is_platform_admin(v_uid)
     AND NOT public.is_unit_manager(v_uid, v_store_id)
  THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN public.stock_decrement_sale_internal(_product_id, _quantity, _order_id);
END;
$function$;

COMMENT ON FUNCTION public.stock_decrement_sale(uuid, numeric, uuid) IS
  'Fase 1 (L-06): wrapper autorizado da baixa de estoque. Verifica dono/admin/gestor da loja do produto e delega a stock_decrement_sale_internal. Chamadas de trigger/RPC interna usam a função interna diretamente (o contexto do trigger não tem dono).';

-- ---------------------------------------------------------------------------
-- 3. get_recipe_stock_alerts: mesma consulta + verificação de autorização
--    para TODOS os produtos pedidos (falha fechada: produto desconhecido ou
--    de outra loja => exceção, nunca vazamento parcial).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_recipe_stock_alerts(_product_ids uuid[])
 RETURNS TABLE(ingredient_id uuid, ingredient_name text, quantity numeric, unit text, min_quantity numeric, is_zero boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
BEGIN
  IF _product_ids IS NULL OR COALESCE(array_length(_product_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    v_admin := public.is_platform_admin(v_uid);
    IF EXISTS (
      SELECT 1 FROM unnest(_product_ids) AS pid
      LEFT JOIN public.products p ON p.id = pid
      WHERE p.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(_product_ids) AS pid
      JOIN public.products p ON p.id = pid
      JOIN public.stores s ON s.id = p.store_id
      WHERE s.owner_id IS DISTINCT FROM v_uid
        AND NOT v_admin
        AND NOT public.is_unit_manager(v_uid, s.id)
    ) THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.name,
    s.quantity,
    s.unit,
    s.min_quantity,
    (s.quantity <= 0) AS is_zero
  FROM public.product_recipes pr
  JOIN public.product_stock s ON s.product_id = pr.ingredient_product_id
  JOIN public.products p ON p.id = pr.ingredient_product_id
  WHERE pr.product_id = ANY(_product_ids)
    AND s.track_stock = true
    AND (s.quantity <= 0 OR s.quantity <= s.min_quantity);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Repoint: trigger e pdv_close_tab passam a chamar a função INTERNA.
--    Corpos idênticos aos vivos, exceto a chamada de baixa (1 linha cada).
--    A condição do trigger NÃO muda aqui (muda na migração 05).
-- ---------------------------------------------------------------------------
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
  v_is_pdv := (NEW.pdv_session_id IS NOT NULL)
           OR (NEW.order_source = 'pdv')
           OR (NEW.metadata->>'pdv_session_id' IS NOT NULL)
           OR (NEW.metadata->>'source' = 'pdv');

  IF NOT v_is_pdv
     AND NEW.status::text IN ('pendente', 'preparando')
     AND (OLD.status IS NULL OR OLD.status::text NOT IN ('pendente', 'preparando', 'pronto_para_entrega', 'saiu_entrega', 'em_transito', 'entregue', 'finalizado')) THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      -- Fase 1 (L-06): chamada interna — o contexto do trigger não tem dono.
      SELECT public.stock_decrement_sale_internal(item.product_id, item.quantity, NEW.id) INTO v_ok;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

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
    BEGIN
      -- Fase 1 (L-06): chamada interna — pdv_close_tab já verificou o dono
      -- via pdv_assert_store_owner acima; o wrapper recusaria service_role/
      -- contextos sem dono.
      PERFORM public.stock_decrement_sale_internal(_item.product_id, _item.quantity, _order_id);
    EXCEPTION WHEN OTHERS THEN
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

-- ---------------------------------------------------------------------------
-- 5. Revisão de grants (L-06).
--    Regra: função chamada pelo navegador do lojista => authenticated +
--    service_role; função só-trigger => padrão da migration de hardening
--    20260820124000 (revoga PUBLIC/anon/authenticated, mantém service_role);
--    função interna => sem grant (feito no §1).
--    As funções irmãs (stock_adjust etc.) JÁ verificam dono no corpo — a
--    revogação de anon/PUBLIC nelas é defesa em profundidade e não muda
--    nenhum comportamento legítimo (chamada anon já falhava com
--    'Sem permissão'). convert_stock_unit NÃO é tocada: função pura,
--    NOT SECURITY DEFINER, sem acesso a dados — não há privilégio a abusar.
--    Grants apparel ficam como estão (corpos já verificam dono; subsistema
--    distinto, unificação na Fase 6) — ver desenho-fase1.md §3.4.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.stock_decrement_sale(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_decrement_sale(uuid, numeric, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_recipe_stock_alerts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recipe_stock_alerts(uuid[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.stock_adjust(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_adjust(uuid, numeric, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.stock_set_min(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_set_min(uuid, numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.stock_set_unit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_set_unit(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.stock_toggle_tracking(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_toggle_tracking(uuid, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_low_stock_products(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_low_stock_products(uuid) TO authenticated, service_role;

-- Funções só-trigger: nenhum chamador via RPC no repo (grep 2026-11-12).
-- A execução via trigger NÃO depende de grant — revogar é seguro.
REVOKE EXECUTE ON FUNCTION public.trg_decrement_stock_on_order_confirm() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_decrement_stock_on_order_confirm() TO service_role;

REVOKE EXECUTE ON FUNCTION public.auto_accept_order() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_accept_order() TO service_role;
