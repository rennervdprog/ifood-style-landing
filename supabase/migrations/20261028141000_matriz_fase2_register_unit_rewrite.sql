-- Fase 2 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- 1. register_as_matriz reescrita:
--    (a) A4 — virar matriz marca 1 LOJA SÓ (antes marcava TODAS as lojas do
--        dono). Novo parâmetro opcional `_matriz_store_id`: a loja escolhida
--        (o cadastro passa a loja que acabou de criar). Sem ele, a loja
--        mais recente do dono. Qualquer outra loja do dono que estivesse
--        marcada como matriz é desmarcada (subloja, is_matriz = false,
--        nunca é tocada).
--    (b) Risco residual da Fase 1 — o caminho anônimo (auth.uid() null, no
--        instante do cadastro) agora só vale para um usuário criado há no
--        máximo 30 minutos. Um anônimo com o UUID de uma vítima antiga não
--        consegue mais registrar rede para ela. O fluxo real de cadastro
--        chama esta função segundos depois do signUp, então não quebra.
--        O fechamento total (exigir sessão autenticada sempre) quebraria o
--        cadastro atual — fica como decisão futura do Renner, documentada.
-- 2. create_network_unit reescrita:
--    (a) C9/M8 — a subloja nasce RASCUNHO invisível (is_draft = true,
--        is_visible = false, status = 'analise') e sem vender. Só entra na
--        vitrine quando o dono publica com o checklist completo
--        (publish_network_unit, migration 20261028142000).
--    (b) Endereço completo é obrigatório no banco (rua, número, bairro,
--        cidade, CEP) — o formulário antigo nem pedia rua/número/bairro.
--    (c) Slug único conferido com erro legível (antes estourava a
--        constraint crua).
--    (d) Decisão 1 — a subloja NÃO tem mensalidade própria: o plano nasce
--        com monthly_fee = 0 e sem vencimento. A cobrança da rede (1
--        mensalidade por rede) é Fase 4; o plano de R$ 0 aqui só preserva
--        a invariante "toda loja tem um plano ativo" sem nunca cobrar.
--    (e) Novos parâmetros opcionais: taxa de entrega, raio e pedido mínimo.
--
-- As duas funções ganham parâmetro novo, então a assinatura antiga é
-- removida com DROP antes do CREATE (CREATE OR REPLACE não muda a
-- quantidade de argumentos). Os grants são refeitos para a nova assinatura.
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança.

-- ---------------------------------------------------------------------------
-- 1. register_as_matriz — 1 loja só (A4) + anônimo só até 30 min
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.register_as_matriz(text, uuid, text, text, numeric, numeric, numeric, integer);

CREATE OR REPLACE FUNCTION public.register_as_matriz(_network_name text, _user_id uuid DEFAULT NULL::uuid, _logo_url text DEFAULT NULL::text, _plan_type text DEFAULT 'fixed'::text, _monthly_fee numeric DEFAULT 90, _revenue_threshold numeric DEFAULT NULL::numeric, _upgrade_monthly_fee numeric DEFAULT NULL::numeric, _upgrade_trigger_months integer DEFAULT NULL::integer, _matriz_store_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _uid uuid := coalesce(_user_id, auth.uid());
  _network_id uuid;
  _store_id uuid;
  _user_created_at timestamptz;
begin
  if _uid is null then raise exception 'Não autenticado.'; end if;

  -- Fase 1: ninguém cria rede EM NOME de outro usuário — salvo o admin da
  -- plataforma, ou o instante do cadastro, em que auth.uid() ainda pode ser
  -- null (CadastroLojista passa o id explícito recém-criado). Sem isso, um
  -- autenticado poderia marcar as lojas de outra pessoa como matriz e mudar
  -- o cargo dela.
  if auth.uid() is not null
     and _user_id is not null
     and _user_id <> auth.uid()
     and not public.is_platform_admin(auth.uid()) then
    raise exception 'Você só pode criar uma rede para você mesmo.';
  end if;

  -- Fase 2: o caminho anônimo (auth.uid() null) só vale no instante do
  -- cadastro — o usuário precisa ter sido criado há no máximo 30 minutos.
  -- Sem isso, qualquer anônimo com o UUID de uma vítima antiga registraria
  -- uma rede para ela. O cadastro real chama esta função segundos depois
  -- do signUp, então o limite não quebra o fluxo.
  if auth.uid() is null then
    select created_at into _user_created_at from auth.users where id = _uid;
    if _user_created_at is null then
      raise exception 'Usuário não encontrado.';
    end if;
    if _user_created_at < now() - interval '30 minutes' then
      raise exception 'Sessão expirada. Entre novamente para criar a rede.';
    end if;
  end if;

  select id into _network_id from store_networks where owner_id = _uid limit 1;
  if _network_id is not null then return _network_id; end if;

  -- Decisão 5: a rede nasce APROVADA (igual a todo cadastro hoje).
  insert into store_networks (name, logo_url, owner_id, plan_type, monthly_fee, is_approved)
  values (_network_name, _logo_url, _uid, _plan_type, _monthly_fee, true)
  returning id into _network_id;

  -- Fase 2 (A4): virar matriz marca 1 LOJA SÓ.
  -- A escolhida (_matriz_store_id) precisa pertencer ao dono e não estar em
  -- outra rede. Sem ela, a loja mais recente do dono (no cadastro, a loja
  -- acabou de nascer — é ela).
  if _matriz_store_id is not null then
    select id into _store_id from stores
     where id = _matriz_store_id and owner_id = _uid and network_id is null;
    if _store_id is null then
      raise exception 'A loja-matriz escolhida não pertence a este usuário ou já está em outra rede.';
    end if;
  else
    select id into _store_id from stores
     where owner_id = _uid order by created_at desc limit 1;
  end if;

  -- Desmarca qualquer outra loja do dono que estivesse como matriz (resíduo
  -- do comportamento antigo, que marcava todas). Subloja (is_matriz = false)
  -- nunca é tocada aqui.
  update stores set is_matriz = false, network_id = null
   where owner_id = _uid and id is distinct from _store_id and coalesce(is_matriz, false);

  -- Marca a loja escolhida como MATRIZ GUIA (não vende).
  if _store_id is not null then
    update stores
       set network_id = _network_id,
           is_matriz = true
     where id = _store_id;
    update store_networks set matriz_store_id = _store_id where id = _network_id;
  end if;

  perform set_config('app.bypass_role_guard', '1', true);
  update profiles set role = 'lojista_matriz'::partner_role where user_id = _uid;
  perform set_config('app.bypass_role_guard', '0', true);

  if _revenue_threshold is not null and _store_id is not null then
    update store_plans set
      revenue_threshold = _revenue_threshold,
      upgrade_monthly_fee = _upgrade_monthly_fee,
      upgrade_trigger_months = _upgrade_trigger_months
    where store_id = _store_id and is_active = true;
  end if;

  return _network_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. create_network_unit — nasce rascunho (C9/M8), sem mensalidade (dec. 1)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_network_unit(text, text, text, text, text, text, text, text, text);

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

  RETURN _store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Grants (mesmo padrão da Fase 1)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.register_as_matriz(text, uuid, text, text, numeric, numeric, numeric, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_as_matriz(text, uuid, text, text, numeric, numeric, numeric, integer, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric) TO authenticated, service_role;
