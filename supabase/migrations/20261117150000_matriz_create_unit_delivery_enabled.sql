-- Item 1 (pós-E2E de matriz, 17/11/2026, palavra do Renner) — modo de
-- entrega na criação da unidade.
--
-- create_network_unit ganha o parâmetro opcional `_delivery_enabled
-- boolean DEFAULT false` NO FIM da lista e passa a gravar a coluna no
-- INSERT. Chamadas antigas (argumentos nomeados, sem o parâmetro —
-- painel antigo desroteado e qualquer outro chamador) seguem
-- funcionando e a unidade nasce como antes (só-retirada).
--
-- Semântica do flag (decisão documentada no plano, NÃO muda aqui):
-- `delivery_enabled` define se o checklist exige motoboy para publicar
-- e se a unidade aparece na busca sem motoboy online. Ele NÃO é um
-- interruptor de venda de entrega (checkout/trigger travam por
-- disponibilidade de motoboy, independente do flag). Transformá-lo em
-- interruptor real é outro item, de risco alto, fora deste escopo.
--
-- Como a assinatura muda, o DROP da assinatura antiga de 12 args é
-- obrigatório (mesmo padrão da migration Fase 2, 20261028141000) e os
-- grants são refeitos para a assinatura nova. Corpo idêntico ao da
-- migration 20261028190000 (fonte do auto-clone = subloja publicada
-- mais antiga), exceto o parâmetro novo e a coluna no INSERT.
-- NENHUMA loja existente é tocada (sem UPDATE/DELETE em stores).

DROP FUNCTION IF EXISTS public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.create_network_unit(_name text, _slug text, _category text, _address_street text DEFAULT NULL::text, _address_number text DEFAULT NULL::text, _address_neighborhood text DEFAULT NULL::text, _address_city text DEFAULT NULL::text, _address_state text DEFAULT NULL::text, _address_cep text DEFAULT NULL::text, _delivery_fee numeric DEFAULT NULL::numeric, _delivery_radius numeric DEFAULT NULL::numeric, _minimum_order_value numeric DEFAULT NULL::numeric, _delivery_enabled boolean DEFAULT false)
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
  -- Item 1: o modo de entrega escolhido no formulário (default false =
  -- só-retirada) é gravado aqui; NULL explícito conta como desligado,
  -- mesma semântica do checklist.
  INSERT INTO stores (
    name, slug, category, owner_id, network_id,
    address_street, address_number, address_neighborhood,
    address_city, address_state, address_cep,
    delivery_fee, delivery_radius, minimum_order_value,
    delivery_enabled,
    plan_type, status, delivery_mode, is_draft, is_visible
  ) VALUES (
    _name, _slug, _category::store_category, _user_id, _network.id,
    _address_street, _address_number, _address_neighborhood,
    _address_city, _address_state, _address_cep,
    _delivery_fee, _delivery_radius, _minimum_order_value,
    COALESCE(_delivery_enabled, false),
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

-- Grants da assinatura nova (DROP remove os antigos junto com a função).
REVOKE EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, boolean) TO authenticated, service_role;
