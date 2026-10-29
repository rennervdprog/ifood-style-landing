-- ============================================================================
-- Matriz Gestor de Redes — RPCs do painel gestor (2026-10-29)
-- ============================================================================
-- ATENÇÃO: migration criada junto com o front do Gestor, AINDA NÃO
-- APLICADA. O painel funciona sem ela (o Financeiro cai no espelho local
-- da regra e os botões em massa avisam que a função não está no ar); ela
-- destrava o comportamento completo e autoritativo no banco.
--
-- O que cria (tudo SECURITY DEFINER com a MESMA checagem de dono da
-- set_network_paused da Fase 2: dono da rede ou admin da plataforma):
--
--   1. get_network_monthly_fee(_network_id)
--      Wrapper de calculate_network_monthly_fee (Fase 4/4b) para o front:
--      a função de cálculo é service_role-only porque a edge a chama; o
--      painel do dono da rede precisa do breakdown sem abrir a função
--      para qualquer usuário — o wrapper confere a posse antes.
--
--   2. set_network_unit_paused(_store_id, _paused)
--      Pausa/retoma UMA subloja (force_closed), sem pausar a rede.
--      Retomar é bloqueado enquanto a rede estiver pausada (a pausa da
--      rede manda em todas). A loja-guia (matriz) não é pausável aqui.
--
--   3. set_network_delivery_fee(_network_id, _fee)
--      Aplica a mesma taxa de entrega (stores.delivery_fee) em todas as
--      sublojas da rede. Retorna quantas lojas foram atualizadas.
--
--   4. apply_network_opening_hours(_network_id, _source_store_id)
--      Copia o horário de funcionamento (opening_hours) de uma subloja
--      para todas as outras da rede, substituindo o horário delas.
--      Retorna quantas lojas receberam o horário.
--
-- NÃO altera dados existentes, NÃO mexe em cobrança, NÃO liga flag.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_network_monthly_fee — breakdown da mensalidade para o dono da rede
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_network_monthly_fee(_network_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _network record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO _network FROM public.store_networks WHERE id = _network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  IF _network.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem ver a mensalidade desta rede.';
  END IF;

  RETURN public.calculate_network_monthly_fee(_network_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. set_network_unit_paused — pausa individual de subloja
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_network_unit_paused(_store_id uuid, _paused boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _store record;
  _network record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO _store FROM public.stores WHERE id = _store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  IF COALESCE(_store.is_matriz, false) THEN
    RAISE EXCEPTION 'A loja-guia da rede não vende — não há o que pausar nela.';
  END IF;

  IF _store.network_id IS NULL THEN
    RAISE EXCEPTION 'Esta loja não pertence a uma rede.';
  END IF;

  SELECT * INTO _network FROM public.store_networks WHERE id = _store.network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  IF _network.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem pausar esta unidade.';
  END IF;

  IF NOT _paused AND COALESCE(_network.is_paused, false) THEN
    RAISE EXCEPTION 'A rede está pausada — reative a rede para esta unidade voltar a vender.';
  END IF;

  UPDATE public.stores SET force_closed = _paused WHERE id = _store_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. set_network_delivery_fee — taxa de entrega em massa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_network_delivery_fee(_network_id uuid, _fee numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _network record;
  _updated integer;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF _fee IS NULL OR _fee < 0 THEN
    RAISE EXCEPTION 'Taxa de entrega inválida.';
  END IF;

  SELECT * INTO _network FROM public.store_networks WHERE id = _network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  IF _network.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem alterar as lojas desta rede.';
  END IF;

  UPDATE public.stores
     SET delivery_fee = _fee
   WHERE network_id = _network_id
     AND NOT COALESCE(is_matriz, false);
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. apply_network_opening_hours — horário de uma unidade para todas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_network_opening_hours(_network_id uuid, _source_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _network record;
  _source record;
  _target record;
  _updated integer := 0;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO _network FROM public.store_networks WHERE id = _network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rede não encontrada.';
  END IF;

  IF _network.owner_id <> _caller_id AND NOT public.is_platform_admin(_caller_id) THEN
    RAISE EXCEPTION 'Só o dono da rede ou o admin podem alterar as lojas desta rede.';
  END IF;

  SELECT * INTO _source FROM public.stores
   WHERE id = _source_store_id AND network_id = _network_id
     AND NOT COALESCE(is_matriz, false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A unidade-fonte do horário não pertence a esta rede.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.opening_hours WHERE store_id = _source_store_id) THEN
    RAISE EXCEPTION 'A unidade escolhida não tem horário cadastrado para copiar.';
  END IF;

  FOR _target IN
    SELECT * FROM public.stores
     WHERE network_id = _network_id
       AND NOT COALESCE(is_matriz, false)
       AND id <> _source_store_id
  LOOP
    DELETE FROM public.opening_hours WHERE store_id = _target.id;
    INSERT INTO public.opening_hours (store_id, day_of_week, open_time, close_time, is_closed_all_day)
    SELECT _target.id, day_of_week, open_time, close_time, is_closed_all_day
      FROM public.opening_hours
     WHERE store_id = _source_store_id;
    _updated := _updated + 1;
  END LOOP;

  RETURN _updated;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants (mesmo padrão da Fase 2: nada para PUBLIC/anon)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_network_monthly_fee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_network_monthly_fee(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_network_unit_paused(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_network_unit_paused(uuid, boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_network_delivery_fee(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_network_delivery_fee(uuid, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.apply_network_opening_hours(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_network_opening_hours(uuid, uuid) TO authenticated, service_role;
