-- Fase 1 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- Recria as funções do sistema de matriz no repositório, com
-- CREATE OR REPLACE, preservando o comportamento ao vivo onde já existe
-- (definições lidas com pg_get_functiondef em 28/10/2026) e aplicando
-- só as correções da Fase 1:
--
--   is_unit_manager          — passa a ler store_managers (nova fonte da
--                               verdade) MANTENDO a leitura do campo antigo
--                               profiles.unit_store_id durante a transição.
--   is_network_owner         — idêntica à ao vivo (já era segura: lê
--                               stores.owner_id via store_networks).
--   get_user_routing_context — idêntica à ao vivo (e à migration
--                               20260820124000, que já a versiona).
--   register_as_matriz       — mesma assinatura e fluxo; muda só:
--                               (a) a rede nasce APROVADA (decisão 5;
--                               antes nascia is_approved = false);
--                               (b) _user_id só pode ser outro usuário se
--                               quem chama for admin (ou se auth.uid() for
--                               null, caminho do cadastro — ver comentário);
--                               (c) plan_type 'pdv_only' passa a ser aceito
--                               (CHECK atualizado na migration 20261028130000,
--                               achado C6).
--                               NÃO corrige o achado A4 aqui (marca TODAS as
--                               lojas do dono como matriz): o plano manda
--                               corrigir isso na Fase 2 ("virar matriz marca
--                               1 loja só").
--   create_network_unit      — mesma assinatura e fluxo; muda só a contagem
--                               do limite (M1): conta SÓ as sublojas, sem a
--                               matriz — o teto real era 9, a decisão 4 diz
--                               10 sublojas.
--   link_unit_user           — reescrita com as validações do achado A9
--                               (usuário existe; não é dono de loja própria;
--                               não gerencia outra subloja; a subloja não
--                               tem gerente) + escreve em store_managers
--                               (nova fonte da verdade) e mantém a escrita
--                               legada no perfil durante a transição.
--   unlink_unit_user         — NOVA (achado A9: não existia desvincular).
--
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança.

-- ---------------------------------------------------------------------------
-- 1. is_unit_manager — lê store_managers, com fallback legado (transição)
-- ---------------------------------------------------------------------------
-- TRANSIÇÃO: a branch legada (profiles.unit_store_id) existe só para não
-- quebrar vínculos escritos antes da Fase 1 — o campo do perfil virou
-- só-leitura (migration 20261028131000) e nenhum vínculo novo nasce por
-- ele. Quando a Fase 2 migrar os vínculos para store_managers, remover a
-- branch legada e deixar só a consulta em store_managers.
CREATE OR REPLACE FUNCTION public.is_unit_manager(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.store_managers
    WHERE user_id = _user_id AND store_id = _store_id AND is_active
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND unit_store_id = _store_id
  );
$function$;

-- ---------------------------------------------------------------------------
-- 2. is_network_owner — idêntica à ao vivo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_network_owner(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    JOIN public.store_networks n ON n.id = s.network_id
    WHERE s.id = _store_id AND n.owner_id = _user_id
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3. get_user_routing_context — idêntica à ao vivo / migration 20260820124000
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_routing_context(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester uuid := auth.uid();
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário obrigatório.';
  END IF;

  IF _user_id <> v_requester AND NOT public.is_platform_admin(v_requester) THEN
    RAISE EXCEPTION 'Sem permissão para consultar este contexto.';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'adminRow', (SELECT jsonb_build_object('role', role)
                   FROM public.user_roles
                   WHERE user_id = _user_id AND role = 'admin'
                   LIMIT 1),
      'profile', (SELECT to_jsonb(p)
                  FROM (SELECT role, is_approved, network_id, unit_store_id
                        FROM public.profiles
                        WHERE user_id = _user_id
                        LIMIT 1) p),
      'ownedStore', (SELECT jsonb_build_object('id', id, 'slug', slug)
                     FROM public.stores
                     WHERE owner_id = _user_id
                     LIMIT 1),
      'matrizNetwork', (SELECT jsonb_build_object('id', id, 'is_approved', is_approved)
                        FROM public.store_networks
                        WHERE owner_id = _user_id
                        LIMIT 1),
      'driver', (SELECT jsonb_build_object('user_id', user_id, 'is_active', is_active)
                 FROM public.drivers
                 WHERE user_id = _user_id
                 LIMIT 1),
      'storeDriver', (SELECT jsonb_build_object('id', id)
                      FROM public.store_drivers
                      WHERE driver_user_id = _user_id
                      LIMIT 1),
      'reseller', (SELECT jsonb_build_object('id', id)
                   FROM public.resellers
                   WHERE user_id = _user_id
                   LIMIT 1),
      'storePlanType', (SELECT sp.plan_type
                        FROM public.store_plans sp
                        JOIN public.stores s ON s.id = sp.store_id
                        WHERE s.owner_id = _user_id
                          AND sp.is_active = true
                        LIMIT 1)
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. register_as_matriz — rede nasce aprovada (decisão 5) + trava _user_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_as_matriz(_network_name text, _user_id uuid DEFAULT NULL::uuid, _logo_url text DEFAULT NULL::text, _plan_type text DEFAULT 'fixed'::text, _monthly_fee numeric DEFAULT 90, _revenue_threshold numeric DEFAULT NULL::numeric, _upgrade_monthly_fee numeric DEFAULT NULL::numeric, _upgrade_trigger_months integer DEFAULT NULL::integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _uid uuid := coalesce(_user_id, auth.uid());
  _network_id uuid;
  _store_id uuid;
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

  select id into _network_id from store_networks where owner_id = _uid limit 1;
  if _network_id is not null then return _network_id; end if;

  -- Decisão 5: a rede nasce APROVADA (antes: is_approved = false).
  insert into store_networks (name, logo_url, owner_id, plan_type, monthly_fee, is_approved)
  values (_network_name, _logo_url, _uid, _plan_type, _monthly_fee, true)
  returning id into _network_id;

  -- Marca a loja criada na mesma sessão como MATRIZ GUIA (não vende)
  -- NOTA (achado A4, fica para a Fase 2): hoje marca TODAS as lojas do dono,
  -- sem escolher qual. A Fase 2 muda para marcar 1 loja só (a escolhida).
  update stores
     set network_id = _network_id,
         is_matriz = true
   where owner_id = _uid
   returning id into _store_id;

  -- Vincula matriz_store_id na rede
  if _store_id is not null then
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
-- 5. create_network_unit — limite conta só sublojas (M1 / decisão 4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_network_unit(_name text, _slug text, _category text, _address_street text DEFAULT NULL::text, _address_number text DEFAULT NULL::text, _address_neighborhood text DEFAULT NULL::text, _address_city text DEFAULT NULL::text, _address_state text DEFAULT NULL::text, _address_cep text DEFAULT NULL::text)
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

  -- M1 / decisão 4: o limite é de 10 SUBLOJAS — a matriz não entra na conta
  -- (antes contava a matriz junto e o teto real era 9).
  SELECT COUNT(*) INTO _unit_count FROM stores WHERE network_id = _network.id AND NOT COALESCE(is_matriz, false);
  IF _unit_count >= _network.max_units THEN
    RAISE EXCEPTION 'Limite de % unidades atingido para esta rede.', _network.max_units;
  END IF;

  INSERT INTO stores (
    name, slug, category, owner_id, network_id,
    address_street, address_number, address_neighborhood,
    address_city, address_state, address_cep,
    status, delivery_mode
  ) VALUES (
    _name, _slug, _category::store_category, _user_id, _network.id,
    _address_street, _address_number, _address_neighborhood,
    _address_city, _address_state, _address_cep,
    CASE WHEN _network.is_approved THEN 'ativo'::store_status ELSE 'analise'::store_status END,
    'own'
  ) RETURNING id INTO _store_id;

  INSERT INTO store_plans (store_id, plan_type, monthly_fee, is_active, next_billing_date)
  VALUES (
    _store_id,
    _network.plan_type::store_plan_type,
    _network.monthly_fee,
    true,
    now() + interval '30 days'
  );

  RETURN _store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. link_unit_user — com validações (A9) + escrita em store_managers
-- ---------------------------------------------------------------------------
-- Só o dono da rede da loja ou o admin da plataforma vinculam gerente.
-- Valida: usuário existe; não é dono de loja própria (vincular rebaixaria
-- ele e deixaria a loja dele órfã); não gerencia outra subloja; a subloja
-- não tem gerente ativo. Escreve o vínculo em store_managers (fonte da
-- verdade) e mantém a escrita legada no perfil durante a transição.
CREATE OR REPLACE FUNCTION public.link_unit_user(_user_email text, _store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _target_user_id uuid;
  _store record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  -- Verificar que a loja pertence a uma rede (e quem pode mexer nela)
  SELECT s.* INTO _store FROM stores s
  JOIN store_networks sn ON sn.id = s.network_id
  WHERE s.id = _store_id;

  IF _store IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada em nenhuma rede.';
  END IF;

  IF _store.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem vincular gerente a esta loja.';
  END IF;

  -- A subloja precisa ser subloja (não a matriz-guia, que não vende).
  IF COALESCE(_store.is_matriz, false) THEN
    RAISE EXCEPTION 'A loja-matriz não tem gerente de unidade.';
  END IF;

  -- Buscar usuário pelo email
  SELECT id INTO _target_user_id FROM auth.users WHERE lower(email) = lower(_user_email) LIMIT 1;
  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com este email não foi encontrado. Peça para a pessoa se cadastrar primeiro.';
  END IF;

  -- A9: não rebaixar quem já é dono de loja própria.
  IF EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _target_user_id) THEN
    RAISE EXCEPTION 'Este usuário já é dono de uma loja própria e não pode virar gerente de unidade.';
  END IF;

  -- A9: um gerente não pode estar em duas filiais ao mesmo tempo.
  IF EXISTS (SELECT 1 FROM public.store_managers WHERE user_id = _target_user_id AND is_active) THEN
    RAISE EXCEPTION 'Este usuário já é gerente de outra subloja.';
  END IF;

  -- A9: 1 gerente por subloja.
  IF EXISTS (SELECT 1 FROM public.store_managers WHERE store_id = _store_id AND is_active) THEN
    RAISE EXCEPTION 'Esta subloja já tem um gerente vinculado. Desvincule-o antes de vincular outro.';
  END IF;

  -- Vínculo novo (fonte da verdade) + escrita legada no perfil (transição).
  INSERT INTO public.store_managers (store_id, user_id, linked_by, role, is_active)
  VALUES (_store_id, _target_user_id, _caller_id, 'manager', true);

  UPDATE profiles SET
    role = 'lojista_unidade'::partner_role,
    unit_store_id = _store_id,
    network_id = _store.network_id
  WHERE user_id = _target_user_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. unlink_unit_user — NOVA (A9: não existia desvincular)
-- ---------------------------------------------------------------------------
-- Desvincula o gerente da subloja: desativa o vínculo em store_managers,
-- limpa o vínculo legado no perfil e devolve o cargo de usuário comum
-- ('lojista' se ele tem loja própria, 'cliente' caso contrário).
-- Só o dono da rede da loja ou o admin da plataforma desvinculam.
CREATE OR REPLACE FUNCTION public.unlink_unit_user(_store_id uuid, _user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _manager_id uuid := _user_id;
  _store record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT s.* INTO _store FROM stores s
  JOIN store_networks sn ON sn.id = s.network_id
  WHERE s.id = _store_id;

  IF _store IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada em nenhuma rede.';
  END IF;

  IF _store.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem desvincular gerente desta loja.';
  END IF;

  IF _manager_id IS NULL THEN
    SELECT user_id INTO _manager_id FROM public.store_managers
    WHERE store_id = _store_id AND is_active LIMIT 1;
  END IF;

  IF _manager_id IS NULL THEN
    RAISE EXCEPTION 'Esta subloja não tem gerente vinculado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.store_managers
                 WHERE store_id = _store_id AND user_id = _manager_id AND is_active) THEN
    RAISE EXCEPTION 'Este usuário não é o gerente ativo desta subloja.';
  END IF;

  UPDATE public.store_managers
  SET is_active = false, unlinked_at = now(), updated_at = now()
  WHERE store_id = _store_id AND user_id = _manager_id AND is_active;

  -- Limpa o vínculo legado no perfil (só se ainda apontar para esta loja,
  -- para não apagar um vínculo mais novo feito depois).
  UPDATE public.profiles SET
    role = CASE
      WHEN EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _manager_id)
      THEN 'lojista'::partner_role
      ELSE 'cliente'::partner_role
    END,
    unit_store_id = NULL,
    network_id = NULL
  WHERE user_id = _manager_id AND unit_store_id = _store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Grants das RPCs (mesmo padrão da migration 20260820124000)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_unit_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_unit_manager(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_network_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_network_owner(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_routing_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_routing_context(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_as_matriz(text, uuid, text, text, numeric, numeric, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_as_matriz(text, uuid, text, text, numeric, numeric, numeric, integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_network_unit(text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.link_unit_user(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_unit_user(text, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unlink_unit_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_unit_user(uuid, uuid) TO authenticated, service_role;
