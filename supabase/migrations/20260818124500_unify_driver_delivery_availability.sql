-- Disponibilidade unificada de entregadores
-- Fonte de verdade para web, aplicativo cliente e aplicativo entregador.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Mantém a presença de entregadores que já estavam online durante a transição.
-- A partir da atualização do app entregador, o heartbeat passa a renovar este campo.
UPDATE public.drivers
SET last_seen_at = now()
WHERE is_online = true
  AND last_seen_at IS NULL;

CREATE OR REPLACE FUNCTION public.driver_presence_heartbeat()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _updated public.drivers;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de entregador inválida';
  END IF;

  UPDATE public.drivers
     SET is_online = true,
         last_seen_at = now()
   WHERE user_id = _user_id
     AND is_active = true
   RETURNING * INTO _updated;

  IF _updated.user_id IS NULL THEN
    RAISE EXCEPTION 'Entregador ativo não encontrado';
  END IF;

  RETURN jsonb_build_object(
    'is_online', true,
    'last_seen_at', _updated.last_seen_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.driver_presence_heartbeat() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_presence_heartbeat() TO authenticated;

CREATE OR REPLACE FUNCTION public.store_delivery_availability(_store_id uuid)
RETURNS TABLE(
  can_accept_delivery_orders boolean,
  available_drivers_count integer,
  reason_code text,
  reason_message text,
  checked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH target_store AS (
    SELECT id, delivery_mode, delivery_enabled
      FROM public.stores
     WHERE id = _store_id
  ), availability AS (
    SELECT count(*)::integer AS available_count
      FROM public.store_drivers sd
      JOIN public.drivers d ON d.user_id = sd.driver_user_id
     WHERE sd.store_id = _store_id
       AND (sd.status = 'accepted' OR sd.status IS NULL)
       AND d.is_active = true
       AND d.is_online = true
       AND d.last_seen_at >= now() - interval '3 minutes'
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN false
      WHEN (SELECT delivery_mode FROM target_store) <> 'own' THEN true
      WHEN (SELECT available_count FROM availability) > 0 THEN true
      ELSE false
    END AS can_accept_delivery_orders,
    COALESCE((SELECT available_count FROM availability), 0) AS available_drivers_count,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN 'store_not_found'
      WHEN (SELECT delivery_mode FROM target_store) <> 'own' THEN 'not_applicable'
      WHEN (SELECT available_count FROM availability) > 0 THEN 'available'
      ELSE 'no_driver_available'
    END AS reason_code,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN 'Loja não encontrada.'
      WHEN (SELECT delivery_mode FROM target_store) <> 'own' THEN 'Disponibilidade de entregador próprio não se aplica a esta loja.'
      WHEN (SELECT available_count FROM availability) > 0 THEN 'Entrega disponível.'
      ELSE 'Esta loja está sem entregador disponível no momento.'
    END AS reason_message,
    now() AS checked_at;
$function$;

REVOKE ALL ON FUNCTION public.store_delivery_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_delivery_availability(uuid) TO anon, authenticated, service_role;

-- Mantém compatibilidade da página web existente, agora contando apenas quem pode atender.
CREATE OR REPLACE FUNCTION public.store_active_drivers_count(_store_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT available_drivers_count
    FROM public.store_delivery_availability(_store_id)
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.store_active_drivers_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_active_drivers_count(uuid) TO anon, authenticated, service_role;

-- Mantém compatibilidade da vitrine, com vínculo aceito, motorista ativo, online e presença recente.
CREATE OR REPLACE FUNCTION public.stores_with_online_drivers()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT sd.store_id
    FROM public.store_drivers sd
    JOIN public.drivers d ON d.user_id = sd.driver_user_id
   WHERE (sd.status = 'accepted' OR sd.status IS NULL)
     AND d.is_active = true
     AND d.is_online = true
     AND d.last_seen_at >= now() - interval '3 minutes';
$function$;

REVOKE ALL ON FUNCTION public.stores_with_online_drivers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stores_with_online_drivers() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_order_driver_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _availability record;
BEGIN
  -- O contrato existente marca retirada com bairro RETIRADA. Não se aplica a este fluxo.
  IF COALESCE(upper(trim(NEW.neighborhood)), '') = 'RETIRADA' THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO _availability
    FROM public.store_delivery_availability(NEW.store_id)
   LIMIT 1;

  IF COALESCE(_availability.can_accept_delivery_orders, false) = false THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'no_driver_available',
      DETAIL = COALESCE(_availability.reason_message, 'Esta loja está sem entregador disponível no momento.');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_order_driver_availability ON public.orders;
CREATE TRIGGER trg_enforce_order_driver_availability
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_driver_availability();

REVOKE ALL ON FUNCTION public.enforce_order_driver_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_order_driver_availability() TO service_role;
