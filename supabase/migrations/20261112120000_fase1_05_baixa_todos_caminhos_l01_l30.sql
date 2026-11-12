-- ============================================================================
-- Fase 1 Estoque + Ficha Técnica — 05/06: BAIXA EM TODOS OS CAMINHOS (L-01)
-- + REGISTRO PERSISTENTE DE INSUFICIÊNCIA (L-30).
--
-- L-01 — o que muda:
--   a) O trigger de baixa passa a disparar também em `pendente → preparando`
--      (aceite manual via store_transition_order_status e aceite automático
--      via trigger auto_accept_order). Antes, só Pix Direto baixava.
--   b) Trigger NOVO em order_items (AFTER INSERT): baixa a linha inserida
--      quando o pedido-pai já está num estado CONFIRMADO (preparando,
--      pronto_para_entrega, saiu_entrega, em_transito) e não é PDV. Ele
--      cobre DOIS fluxos que o trigger de status não alcança:
--      (1) pedido manual (INSERT direto como `preparando`, sem UPDATE de
--          status — PdvDeliveryManualDialog.tsx insere o pedido e DEPOIS
--          os itens em lote);
--      (2) ACEITE AUTOMÁTICO via create_order_with_items: o INSERT do pedido
--          dispara auto_accept_order (AFTER INSERT), que faz o UPDATE
--          pendente→preparando ANTES de os itens existirem (os itens só são
--          inseridos no passo 12 da RPC, e o UPDATE final do passo 16 não
--          toca status). Sem este trigger, pedidos com aceite automático
--          NUNCA baixariam, mesmo com o trigger de status alargado — o
--          disparo de status rodaria sobre um conjunto vazio de itens.
--      Um trigger de INSERT em orders NÃO serviria (itens ainda não existem
--      no INSERT do pedido, em nenhum fluxo). Pedidos delivery normais
--      inserem itens com o pedido em pendente/aguardando/scheduled => este
--      trigger é no-op para eles (a baixa vem pelo trigger de status).
--   c) Pré-pedido: a liberação `scheduled → pendente` (release_scheduled_orders
--      via pg_cron) JÁ baixava hoje (OLD='scheduled' não estava na lista de
--      exclusão). O comportamento é PRESERVADO — e a idempotência abaixo
--      garante que liberação + aceite somem 1×, não 2×.
--   d) Pix Direto (comprovante_enviado → preparando) e Asaas legado
--      (aguardando_pagamento → pendente) continuam baixando como hoje.
--
-- IDEMPOTÊNCIA (obrigatória): a baixa de uma linha de pedido acontece no
-- máximo 1×, qualquer que seja o número de disparos do trigger, retries ou
-- reprocessamentos. Mecanismo: coluna nova order_item_id em
-- product_stock_movements + índice único parcial (order_item_id, product_id)
-- para type='sale'. A função interna, com a linha de estoque travada
-- (FOR UPDATE), verifica se já existe movimentação de venda para aquela
-- (linha, produto/ingrediente) ANTES de mexer no saldo; se existe, retorna
-- sem baixar de novo. Chamadas sem order_item_id (PDV via wrapper, comanda)
-- mantêm o comportamento atual (índice parcial não se aplica a NULL).
-- Linhas de um mesmo pedido/produto repetidas (ex.: mesmo produto em duas
-- linhas com adicionais diferentes) têm order_item_id distintos e baixam
-- cada uma — a agregação por (pedido, produto) sub-baixaria nesses casos.
-- Insuficiência no caminho direto NÃO grava movimentação nem "claim": uma
-- nova tentativa futura (ex.: após reposição) ainda pode baixar.
--
-- L-30 — o que muda: insuficiência passa a ser REGISTRADA na tabela nova
-- order_stock_alerts, ligada ao pedido (order_id + order_item_id), com
-- quantidade pedida, disponível e falta, por produto/ingrediente. O consumo
-- em UI é outro agente; aqui fica só o mecanismo de dados.
-- Semântica do retorno booleano (PRESERVADA): caminho direto retorna false
-- quando o saldo não cobre (o PDV mostra "Estoque insuficiente"); caminho
-- por ficha SEMPRE retorna true (nunca bloqueia a venda — a falta vai para
-- a tabela de avisos, não para o booleano). Quem precisa de detalhe consulta
-- order_stock_alerts; o booleano NÃO é sinal de suficiência no caminho ficha.
-- A movimentação por ficha continua gravando a quantidade PEDIDA (não a
-- efetiva) — corrigir isso é L-19, Fase 3. O aviso grava pedida/disponível/
-- falta, então a informação efetiva já fica persistida desde já.
--
-- Robustez: falha de baixa num item NÃO falha mais a atualização do pedido:
-- cada item roda num sub-bloco com EXCEPTION que grava aviso
-- kind='decrement_error' (com SQLERRM) e segue para o próximo item. Diferente
-- do swallow silencioso de pdv_close_tab (L-23), aqui a falha fica VISÍVEL
-- e persistente. O sub-bloco desfaz o trabalho parcial do item (savepoint).
--
-- Concorrência (mitigação PARCIAL de L-03, não o conserto completo da
-- Fase 2): SELECT ... FOR UPDATE na linha de estoque + ordem determinística
-- de trava dos ingredientes (ORDER BY ingredient_product_id) serializam
-- baixas concorrentes do mesmo produto/ingrediente e evitam deadlock entre
-- pedidos com os mesmos ingredientes. A trava validação→baixa do PDV
-- continua sendo Fase 2.
--
-- Aplicar em UMA transação. Idempotente, exceto o DROP da função interna
-- (assinatura muda: novo parâmetro _order_item_id — CREATE OR REPLACE não
-- pode mudar assinatura; o DROP é seguro porque nenhum objeto depende da
-- função interna via pg_depend — chamadores plpgsql resolvem em runtime).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rastreabilidade por linha: order_item_id em product_stock_movements
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_stock_movements
  ADD COLUMN IF NOT EXISTS order_item_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_stock_movements_order_item_id_fkey'
  ) THEN
    ALTER TABLE public.product_stock_movements
      ADD CONSTRAINT product_stock_movements_order_item_id_fkey
      FOREIGN KEY (order_item_id) REFERENCES public.order_items (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Claim de idempotência: no máximo uma movimentação de venda por
-- (linha do pedido, produto baixado). Parcial: chamadas sem order_item_id
-- (PDV/comanda) não participam. Linhas históricas têm order_item_id NULL.
CREATE UNIQUE INDEX IF NOT EXISTS product_stock_movements_order_item_sale_uniq
  ON public.product_stock_movements (order_item_id, product_id)
  WHERE order_item_id IS NOT NULL AND type = 'sale';

-- ---------------------------------------------------------------------------
-- 2. Tabela de avisos persistentes de insuficiência (L-30)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_stock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items (id) ON DELETE SET NULL,
  ingredient_product_id uuid REFERENCES public.products (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('insufficient_stock', 'recipe_shortfall', 'decrement_error')),
  requested_qty numeric NOT NULL CHECK (requested_qty > 0),
  available_qty numeric NOT NULL CHECK (available_qty >= 0),
  shortfall_qty numeric NOT NULL CHECK (shortfall_qty > 0),
  unit text NOT NULL DEFAULT 'un'::text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT order_stock_alerts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_order_stock_alerts_order
  ON public.order_stock_alerts USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_stock_alerts_store_created
  ON public.order_stock_alerts USING btree (store_id, created_at DESC);

ALTER TABLE public.order_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Policy espelhada em product_stock_movements ("Owner manages ..."): só o
-- dono da loja lê/gerencia. Leitura por service_role (super-admin) não passa
-- por RLS. Se a UI de loja precisar de leitura por gestor, o agente de UI
-- adiciona policy — não inventar aqui.
DROP POLICY IF EXISTS "Owner manages order_stock_alerts" ON public.order_stock_alerts;
CREATE POLICY "Owner manages order_stock_alerts" ON public.order_stock_alerts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = order_stock_alerts.store_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = order_stock_alerts.store_id AND s.owner_id = auth.uid()
  ));

COMMENT ON TABLE public.order_stock_alerts IS
  'Fase 1 (L-30): avisos persistentes de que a baixa de estoque não cobriu um pedido. insufficient_stock = caminho direto sem saldo; recipe_shortfall = ingrediente da ficha abaixo do necessário (baixa parcial com piso 0); decrement_error = a baixa falhou com exceção (detalhe em detail.error; available_qty=0 é placeholder). resolved_at é para a UI marcar como tratado (outro agente).';

-- ---------------------------------------------------------------------------
-- 3. Função interna v2: claim por linha + avisos + travas.
--    Assinatura nova (4º parâmetro _order_item_id, default NULL).
--    O wrapper da migração 04 (3 args) continua resolvendo via default.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.stock_decrement_sale_internal(uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.stock_decrement_sale_internal(
  _product_id uuid,
  _quantity numeric,
  _order_id uuid DEFAULT NULL::uuid,
  _order_item_id uuid DEFAULT NULL::uuid
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
  v_effective numeric;
  v_ing_new_qty numeric;
BEGIN
  IF _quantity IS NULL OR _quantity <= 0 THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_recipes WHERE product_id = _product_id
  ) INTO v_has_recipe;

  IF v_has_recipe THEN
    -- ORDER BY determinístico: trava ingredientes sempre na mesma ordem
    -- (evita deadlock entre pedidos concorrentes com os mesmos insumos).
    FOR v_recipe IN
      SELECT ingredient_product_id, quantity, unit
      FROM public.product_recipes
      WHERE product_id = _product_id
      ORDER BY ingredient_product_id
    LOOP
      SELECT * INTO v_ing FROM public.product_stock
        WHERE product_id = v_recipe.ingredient_product_id
        FOR UPDATE;
      IF v_ing IS NULL OR NOT v_ing.track_stock THEN CONTINUE; END IF;

      -- Idempotência: esta (linha, ingrediente) já baixou? (A checagem vem
      -- DEPOIS do FOR UPDATE: concorrentes esperam a trava e enxergam a
      -- movimentação já commitada; reentrância na mesma transação enxerga
      -- a própria movimentação ainda não commitada.)
      IF _order_item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.product_stock_movements m
        WHERE m.order_item_id = _order_item_id
          AND m.product_id = v_recipe.ingredient_product_id
          AND m.type = 'sale'
      ) THEN CONTINUE; END IF;

      v_decrement := public.convert_stock_unit(
        v_recipe.quantity * _quantity, v_recipe.unit, v_ing.unit);
      v_effective := LEAST(v_decrement, v_ing.quantity);
      v_ing_new_qty := GREATEST(0, v_ing.quantity - v_decrement);

      -- L-30: falta de ingrediente fica registrada (a venda NÃO bloqueia).
      IF v_effective < v_decrement AND _order_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.order_stock_alerts a
        WHERE a.order_id = _order_id
          AND a.order_item_id IS NOT DISTINCT FROM _order_item_id
          AND a.product_id = _product_id
          AND a.ingredient_product_id IS NOT DISTINCT FROM v_recipe.ingredient_product_id
          AND a.kind = 'recipe_shortfall'
      ) THEN
        INSERT INTO public.order_stock_alerts
          (order_id, store_id, product_id, order_item_id, ingredient_product_id,
           kind, requested_qty, available_qty, shortfall_qty, unit, detail)
        VALUES
          (_order_id, v_ing.store_id, _product_id, _order_item_id,
           v_recipe.ingredient_product_id, 'recipe_shortfall',
           v_decrement, v_ing.quantity, v_decrement - v_effective, v_ing.unit,
           jsonb_build_object(
             'recipe_quantity', v_recipe.quantity,
             'recipe_unit', v_recipe.unit,
             'sold_quantity', _quantity,
             'stock_unit', v_ing.unit,
             'effective_qty', v_effective));
      END IF;

      UPDATE public.product_stock
         SET quantity = v_ing_new_qty, updated_at = now()
       WHERE product_id = v_recipe.ingredient_product_id;

      -- Quantidade gravada = PEDIDA (não a efetiva): semântica atual
      -- preservada (L-19 é Fase 3). O aviso acima guarda pedida/disponível.
      INSERT INTO public.product_stock_movements
        (product_id, store_id, type, quantity, balance_after, order_id, order_item_id, created_by)
      VALUES
        (v_recipe.ingredient_product_id, v_ing.store_id, 'sale',
         v_decrement, v_ing_new_qty, _order_id, _order_item_id, auth.uid());

      IF v_ing_new_qty <= 0 THEN
        UPDATE public.products
           SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
         WHERE id = v_recipe.ingredient_product_id;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- Sem ficha técnica: baixa o próprio produto.
  SELECT * INTO v_row FROM public.product_stock
    WHERE product_id = _product_id
    FOR UPDATE;
  IF v_row IS NULL OR NOT v_row.track_stock THEN RETURN true; END IF;

  -- Idempotência (caminho direto): já baixou? Retorna true (sucesso
  -- idempotente — o chamador não distingue 1ª de 2ª execução).
  IF _order_item_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.product_stock_movements m
    WHERE m.order_item_id = _order_item_id
      AND m.product_id = _product_id
      AND m.type = 'sale'
  ) THEN RETURN true; END IF;

  IF v_row.quantity < _quantity THEN
    -- L-30: sem saldo. NÃO grava movimentação nem claim: uma nova tentativa
    -- futura (após reposição) ainda pode baixar. Retorno false preservado.
    IF _order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.order_stock_alerts a
      WHERE a.order_id = _order_id
        AND a.order_item_id IS NOT DISTINCT FROM _order_item_id
        AND a.product_id = _product_id
        AND a.ingredient_product_id IS NULL
        AND a.kind = 'insufficient_stock'
    ) THEN
      INSERT INTO public.order_stock_alerts
        (order_id, store_id, product_id, order_item_id, ingredient_product_id,
         kind, requested_qty, available_qty, shortfall_qty, unit, detail)
      VALUES
        (_order_id, v_row.store_id, _product_id, _order_item_id, NULL,
         'insufficient_stock', _quantity, v_row.quantity,
         _quantity - v_row.quantity, v_row.unit,
         jsonb_build_object('sold_quantity', _quantity));
    END IF;
    RETURN false;
  END IF;

  v_new_qty := v_row.quantity - _quantity;
  UPDATE public.product_stock
     SET quantity = v_new_qty, updated_at = now()
   WHERE product_id = _product_id;

  INSERT INTO public.product_stock_movements
    (product_id, store_id, type, quantity, balance_after, order_id, order_item_id, created_by)
  VALUES
    (_product_id, v_row.store_id, 'sale', _quantity, v_new_qty, _order_id, _order_item_id, auth.uid());

  IF v_new_qty <= 0 THEN
    UPDATE public.products
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
     WHERE id = _product_id;
  END IF;

  RETURN true;
END;
$function$;

COMMENT ON FUNCTION public.stock_decrement_sale_internal(uuid, numeric, uuid, uuid) IS
  'Fase 1 (L-01/L-30): baixa de estoque — USO INTERNO do banco. Idempotente por (order_item_id, produto) quando _order_item_id é informado; grava avisos em order_stock_alerts quando a baixa não cobre. Sem grant para nenhum role.';

REVOKE ALL ON FUNCTION public.stock_decrement_sale_internal(uuid, numeric, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Trigger de baixa v3: dispara também em pendente → preparando.
--    Diff vs. versão viva: 'pendente' SAIU da lista de exclusão do OLD, e
--    foi adicionada a guarda OLD ≠ NEW (UPDATE que reatribui o mesmo status
--    não dispara). Todas as transições que baixavam antes continuam baixando:
--    scheduled→pendente, comprovante_enviado→preparando,
--    aguardando_pagamento→pendente, aguardando_*→pendente/preparando.
--    A idempotência por linha (claim) garante 1× mesmo quando DUAS
--    transições disparam para o mesmo pedido (ex.: liberação + aceite).
--    Cada item roda em sub-bloco: exceção vira aviso decrement_error e o
--    pedido NÃO falha por causa do estoque.
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

-- O trigger em si (nome/evento) não muda; recriado por clareza/idempotência.
DROP TRIGGER IF EXISTS trg_order_confirm_decrement_stock ON public.orders;
CREATE TRIGGER trg_order_confirm_decrement_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_decrement_stock_on_order_confirm();

-- ---------------------------------------------------------------------------
-- 5. Trigger NOVO em order_items: baixa a linha inserida quando o pedido-pai
--    já está CONFIRMADO (e não é PDV). Cobre o pedido manual (nasce
--    preparando) e o aceite automático (itens inseridos DEPOIS do UPDATE
--    pendente→preparando feito pelo trigger auto_accept_order durante o
--    INSERT do pedido — ver cabeçalho, item (b)(2)). A detecção de PDV
--    espelha a do trigger de status (colunas + metadata). O claim por linha
--    impede duplicata com o trigger de status: linhas já baixadas por ele
--    são puladas aqui, e vice-versa.
--    Pedidos delivery (create_order_with_items) inserem itens com o pedido
--    em pendente/aguardando/scheduled => no-op. PDV (pdv_finalize_sale /
--    pdv_close_tab, order_source='pdv', status finalizado) => no-op.
--    Itens inseridos em pedido cancelado/entregue/finalizado => no-op.
-- ---------------------------------------------------------------------------
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

  v_is_pdv := (v_pdv_session IS NOT NULL)
           OR (v_source = 'pdv')
           OR (v_metadata->>'pdv_session_id' IS NOT NULL)
           OR (v_metadata->>'source' = 'pdv');
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

DROP TRIGGER IF EXISTS trg_order_item_decrement_stock ON public.order_items;
CREATE TRIGGER trg_order_item_decrement_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_decrement_stock_on_item_insert();

COMMENT ON FUNCTION public.trg_decrement_stock_on_item_insert() IS
  'Fase 1 (L-01): baixa a linha de item inserida quando o pedido-pai já está confirmado (preparando/pronto/saiu/em_transito) e não é PDV. Cobre pedido manual e aceite automático (itens chegam depois da confirmação). Idempotente por linha via claim em product_stock_movements.';

-- Função só-trigger: sem grant (padrão de hardening 20260820124000).
REVOKE EXECUTE ON FUNCTION public.trg_decrement_stock_on_item_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_decrement_stock_on_item_insert() TO service_role;
