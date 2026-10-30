-- Fase 3 — Herança de cardápio (28/10/2026, plano 28/10/2026).
--
-- Causa real do "0 produtos copiados" (investigada no corpo da função
-- antiga + no schema ao vivo, não chutada):
--   1. DRIFT DE SCHEMA: o clone_menu_from_matriz antigo referencia colunas
--      que NÃO EXISTEM mais (menu_sections/products/addon_groups/
--      addon_items usam sort_order, não display_order; addon_groups não
--      tem is_required; addon_items não tem is_available; o vínculo
--      produto↔grupo é addon_group_id, não group_id). Chamar o clone hoje
--      dá erro de "column does not exist" — a cópia nem acontece.
--   2. CHAVE DE RETORNO: mesmo se rodasse, a função devolve
--      {sections, products, addon_groups} e o painel lê
--      {categories_copied, products_copied} → undefined || 0 → o toast
--      mostra "0 categorias e 0 produtos copiados" com a cópia feita.
--   3. VÍNCULO POR NOME+PREÇO (achado A10): o mapa old→new casava por
--      nome+preço — dois produtos iguais geram vínculo cruzado e a
--      contagem inflada; e rodar o clone 2x duplicava tudo.
--
-- O que esta migration faz:
--   1. Código estável: network_code (uuid) em menu_sections, products,
--      addon_groups e addon_items + backfill (quem não tem código ganha
--      um) + índice único parcial (store_id, network_code). A cópia
--      passa a casar POR CÓDIGO, nunca por nome+preço.
--   2. products.last_synced_price: o preço que a cópia tinha logo após o
--      último sync vindo da matriz. É ele que distingue "preço próprio"
--      (o dono mudou o preço depois do sync → o re-sync NUNCA sobrescreve
--      sem aviso) de "desatualizado" (a matriz mudou o preço depois do
--      sync → o re-sync atualiza). Cópia sem registro de sync (caso
--      legado, quase inalcançável — o clone novo sempre grava o preço)
--      é tratada como desatualizada, e o painel mostra a divergência
--      antes de sincronizar.
--   3. clone_menu_from_matriz REESCRITO: mesmas travas de permissão,
--      colunas atuais, idempotente por código (não duplica), devolve as
--      chaves que o painel lê (categories_copied/products_copied) + as
--      chaves legadas (sections/products/addon_groups).
--   4. resync_menu_from_matriz (novo): insere o que é novo na matriz,
--      atualiza o que existe (nome, descrição, imagem, disponibilidade,
--      ordem, seção; preço só pela regra acima, salvo _overwrite_price),
--      e apenas REPORTA o que sumiu da matriz (nunca apaga na subloja).
--   5. network_menu_divergence (novo): lista por produto o status
--      ok | preco_proprio | desatualizado | novo_na_matriz |
--      removido_na_matriz + os campos não-preço que divergiram.
--
-- NÃO herda (próprio da subloja, por decisão do plano): endereço,
-- horário, taxa/área de entrega, motoboys, e os campos de promo/PDV
-- do produto (promo_price, pdv_short_code, metadata etc.) — a cópia e
-- o re-sync copiam só o cardápio base (nome, descrição, preço, imagem,
-- disponibilidade, ordem, seção, adicionais).
-- Cópias feitas pelo clone ANTIGO ganharam códigos próprios no backfill
-- (sem vínculo com a matriz) — elas NÃO re-sincronizam; só as cópias
-- feitas pelo clone novo entram no sync. Maristela tem 0 produtos, então
-- nenhum dado real é afetado por isso.
--
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança
-- (Fase 4) nem na vitrine agrupada (Fase 5).

-- ---------------------------------------------------------------------------
-- 1. Código estável + preço do último sync
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'menu_sections' AND column_name = 'network_code') THEN
    ALTER TABLE public.menu_sections ADD COLUMN network_code uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'network_code') THEN
    ALTER TABLE public.products ADD COLUMN network_code uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'last_synced_price') THEN
    ALTER TABLE public.products ADD COLUMN last_synced_price numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'addon_groups' AND column_name = 'network_code') THEN
    ALTER TABLE public.addon_groups ADD COLUMN network_code uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'addon_items' AND column_name = 'network_code') THEN
    ALTER TABLE public.addon_items ADD COLUMN network_code uuid;
  END IF;
END $$;

-- Backfill: todo item sem código ganha um código próprio. Cópias antigas
-- NÃO são vinculadas à matriz aqui (não há como saber com certeza qual
-- era a origem — o mapa antigo era por nome+preço).
UPDATE public.menu_sections SET network_code = gen_random_uuid() WHERE network_code IS NULL;
UPDATE public.products SET network_code = gen_random_uuid() WHERE network_code IS NULL;
UPDATE public.addon_groups SET network_code = gen_random_uuid() WHERE network_code IS NULL;
UPDATE public.addon_items SET network_code = gen_random_uuid() WHERE network_code IS NULL;

-- Um código, uma cópia por loja: o clone nunca mais duplica.
CREATE UNIQUE INDEX IF NOT EXISTS menu_sections_store_network_code_uniq
  ON public.menu_sections (store_id, network_code) WHERE network_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_store_network_code_uniq
  ON public.products (store_id, network_code) WHERE network_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS addon_groups_store_network_code_uniq
  ON public.addon_groups (store_id, network_code) WHERE network_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS addon_items_group_network_code_uniq
  ON public.addon_items (group_id, network_code) WHERE network_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. clone_menu_from_matriz — REESCRITO (mesma assinatura, mesmo retorno
--    jsonb: CREATE OR REPLACE basta, sem DROP)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clone_menu_from_matriz(_source_store_id uuid, _target_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _src record;
  _tgt record;
  _src_products int := 0;
  _sections int := 0;
  _products int := 0;
  _products_skipped int := 0;
  _addon_groups int := 0;
  _addon_items int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;

  SELECT * INTO _src FROM public.stores WHERE id = _source_store_id;
  SELECT * INTO _tgt FROM public.stores WHERE id = _target_store_id;
  IF _src.id IS NULL OR _tgt.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.'; END IF;

  IF _src.network_id IS NULL OR _src.network_id <> _tgt.network_id THEN
    RAISE EXCEPTION 'Lojas não pertencem à mesma rede.';
  END IF;
  IF _tgt.owner_id <> _uid AND NOT EXISTS (
    SELECT 1 FROM public.store_networks n WHERE n.id = _tgt.network_id AND n.owner_id = _uid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para clonar nesta unidade.';
  END IF;

  -- A fonte precisa ter código em tudo antes de mapear por código.
  UPDATE public.menu_sections SET network_code = gen_random_uuid() WHERE store_id = _source_store_id AND network_code IS NULL;
  UPDATE public.products SET network_code = gen_random_uuid() WHERE store_id = _source_store_id AND network_code IS NULL;
  UPDATE public.addon_groups SET network_code = gen_random_uuid() WHERE store_id = _source_store_id AND network_code IS NULL;
  UPDATE public.addon_items SET network_code = gen_random_uuid() WHERE group_id IN (SELECT id FROM public.addon_groups WHERE store_id = _source_store_id) AND network_code IS NULL;

  -- Seções: insere só as que faltam (por código); o mapa cobre todas.
  CREATE TEMP TABLE _sec_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.menu_sections (store_id, name, sort_order, network_code)
    SELECT _target_store_id, s.name, s.sort_order, s.network_code
    FROM public.menu_sections s
    WHERE s.store_id = _source_store_id
      AND NOT EXISTS (SELECT 1 FROM public.menu_sections t WHERE t.store_id = _target_store_id AND t.network_code = s.network_code)
    RETURNING id
  )
  INSERT INTO _sec_new SELECT id FROM ins;
  GET DIAGNOSTICS _sections = ROW_COUNT;

  CREATE TEMP TABLE _sec_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO _sec_map(old_id, new_id)
  SELECT s.id, t.id
  FROM public.menu_sections s
  JOIN public.menu_sections t ON t.store_id = _target_store_id AND t.network_code = s.network_code
  WHERE s.store_id = _source_store_id;

  -- Produtos: insere só os que faltam (por código). O preço copiado já
  -- nasce como "último sync" (base da regra de preço próprio).
  SELECT COUNT(*) INTO _src_products FROM public.products WHERE store_id = _source_store_id;
  CREATE TEMP TABLE _prod_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.products (store_id, section_id, name, description, price, image_url, is_available, sort_order, network_code, last_synced_price)
    SELECT _target_store_id,
           (SELECT new_id FROM _sec_map WHERE old_id = s.section_id),
           s.name, s.description, s.price, s.image_url, s.is_available, s.sort_order, s.network_code, s.price
    FROM public.products s
    WHERE s.store_id = _source_store_id
      AND NOT EXISTS (SELECT 1 FROM public.products t WHERE t.store_id = _target_store_id AND t.network_code = s.network_code)
    RETURNING id
  )
  INSERT INTO _prod_new SELECT id FROM ins;
  GET DIAGNOSTICS _products = ROW_COUNT;
  _products_skipped := _src_products - _products;

  CREATE TEMP TABLE _prod_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO _prod_map(old_id, new_id)
  SELECT s.id, t.id
  FROM public.products s
  JOIN public.products t ON t.store_id = _target_store_id AND t.network_code = s.network_code
  WHERE s.store_id = _source_store_id;

  -- Grupos de adicionais: insere só os que faltam (por código). Grupo
  -- ligado a um produto da fonte passa a apontar para a CÓPIA do produto.
  CREATE TEMP TABLE _ag_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.addon_groups (store_id, product_id, name, min_select, max_select, sort_order, price_replaces_base, network_code)
    SELECT _target_store_id,
           (SELECT new_id FROM _prod_map WHERE old_id = g.product_id),
           g.name, g.min_select, g.max_select, g.sort_order, g.price_replaces_base, g.network_code
    FROM public.addon_groups g
    WHERE g.store_id = _source_store_id
      AND NOT EXISTS (SELECT 1 FROM public.addon_groups t WHERE t.store_id = _target_store_id AND t.network_code = g.network_code)
    RETURNING id
  )
  INSERT INTO _ag_new SELECT id FROM ins;
  GET DIAGNOSTICS _addon_groups = ROW_COUNT;

  CREATE TEMP TABLE _ag_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO _ag_map(old_id, new_id)
  SELECT g.id, t.id
  FROM public.addon_groups g
  JOIN public.addon_groups t ON t.store_id = _target_store_id AND t.network_code = g.network_code
  WHERE g.store_id = _source_store_id;

  -- Itens de adicionais: insere só os que faltam (por código, no grupo).
  CREATE TEMP TABLE _ai_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.addon_items (group_id, name, price, sort_order, network_code)
    SELECT (SELECT new_id FROM _ag_map WHERE old_id = ai.group_id),
           ai.name, ai.price, ai.sort_order, ai.network_code
    FROM public.addon_items ai
    WHERE ai.group_id IN (SELECT old_id FROM _ag_map)
      AND NOT EXISTS (SELECT 1 FROM public.addon_items t WHERE t.group_id = (SELECT new_id FROM _ag_map WHERE old_id = ai.group_id) AND t.network_code = ai.network_code)
    RETURNING id
  )
  INSERT INTO _ai_new SELECT id FROM ins;
  GET DIAGNOSTICS _addon_items = ROW_COUNT;

  -- Vínculos produto↔grupo: insere só os que faltam.
  INSERT INTO public.product_addon_groups (product_id, addon_group_id)
  SELECT (SELECT new_id FROM _prod_map WHERE old_id = pag.product_id),
         (SELECT new_id FROM _ag_map WHERE old_id = pag.addon_group_id)
  FROM public.product_addon_groups pag
  WHERE pag.product_id IN (SELECT old_id FROM _prod_map)
    AND pag.addon_group_id IN (SELECT old_id FROM _ag_map)
    AND NOT EXISTS (
      SELECT 1 FROM public.product_addon_groups t
      WHERE t.product_id = (SELECT new_id FROM _prod_map WHERE old_id = pag.product_id)
        AND t.addon_group_id = (SELECT new_id FROM _ag_map WHERE old_id = pag.addon_group_id)
    );

  -- Chaves novas (as que o painel lê) + chaves legadas (compatibilidade).
  RETURN jsonb_build_object(
    'categories_copied', _sections,
    'products_copied', _products,
    'products_skipped', _products_skipped,
    'addon_groups_copied', _addon_groups,
    'addon_items_copied', _addon_items,
    'sections', _sections,
    'products', _products,
    'addon_groups', _addon_groups
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. resync_menu_from_matriz — NOVO
--    Sincroniza a subloja com a matriz: insere o que é novo, atualiza o
--    que existe (preço só pela regra do last_synced_price, salvo
--    _overwrite_price), e apenas CONTA o que sumiu da matriz (nunca
--    apaga na subloja — o dono decide).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resync_menu_from_matriz(_source_store_id uuid, _target_store_id uuid, _overwrite_price boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _src record;
  _tgt record;
  _sec_new int := 0;
  _sec_upd int := 0;
  _prod_new int := 0;
  _prod_upd int := 0;
  _price_synced int := 0;
  _price_skipped int := 0;
  _price_overwritten int := 0;
  _ag_new int := 0;
  _ag_upd int := 0;
  _ai_new int := 0;
  _ai_upd int := 0;
  _removed int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;

  SELECT * INTO _src FROM public.stores WHERE id = _source_store_id;
  SELECT * INTO _tgt FROM public.stores WHERE id = _target_store_id;
  IF _src.id IS NULL OR _tgt.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.'; END IF;

  IF _src.network_id IS NULL OR _src.network_id <> _tgt.network_id THEN
    RAISE EXCEPTION 'Lojas não pertencem à mesma rede.';
  END IF;
  IF _tgt.owner_id <> _uid AND NOT EXISTS (
    SELECT 1 FROM public.store_networks n WHERE n.id = _tgt.network_id AND n.owner_id = _uid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar nesta unidade.';
  END IF;

  UPDATE public.menu_sections SET network_code = gen_random_uuid() WHERE store_id = _source_store_id AND network_code IS NULL;
  UPDATE public.products SET network_code = gen_random_uuid() WHERE store_id = _source_store_id AND network_code IS NULL;
  UPDATE public.addon_groups SET network_code = gen_random_uuid() WHERE store_id = _source_store_id AND network_code IS NULL;
  UPDATE public.addon_items SET network_code = gen_random_uuid() WHERE group_id IN (SELECT id FROM public.addon_groups WHERE store_id = _source_store_id) AND network_code IS NULL;

  -- Seções: novas + atualização das existentes (só quem realmente mudou).
  CREATE TEMP TABLE _sec_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.menu_sections (store_id, name, sort_order, network_code)
    SELECT _target_store_id, s.name, s.sort_order, s.network_code
    FROM public.menu_sections s
    WHERE s.store_id = _source_store_id
      AND NOT EXISTS (SELECT 1 FROM public.menu_sections t WHERE t.store_id = _target_store_id AND t.network_code = s.network_code)
    RETURNING id
  )
  INSERT INTO _sec_new SELECT id FROM ins;
  GET DIAGNOSTICS _sec_new = ROW_COUNT;

  UPDATE public.menu_sections t SET name = s.name, sort_order = s.sort_order
  FROM public.menu_sections s
  WHERE s.store_id = _source_store_id AND t.store_id = _target_store_id AND t.network_code = s.network_code
    AND (t.name IS DISTINCT FROM s.name OR t.sort_order IS DISTINCT FROM s.sort_order);
  GET DIAGNOSTICS _sec_upd = ROW_COUNT;

  CREATE TEMP TABLE _sec_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO _sec_map(old_id, new_id)
  SELECT s.id, t.id
  FROM public.menu_sections s
  JOIN public.menu_sections t ON t.store_id = _target_store_id AND t.network_code = s.network_code
  WHERE s.store_id = _source_store_id;

  -- Produtos novos.
  CREATE TEMP TABLE _prod_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.products (store_id, section_id, name, description, price, image_url, is_available, sort_order, network_code, last_synced_price)
    SELECT _target_store_id,
           (SELECT new_id FROM _sec_map WHERE old_id = s.section_id),
           s.name, s.description, s.price, s.image_url, s.is_available, s.sort_order, s.network_code, s.price
    FROM public.products s
    WHERE s.store_id = _source_store_id
      AND NOT EXISTS (SELECT 1 FROM public.products t WHERE t.store_id = _target_store_id AND t.network_code = s.network_code)
    RETURNING id
  )
  INSERT INTO _prod_new SELECT id FROM ins;
  GET DIAGNOSTICS _prod_new = ROW_COUNT;

  CREATE TEMP TABLE _prod_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO _prod_map(old_id, new_id)
  SELECT s.id, t.id
  FROM public.products s
  JOIN public.products t ON t.store_id = _target_store_id AND t.network_code = s.network_code
  WHERE s.store_id = _source_store_id;

  -- Produtos existentes: campos não-preço (só quem realmente mudou).
  UPDATE public.products t SET
    name = s.name, description = s.description, image_url = s.image_url,
    is_available = s.is_available, sort_order = s.sort_order,
    section_id = (SELECT new_id FROM _sec_map WHERE old_id = s.section_id)
  FROM public.products s
  WHERE s.store_id = _source_store_id AND t.store_id = _target_store_id AND t.network_code = s.network_code
    AND (t.name IS DISTINCT FROM s.name OR t.description IS DISTINCT FROM s.description
      OR t.image_url IS DISTINCT FROM s.image_url OR t.is_available IS DISTINCT FROM s.is_available
      OR t.sort_order IS DISTINCT FROM s.sort_order
      OR t.section_id IS DISTINCT FROM (SELECT new_id FROM _sec_map WHERE old_id = s.section_id));
  GET DIAGNOSTICS _prod_upd = ROW_COUNT;

  -- Preço sincronizável: igual ao último sync (ou sem registro) e
  -- diferente do preço atual da matriz → a matriz mudou, atualiza.
  UPDATE public.products t SET price = s.price, last_synced_price = s.price
  FROM public.products s
  WHERE s.store_id = _source_store_id AND t.store_id = _target_store_id AND t.network_code = s.network_code
    AND (t.last_synced_price IS NULL OR t.price = t.last_synced_price)
    AND t.price IS DISTINCT FROM s.price;
  GET DIAGNOSTICS _price_synced = ROW_COUNT;

  -- Preço próprio: diferente do último sync (não-nulo) → o dono mudou.
  IF _overwrite_price THEN
    UPDATE public.products t SET price = s.price, last_synced_price = s.price
    FROM public.products s
    WHERE s.store_id = _source_store_id AND t.store_id = _target_store_id AND t.network_code = s.network_code
      AND t.last_synced_price IS NOT NULL AND t.price <> t.last_synced_price
      AND t.price IS DISTINCT FROM s.price;
    GET DIAGNOSTICS _price_overwritten = ROW_COUNT;
  ELSE
    SELECT COUNT(*) INTO _price_skipped
    FROM public.products t
    JOIN public.products s ON s.store_id = _source_store_id AND s.network_code = t.network_code
    WHERE t.store_id = _target_store_id
      AND t.last_synced_price IS NOT NULL AND t.price <> t.last_synced_price
      AND t.price IS DISTINCT FROM s.price;
  END IF;

  -- Grupos de adicionais: novos + atualização dos existentes.
  CREATE TEMP TABLE _ag_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.addon_groups (store_id, product_id, name, min_select, max_select, sort_order, price_replaces_base, network_code)
    SELECT _target_store_id,
           (SELECT new_id FROM _prod_map WHERE old_id = g.product_id),
           g.name, g.min_select, g.max_select, g.sort_order, g.price_replaces_base, g.network_code
    FROM public.addon_groups g
    WHERE g.store_id = _source_store_id
      AND NOT EXISTS (SELECT 1 FROM public.addon_groups t WHERE t.store_id = _target_store_id AND t.network_code = g.network_code)
    RETURNING id
  )
  INSERT INTO _ag_new SELECT id FROM ins;
  GET DIAGNOSTICS _ag_new = ROW_COUNT;

  UPDATE public.addon_groups t SET
    product_id = (SELECT new_id FROM _prod_map WHERE old_id = s.product_id),
    name = s.name, min_select = s.min_select, max_select = s.max_select,
    sort_order = s.sort_order, price_replaces_base = s.price_replaces_base
  FROM public.addon_groups s
  WHERE s.store_id = _source_store_id AND t.store_id = _target_store_id AND t.network_code = s.network_code
    AND (t.product_id IS DISTINCT FROM (SELECT new_id FROM _prod_map WHERE old_id = s.product_id)
      OR t.name IS DISTINCT FROM s.name OR t.min_select IS DISTINCT FROM s.min_select
      OR t.max_select IS DISTINCT FROM s.max_select OR t.sort_order IS DISTINCT FROM s.sort_order
      OR t.price_replaces_base IS DISTINCT FROM s.price_replaces_base);
  GET DIAGNOSTICS _ag_upd = ROW_COUNT;

  CREATE TEMP TABLE _ag_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO _ag_map(old_id, new_id)
  SELECT g.id, t.id
  FROM public.addon_groups g
  JOIN public.addon_groups t ON t.store_id = _target_store_id AND t.network_code = g.network_code
  WHERE g.store_id = _source_store_id;

  -- Itens de adicionais: novos + atualização dos existentes.
  -- (Preço de adicional segue a matriz no sync — a proteção de preço
  -- próprio do plano vale para o produto; documentado no cabeçalho.)
  CREATE TEMP TABLE _ai_new(id uuid) ON COMMIT DROP;
  WITH ins AS (
    INSERT INTO public.addon_items (group_id, name, price, sort_order, network_code)
    SELECT (SELECT new_id FROM _ag_map WHERE old_id = ai.group_id),
           ai.name, ai.price, ai.sort_order, ai.network_code
    FROM public.addon_items ai
    WHERE ai.group_id IN (SELECT old_id FROM _ag_map)
      AND NOT EXISTS (SELECT 1 FROM public.addon_items t WHERE t.group_id = (SELECT new_id FROM _ag_map WHERE old_id = ai.group_id) AND t.network_code = ai.network_code)
    RETURNING id
  )
  INSERT INTO _ai_new SELECT id FROM ins;
  GET DIAGNOSTICS _ai_new = ROW_COUNT;

  UPDATE public.addon_items t SET name = s.name, price = s.price, sort_order = s.sort_order
  FROM public.addon_items s
  WHERE s.group_id IN (SELECT old_id FROM _ag_map)
    AND t.group_id = (SELECT new_id FROM _ag_map WHERE old_id = s.group_id)
    AND t.network_code = s.network_code
    AND (t.name IS DISTINCT FROM s.name OR t.price IS DISTINCT FROM s.price OR t.sort_order IS DISTINCT FROM s.sort_order);
  GET DIAGNOSTICS _ai_upd = ROW_COUNT;

  -- Vínculos produto↔grupo: insere só os que faltam.
  INSERT INTO public.product_addon_groups (product_id, addon_group_id)
  SELECT (SELECT new_id FROM _prod_map WHERE old_id = pag.product_id),
         (SELECT new_id FROM _ag_map WHERE old_id = pag.addon_group_id)
  FROM public.product_addon_groups pag
  WHERE pag.product_id IN (SELECT old_id FROM _prod_map)
    AND pag.addon_group_id IN (SELECT old_id FROM _ag_map)
    AND NOT EXISTS (
      SELECT 1 FROM public.product_addon_groups t
      WHERE t.product_id = (SELECT new_id FROM _prod_map WHERE old_id = pag.product_id)
        AND t.addon_group_id = (SELECT new_id FROM _ag_map WHERE old_id = pag.addon_group_id)
    );

  -- Sumiu da matriz: só cópias herdadas (last_synced_price setado).
  -- Produto próprio da subloja (nunca herdado) NÃO entra aqui.
  SELECT COUNT(*) INTO _removed
  FROM public.products t
  WHERE t.store_id = _target_store_id AND t.last_synced_price IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.products s WHERE s.store_id = _source_store_id AND s.network_code = t.network_code);

  RETURN jsonb_build_object(
    'categories_copied', _sec_new,
    'categories_updated', _sec_upd,
    'products_copied', _prod_new,
    'products_updated', _prod_upd,
    'products_price_synced', _price_synced,
    'products_price_skipped', _price_skipped,
    'products_price_overwritten', _price_overwritten,
    'addon_groups_copied', _ag_new,
    'addon_groups_updated', _ag_upd,
    'addon_items_copied', _ai_new,
    'addon_items_updated', _ai_upd,
    'products_removed_from_matriz', _removed
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. network_menu_divergence — NOVO (só leitura: o que divergiu entre a
--    matriz e a subloja, por produto)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.network_menu_divergence(_source_store_id uuid, _target_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _src record;
  _tgt record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;

  SELECT * INTO _src FROM public.stores WHERE id = _source_store_id;
  SELECT * INTO _tgt FROM public.stores WHERE id = _target_store_id;
  IF _src.id IS NULL OR _tgt.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.'; END IF;

  IF _src.network_id IS NULL OR _src.network_id <> _tgt.network_id THEN
    RAISE EXCEPTION 'Lojas não pertencem à mesma rede.';
  END IF;
  IF _tgt.owner_id <> _uid AND NOT EXISTS (
    SELECT 1 FROM public.store_networks n WHERE n.id = _tgt.network_id AND n.owner_id = _uid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver esta unidade.';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        s.network_code,
        s.name AS product_name,
        s.price AS matriz_price,
        t.price AS subloja_price,
        t.last_synced_price,
        CASE
          WHEN t.id IS NULL THEN 'novo_na_matriz'
          WHEN t.price IS DISTINCT FROM s.price AND t.last_synced_price IS NOT NULL AND t.price <> t.last_synced_price THEN 'preco_proprio'
          WHEN t.price IS DISTINCT FROM s.price THEN 'desatualizado'
          ELSE 'ok'
        END AS price_status,
        CASE
          WHEN t.id IS NULL THEN '[]'::jsonb
          ELSE COALESCE((
            SELECT jsonb_agg(fname) FROM (
              VALUES
                ('name', t.name IS DISTINCT FROM s.name),
                ('description', t.description IS DISTINCT FROM s.description),
                ('image_url', t.image_url IS DISTINCT FROM s.image_url),
                ('is_available', t.is_available IS DISTINCT FROM s.is_available),
                ('section', (SELECT network_code FROM public.menu_sections WHERE id = t.section_id) IS DISTINCT FROM (SELECT network_code FROM public.menu_sections WHERE id = s.section_id))
            ) AS v(fname, diff) WHERE diff
          ), '[]'::jsonb)
        END AS changed_fields
      FROM public.products s
      LEFT JOIN public.products t ON t.store_id = _target_store_id AND t.network_code = s.network_code
      WHERE s.store_id = _source_store_id
    ),
    refined AS (
      SELECT *,
        CASE
          WHEN price_status = 'ok' AND jsonb_array_length(COALESCE(changed_fields, '[]'::jsonb)) > 0 THEN 'divergente'
          ELSE price_status
        END AS status
      FROM base
    ),
    removed AS (
      SELECT t.network_code, t.name AS product_name,
        NULL::numeric AS matriz_price, t.price AS subloja_price, t.last_synced_price,
        'removido_na_matriz' AS status, '[]'::jsonb AS changed_fields
      FROM public.products t
      WHERE t.store_id = _target_store_id AND t.last_synced_price IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.products s WHERE s.store_id = _source_store_id AND s.network_code = t.network_code)
    ),
    all_items AS (SELECT * FROM refined UNION ALL SELECT * FROM removed)
    SELECT jsonb_build_object(
      'source_store_id', _source_store_id,
      'target_store_id', _target_store_id,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'network_code', network_code,
          'product_name', product_name,
          'matriz_price', matriz_price,
          'subloja_price', subloja_price,
          'last_synced_price', last_synced_price,
          'status', status,
          'changed_fields', COALESCE(changed_fields, '[]'::jsonb)
        ) ORDER BY product_name)
        FROM all_items
      ), '[]'::jsonb)
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Grants (padrão Fase 1/2: nada para anon; autenticado + service_role)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.clone_menu_from_matriz(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_menu_from_matriz(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.resync_menu_from_matriz(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resync_menu_from_matriz(uuid, uuid, boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.network_menu_divergence(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_menu_divergence(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. create_network_unit COM auto-clone (Fase 3 — decisão do Renner
--    28/10: a subloja nasce com a cópia do cardápio da matriz).
--    Redefinição da função da Fase 2 (141000), idêntica, mais o passo
--    final: copiar o cardápio da loja-matriz (guia) para a unidade nova.
--    Regras do auto-clone:
--      (a) NÃO publica: o clone não toca is_draft/is_visible/status —
--          a subloja continua rascunho/invisível até o dono publicar
--          com o checklist completo (publish_network_unit).
--      (b) NÃO falha a criação: sem guia na rede, pula o clone; guia
--          sem cardápio, o clone devolve 0/0 sem erro (fonte vazia =
--          0 linhas, nenhuma exceção). O clone só levanta erro para
--          loja inexistente, rede diferente ou sem permissão —
--          impossíveis aqui (guia e unidade são da mesma rede e do
--          mesmo dono, ambos existem, chamador autenticado).
--      (c) Idempotente: o clone casa por network_code — rodar de novo
--          não duplica nada.
--      (d) O sync manual pelo botão continua existindo (o auto-clone
--          não o substitui): é ele que cobre as mudanças depois.
--    Ordem: esta seção vem DEPOIS da definição do clone (seção 2) —
--    o CREATE OR REPLACE abaixo referencia clone_menu_from_matriz.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_network_unit(_name text, _slug text, _category text, _address_street text DEFAULT NULL::text, _address_number text DEFAULT NULL::text, _address_neighborhood text DEFAULT NULL::text, _address_city text DEFAULT NULL::text, _address_state text DEFAULT NULL::text, _address_cep text DEFAULT NULL::text, _delivery_fee numeric DEFAULT NULL::numeric, _delivery_radius numeric DEFAULT NULL::numeric, _minimum_order_value numeric DEFAULT NULL::numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _network record;
  _store_id uuid;
  _unit_count int;
  _guide_store_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO _network FROM store_networks WHERE owner_id = _user_id LIMIT 1;
  IF _network IS NULL THEN
    RAISE EXCEPTION 'Você não é matriz de nenhuma rede.';
  END IF;

  -- M1 / decisão 4: o limite é de 10 SUBLOJAS — a matriz não entra na conta.
  SELECT COUNT(*) INTO _unit_count FROM stores WHERE network_id = _network.id AND NOT COALESCE(is_matriz, false);
  IF _unit_count >= _network.max_units THEN
    RAISE EXCEPTION 'Limite de % unidades atingido para esta rede.', _network.max_units;
  END IF;

  -- C9/M8: endereço completo é obrigatório — sem filial sem rua, número e
  -- bairro. O formulário antigo nem pedia esses campos.
  IF nullif(trim(coalesce(_address_street, '')), '') IS NULL
     OR nullif(trim(coalesce(_address_number, '')), '') IS NULL
     OR nullif(trim(coalesce(_address_neighborhood, '')), '') IS NULL
     OR nullif(trim(coalesce(_address_city, '')), '') IS NULL
     OR nullif(trim(coalesce(_address_cep, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Endereço incompleto: preencha rua, número, bairro, cidade e CEP.';
  END IF;

  -- Slug único, com erro legível (antes estourava a constraint crua).
  IF EXISTS (SELECT 1 FROM stores WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Já existe uma loja com este endereço (slug). Escolha outro slug.';
  END IF;

  -- C9: a subloja nasce RASCUNHO invisível — is_draft = true, is_visible =
  -- false, status = 'analise'. Fora da vitrine e sem vender, até o dono
  -- publicar com o checklist completo (publish_network_unit).
  INSERT INTO stores (
    name, slug, category, owner_id, network_id,
    address_street, address_number, address_neighborhood,
    address_city, address_state, address_cep,
    delivery_fee, delivery_radius, minimum_order_value,
    plan_type, status, delivery_mode, is_draft, is_visible
  ) VALUES (
    _name, _slug, _category::store_category, _user_id, _network.id,
    _address_street, _address_number, _address_neighborhood,
    _address_city, _address_state, _address_cep,
    _delivery_fee, _delivery_radius, _minimum_order_value,
    _network.plan_type, 'analise'::store_status, 'own', true, false
  ) RETURNING id INTO _store_id;

  -- Decisão 1: a subloja NÃO tem mensalidade própria — o plano nasce com
  -- monthly_fee = 0 e sem vencimento. A cobrança é 1 por rede (Fase 4);
  -- o plano de R$ 0 aqui só preserva a invariante "toda loja tem um plano
  -- ativo" sem nunca cobrar.
  INSERT INTO store_plans (store_id, plan_type, monthly_fee, is_active, next_billing_date)
  VALUES (
    _store_id,
    _network.plan_type::store_plan_type,
    0,
    true,
    NULL
  );

  -- Fase 3 — auto-clone: copia o cardápio da loja-matriz (guia, a mais
  -- antiga da rede) para a unidade nova. Sem guia, pula sem erro.
  SELECT id INTO _guide_store_id FROM public.stores
   WHERE network_id = _network.id AND COALESCE(is_matriz, false)
   ORDER BY created_at ASC LIMIT 1;
  IF _guide_store_id IS NOT NULL THEN
    PERFORM public.clone_menu_from_matriz(_guide_store_id, _store_id);
  END IF;

  RETURN _store_id;
END;
$function$;

-- Grants da função redefinida (CREATE OR REPLACE preserva, mas o padrão
-- do arquivo reaplica explicitamente).
REVOKE EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric) TO authenticated, service_role;
