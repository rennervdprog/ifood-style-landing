-- Fase 2 — Bugfixes (28/10/2026, achados no teste ao vivo).
--
-- Bug 1 — publish_network_unit: a mensagem de checklist incompleto
-- quebrava. `_missing || 'horário'` faz o Postgres resolver o `||`
-- como concatenação DE ARRAYS (anyarray || anyarray) e tentar ler
-- 'horário' como literal de array → 400 malformed array literal, em vez
-- da mensagem amigável "Falta concluir: ...". O bloqueio funcionava
-- (não publicava incompleto), só a mensagem quebrava. Correção:
-- array_append, nos 4 lugares (endereço, horário, cardápio, entregador).
--
-- Bug 2 — convite vencido ficava `pending`: em accept_network_invite
-- (e decline_network_invite, mesmo padrão), o UPDATE para
-- status='expired' era desfeito pelo RAISE EXCEPTION seguinte — a
-- exceção aborta a transação inteira e o UPDATE some junto. O aceite
-- era recusado certo, mas o convite continuava `pending` com
-- expires_at passado, confundindo a lista do dono. Correção: o ramo
-- de vencido não levanta mais exceção — grava 'expired' e devolve um
-- erro ESTRUTURADO (jsonb {ok:false, error:...}). As duas funções
-- passam a retornar jsonb {ok, store_id?, error?} em vez de uuid/void
-- (por isso o DROP da assinatura antiga antes do CREATE — não dá para
-- mudar o tipo de retorno com CREATE OR REPLACE). Os demais RAISEs
-- continuam como estão: eles acontecem ANTES de qualquer escrita, então
-- nada se perde. Os chamadores (ConviteRede.tsx) passam a interpretar
-- o jsonb (helper parseInviteActionResult em src/lib/networkUnits.ts).
--
-- Correção de comentário (não de comportamento): o rascunho nasce com
-- status 'ativo', não 'analise' — o trigger pré-existente
-- force_store_auto_approve força 'ativo' em todo INSERT em stores.
-- O comportamento está certo (o rascunho continua invisível por
-- is_draft + is_visible=false); só o comentário da migration 142000
-- dizia 'analise'. Registrado aqui; a migration aplicada NÃO foi
-- editada.
--
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança.

-- ---------------------------------------------------------------------------
-- 1. publish_network_unit — array_append no lugar de `||`
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
  IF NOT ((_check ->> 'address')::boolean) THEN _missing := array_append(_missing, 'endereço'); END IF;
  IF NOT ((_check ->> 'hours')::boolean) THEN _missing := array_append(_missing, 'horário'); END IF;
  IF NOT ((_check ->> 'menu')::boolean) THEN _missing := array_append(_missing, 'cardápio'); END IF;
  IF NOT ((_check ->> 'driver')::boolean) THEN _missing := array_append(_missing, 'entregador'); END IF;
  IF array_length(_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Falta concluir: %.', array_to_string(_missing, ', ');
  END IF;

  UPDATE public.stores
  SET is_draft = false, is_visible = true, status = 'ativo'
  WHERE id = _store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. accept_network_invite — vencido grava 'expired' e devolve erro
--    estruturado (jsonb) em vez de RAISE (que desfazia o UPDATE)
-- ---------------------------------------------------------------------------
-- O tipo de retorno muda (uuid -> jsonb): DROP da assinatura antiga antes.
DROP FUNCTION IF EXISTS public.accept_network_invite(text);

CREATE FUNCTION public.accept_network_invite(_code text)
RETURNS jsonb
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
    -- Bugfix: grava 'expired' e DEVOLVE o erro (não levanta exceção),
    -- senão a exceção aborta a transação e o UPDATE some junto.
    UPDATE public.network_invites SET status = 'expired', updated_at = now() WHERE id = _invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Este convite venceu (7 dias). Peça um novo convite ao dono da rede.');
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

  RETURN jsonb_build_object('ok', true, 'store_id', _invite.store_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. decline_network_invite — mesmo bugfix do aceite (vencido persiste)
-- ---------------------------------------------------------------------------
-- O tipo de retorno muda (void -> jsonb): DROP da assinatura antiga antes.
DROP FUNCTION IF EXISTS public.decline_network_invite(text);

CREATE FUNCTION public.decline_network_invite(_code text)
RETURNS jsonb
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
    -- Bugfix: grava 'expired' e DEVOLVE o erro (não levanta exceção),
    -- senão a exceção aborta a transação e o UPDATE some junto.
    UPDATE public.network_invites SET status = 'expired', updated_at = now() WHERE id = _invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Este convite venceu (7 dias).');
  END IF;

  SELECT lower(email) INTO _caller_email FROM auth.users WHERE id = _caller_id;
  IF _caller_email IS NULL OR _caller_email <> lower(_invite.email) THEN
    RAISE EXCEPTION 'Este convite é para outro e-mail.';
  END IF;

  UPDATE public.network_invites
  SET status = 'declined', updated_at = now()
  WHERE id = _invite.id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Grants (o DROP remove os grants antigos; reaplicar, mesmo padrão)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.accept_network_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_network_invite(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decline_network_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_network_invite(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.publish_network_unit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_network_unit(uuid) TO authenticated, service_role;
