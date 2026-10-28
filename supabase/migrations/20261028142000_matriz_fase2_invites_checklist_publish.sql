-- Fase 2 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- 1. Convite de gerente (plano 4.3): o dono convida por e-mail, o convite
--    vale 7 dias, a pessoa se cadastra (se ainda não tem conta), aceita, e
--    o sistema liga ela à subloja — nunca ela mesma. As funções usam as
--    tabelas store_managers + network_invites criadas na Fase 1.
--      invite_unit_manager  — dono/admin cria o convite (reenvio expira o
--        anterior; 1 pendente por subloja+e-mail).
--      accept_network_invite — o convidado (autenticado, com o e-mail do
--        convite) aceita e vira gerente da subloja.
--      decline_network_invite — o convidado recusa.
--      get_network_invite    — lê os dados do convite pelo código (é o
--        código que autentica; por isso pode ser chamada sem login, para a
--        página de aceite mostrar de qual loja/rede é o convite).
-- 2. Checklist + publicar (C9/M8): a subloja nasce rascunho e só entra na
--    vitrine com o checklist completo — endereço, horário, cardápio e
--    entregador.
--      network_unit_checklist — devolve cada item + pronto ou não.
--      publish_network_unit   — valida o checklist e publica (tira o
--        rascunho, mostra na vitrine, status ativo).
-- 3. Pausa da rede (decisão 9): pausar a matriz pausa as sublojas junto,
--    com confirmação na tela (o painel pede a confirmação; aqui vai a
--    regra). Despausar reabre. A loja-matriz (guia, não vende) e os
--    rascunhos não são tocados.
--      set_network_paused — marca a rede e liga/desliga force_closed nas
--        sublojas publicadas.
--
-- Escrita DIRETA continua proibida para o usuário comum (Fase 1): só as
-- funções SECURITY DEFINER abaixo e o admin escrevem nessas tabelas.
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança.

-- ---------------------------------------------------------------------------
-- 1. invite_unit_manager — dono/admin convida o gerente por e-mail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_unit_manager(_store_id uuid, _email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _store record;
  _network_id uuid;
  _email_norm text := lower(trim(coalesce(_email, '')));
  _target_user_id uuid;
  _code text;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF _email_norm = '' OR _email_norm !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o convite.';
  END IF;

  SELECT s.* INTO _store FROM stores s
  JOIN store_networks sn ON sn.id = s.network_id
  WHERE s.id = _store_id;
  IF _store IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada em nenhuma rede.';
  END IF;

  IF _store.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem convidar gerente para esta loja.';
  END IF;

  -- A loja-matriz (guia, não vende) não tem gerente de unidade.
  IF COALESCE(_store.is_matriz, false) THEN
    RAISE EXCEPTION 'A loja-matriz não tem gerente de unidade.';
  END IF;

  -- A subloja não pode ter gerente ativo (desvincule antes de convidar outro).
  IF EXISTS (SELECT 1 FROM public.store_managers WHERE store_id = _store_id AND is_active) THEN
    RAISE EXCEPTION 'Esta subloja já tem um gerente vinculado. Desvincule-o antes de convidar outro.';
  END IF;

  -- A9: quem já é dono de loja própria não pode virar gerente de unidade.
  SELECT id INTO _target_user_id FROM auth.users WHERE lower(email) = _email_norm LIMIT 1;
  IF _target_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _target_user_id) THEN
      RAISE EXCEPTION 'Este usuário já é dono de uma loja própria e não pode virar gerente de unidade.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.store_managers WHERE user_id = _target_user_id AND is_active) THEN
      RAISE EXCEPTION 'Este usuário já é gerente de outra subloja.';
    END IF;
  END IF;

  _network_id := _store.network_id;

  -- Reenvio não empilha convites: o pendente anterior expira.
  UPDATE public.network_invites SET status = 'expired', updated_at = now()
  WHERE store_id = _store_id AND lower(email) = _email_norm AND status = 'pending';

  INSERT INTO public.network_invites (network_id, store_id, email, invited_by)
  VALUES (_network_id, _store_id, _email_norm, _caller_id)
  RETURNING code INTO _code;

  RETURN _code;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. accept_network_invite — o convidado aceita e vira gerente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_network_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _invite record;
  _caller_email text;
  _store record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado. Entre com a conta do e-mail convidado para aceitar.';
  END IF;

  SELECT * INTO _invite FROM public.network_invites WHERE code = _code LIMIT 1;
  IF _invite IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;
  IF _invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite já foi respondido.';
  END IF;
  IF _invite.expires_at <= now() THEN
    UPDATE public.network_invites SET status = 'expired', updated_at = now() WHERE id = _invite.id;
    RAISE EXCEPTION 'Este convite venceu (7 dias). Peça um novo convite ao dono da rede.';
  END IF;

  -- O convite é pessoal: só quem tem o e-mail convidado aceita.
  SELECT lower(email) INTO _caller_email FROM auth.users WHERE id = _caller_id;
  IF _caller_email IS NULL OR _caller_email <> lower(_invite.email) THEN
    RAISE EXCEPTION 'Este convite é para outro e-mail. Entre com a conta do e-mail convidado.';
  END IF;

  SELECT s.* INTO _store FROM stores s WHERE s.id = _invite.store_id;
  IF _store IS NULL OR COALESCE(_store.is_matriz, false) THEN
    RAISE EXCEPTION 'A subloja deste convite não existe mais.';
  END IF;

  -- A9: quem já é dono de loja própria não pode virar gerente de unidade.
  IF EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _caller_id) THEN
    RAISE EXCEPTION 'Você já é dono de uma loja própria e não pode virar gerente de unidade.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.store_managers WHERE user_id = _caller_id AND is_active) THEN
    RAISE EXCEPTION 'Você já é gerente de outra subloja.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.store_managers WHERE store_id = _invite.store_id AND is_active) THEN
    RAISE EXCEPTION 'Esta subloja já tem um gerente vinculado.';
  END IF;

  INSERT INTO public.store_managers (store_id, user_id, linked_by, role, is_active)
  VALUES (_invite.store_id, _caller_id, _invite.invited_by, 'manager', true);

  -- Escrita legada no perfil (transição): o roteamento lê unit_store_id /
  -- network_id. A função roda como dono e não é afetada pela trava da Fase 1.
  UPDATE public.profiles SET
    role = 'lojista_unidade'::partner_role,
    unit_store_id = _invite.store_id,
    network_id = _invite.network_id
  WHERE user_id = _caller_id;

  UPDATE public.network_invites
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = _invite.id;

  RETURN _invite.store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. decline_network_invite — o convidado recusa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_network_invite(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _invite record;
  _caller_email text;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO _invite FROM public.network_invites WHERE code = _code LIMIT 1;
  IF _invite IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;
  IF _invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Este convite já foi respondido.';
  END IF;
  IF _invite.expires_at <= now() THEN
    UPDATE public.network_invites SET status = 'expired', updated_at = now() WHERE id = _invite.id;
    RAISE EXCEPTION 'Este convite venceu (7 dias).';
  END IF;

  SELECT lower(email) INTO _caller_email FROM auth.users WHERE id = _caller_id;
  IF _caller_email IS NULL OR _caller_email <> lower(_invite.email) THEN
    RAISE EXCEPTION 'Este convite é para outro e-mail.';
  END IF;

  UPDATE public.network_invites
  SET status = 'declined', updated_at = now()
  WHERE id = _invite.id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. get_network_invite — dados do convite pelo código (página de aceite)
-- ---------------------------------------------------------------------------
-- O código é o segredo: quem tem o link vê de qual loja/rede é o convite,
-- mesmo sem login. Não devolve nada sensível.
CREATE OR REPLACE FUNCTION public.get_network_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invite record;
BEGIN
  SELECT ni.*, s.name AS store_name, s.address_city AS store_city,
         sn.name AS network_name
    INTO _invite
    FROM public.network_invites ni
    JOIN public.stores s ON s.id = ni.store_id
    JOIN public.store_networks sn ON sn.id = ni.network_id
   WHERE ni.code = _code
   LIMIT 1;

  IF _invite IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'code', _invite.code,
    'email', _invite.email,
    'status', _invite.status,
    'expires_at', _invite.expires_at,
    'store_id', _invite.store_id,
    'store_name', _invite.store_name,
    'store_city', _invite.store_city,
    'network_id', _invite.network_id,
    'network_name', _invite.network_name
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. network_unit_checklist — endereço, horário, cardápio, entregador
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.network_unit_checklist(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _store record;
  _address_ok boolean;
  _hours_ok boolean;
  _menu_ok boolean;
  _driver_ok boolean;
BEGIN
  SELECT * INTO _store FROM public.stores WHERE id = _store_id;
  IF _store IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  -- Endereço completo (mesma regra da criação: rua, número, bairro,
  -- cidade e CEP).
  _address_ok := nullif(trim(coalesce(_store.address_street, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_number, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_neighborhood, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_city, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(_store.address_cep, '')), '') IS NOT NULL;

  -- Horário: ao menos um dia com abertura configurada.
  _hours_ok := EXISTS (
    SELECT 1 FROM public.opening_hours
    WHERE store_id = _store_id AND NOT COALESCE(is_closed_all_day, false)
  );

  -- Cardápio: ao menos um produto disponível.
  _menu_ok := EXISTS (
    SELECT 1 FROM public.products
    WHERE store_id = _store_id AND COALESCE(is_available, false)
  );

  -- Entregador: ao menos um entregador aceito na loja.
  _driver_ok := EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE store_id = _store_id AND status = 'accepted'
  );

  RETURN jsonb_build_object(
    'store_id', _store_id,
    'is_draft', COALESCE(_store.is_draft, false),
    'address', _address_ok,
    'hours', _hours_ok,
    'menu', _menu_ok,
    'driver', _driver_ok,
    'ready', (_address_ok AND _hours_ok AND _menu_ok AND _driver_ok)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. publish_network_unit — publica a subloja com o checklist completo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_network_unit(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _store record;
  _check jsonb;
  _missing text[] := ARRAY[]::text[];
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
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem publicar esta subloja.';
  END IF;

  IF COALESCE(_store.is_matriz, false) THEN
    RAISE EXCEPTION 'A loja-matriz não é publicada — ela só apresenta o grupo.';
  END IF;

  IF NOT COALESCE(_store.is_draft, false) THEN
    RAISE EXCEPTION 'Esta subloja já está publicada.';
  END IF;

  _check := public.network_unit_checklist(_store_id);
  IF NOT ((_check ->> 'address')::boolean) THEN _missing := _missing || 'endereço'; END IF;
  IF NOT ((_check ->> 'hours')::boolean) THEN _missing := _missing || 'horário'; END IF;
  IF NOT ((_check ->> 'menu')::boolean) THEN _missing := _missing || 'cardápio'; END IF;
  IF NOT ((_check ->> 'driver')::boolean) THEN _missing := _missing || 'entregador'; END IF;
  IF array_length(_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Falta concluir: %.', array_to_string(_missing, ', ');
  END IF;

  UPDATE public.stores
  SET is_draft = false, is_visible = true, status = 'ativo'
  WHERE id = _store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. set_network_paused — pausar a rede pausa as sublojas junto (dec. 9)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_network_paused(_network_id uuid, _paused boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _network record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO _network FROM public.store_networks WHERE id = _network_id;
  IF _network IS NULL THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  IF _network.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem pausar esta rede.';
  END IF;

  UPDATE public.store_networks SET is_paused = _paused WHERE id = _network_id;

  -- Pausar = fechar as sublojas publicadas para pedidos (force_closed).
  -- A loja-matriz (guia, não vende) e os rascunhos não são tocados.
  UPDATE public.stores SET force_closed = _paused
  WHERE network_id = _network_id
    AND NOT COALESCE(is_matriz, false)
    AND NOT COALESCE(is_draft, false);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Grants (mesmo padrão da Fase 1)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.invite_unit_manager(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_unit_manager(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.accept_network_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_network_invite(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decline_network_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_network_invite(text) TO authenticated, service_role;
-- get_network_invite pode ser chamada SEM login (o código é o segredo).
REVOKE EXECUTE ON FUNCTION public.get_network_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_network_invite(text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.network_unit_checklist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_unit_checklist(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.publish_network_unit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_network_unit(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_network_paused(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_network_paused(uuid, boolean) TO authenticated, service_role;
