-- Fase 3 (opção B, decisão do Renner 28/10) — fonte do clone = subloja nº 1.
--
-- O guia (matriz) NUNCA pode ter cardápio: as travas
-- trg_no_products_on_matriz / trg_no_menu_on_matriz bloqueiam INSERT de
-- produtos/seções em loja is_matriz=true, e guard_matriz_flag bloqueia
-- converter loja com produtos/pedidos em matriz. O auto-clone DO GUIA,
-- como estava, copiaria sempre 0 na prática. Esta migration NÃO relaxa
-- nenhuma dessas travas — muda a fonte.
--
--   network_menu_source — regra centralizada, num só lugar: devolve a
--     subloja publicada mais antiga da rede (não-matriz, não rascunho,
--     visível, não fechada, rede não pausada; desempate por id).
--     Sem nenhuma, devolve NULL (o clone pula sem erro).
--   create_network_unit — redefinido, idêntico ao da 170000, exceto o
--     passo final do auto-clone: clona da fonte resolvida, não do guia.
--     O sync manual (resync_menu_from_matriz + botão "Sincronizar
--     cardápio") passa a usar a mesma fonte resolvida no painel — as
--     funções de clone/re-sync/divergência recebem _source_store_id
--     explícito e NÃO mudam.
--
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança,
-- nem na vitrine agrupada (Fase 5).

-- ---------------------------------------------------------------------------
-- 1. network_menu_source — a fonte do cardápio da rede
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.network_menu_source(_network_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.id
    FROM public.stores s
    JOIN public.store_networks sn ON sn.id = s.network_id
   WHERE s.network_id = _network_id
     AND NOT COALESCE(s.is_matriz, false)
     AND NOT COALESCE(s.is_draft, false)
     AND COALESCE(s.is_visible, false)
     AND NOT COALESCE(s.force_closed, false)
     AND NOT COALESCE(sn.is_paused, false)
   ORDER BY s.created_at ASC, s.id ASC
   LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.network_menu_source(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_menu_source(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. create_network_unit — mesmo corpo da 170000, só o auto-clone muda
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
  _source_store_id uuid;
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

  -- Fase 3 (opção B, decisão do Renner 28/10) — auto-clone da FONTE: a
  -- subloja publicada mais antiga da rede (a que vende). O guia nunca
  -- tem cardápio (travas trg_no_products_on_matriz /
  -- trg_no_menu_on_matriz), então clonar dele copiaria sempre 0. Sem
  -- fonte, pula sem erro. A unidade nova nasce rascunho e nunca é
  -- fonte de si mesma (a regra de "publicada" a exclui).
  _source_store_id := public.network_menu_source(_network.id);
  IF _source_store_id IS NOT NULL THEN
    PERFORM public.clone_menu_from_matriz(_source_store_id, _store_id);
  END IF;

  RETURN _store_id;
END;
$function$;

-- Grants da função redefinida (CREATE OR REPLACE preserva, mas o padrão
-- do arquivo reaplica explicitamente).
REVOKE EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric) TO authenticated, service_role;
