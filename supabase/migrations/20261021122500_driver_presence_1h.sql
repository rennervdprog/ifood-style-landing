-- Presença do entregador: janela de 20 min -> 1 hora (pedido do Renner, 2026-10-21).
-- Motivo: o app do entregador só manda o "estou aqui" (driver_presence_heartbeat)
-- com ele aberto em primeiro plano. Numa entrega longa (Waze/Maps aberto), o
-- sinal parava e, em 20 min, a loja virava "sem entregador" e PARAVA de receber
-- pedidos — mesmo com o motoboy em rota. Agora: presença normal até 57 min,
-- tolerância até 60 min; indisponível só após 1 hora sem sinal.
-- Aplicada via Management API em 2026-10-21 e testada ao vivo na loja de teste
-- (10 min=available, 30 min=available, 58 min=grace, 61 min=no_driver_available).

CREATE OR REPLACE FUNCTION public.store_delivery_availability(_store_id uuid)
 RETURNS TABLE(can_accept_delivery_orders boolean, available_drivers_count integer, reason_code text, reason_message text, checked_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH target_store AS (
    SELECT id, delivery_mode, delivery_enabled
      FROM public.stores
     WHERE id = _store_id
  ), availability AS (
    SELECT
      count(*) FILTER (
        WHERE d.last_seen_at >= now() - interval '57 minutes'
      )::integer AS normal_presence_count,
      count(*) FILTER (
        WHERE d.last_seen_at >= now() - interval '60 minutes'
      )::integer AS tolerated_presence_count
      FROM public.store_drivers sd
      JOIN public.drivers d ON d.user_id = sd.driver_user_id
     WHERE sd.store_id = _store_id
       AND (sd.status = 'accepted' OR sd.status IS NULL)
       AND d.is_active = true
       AND d.is_online = true
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN false
      WHEN (SELECT delivery_mode FROM target_store) <> 'own' THEN true
      WHEN (SELECT tolerated_presence_count FROM availability) > 0 THEN true
      ELSE false
    END AS can_accept_delivery_orders,
    COALESCE((SELECT tolerated_presence_count FROM availability), 0) AS available_drivers_count,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN 'store_not_found'
      WHEN (SELECT delivery_mode FROM target_store) <> 'own' THEN 'not_applicable'
      WHEN (SELECT normal_presence_count FROM availability) > 0 THEN 'available'
      WHEN (SELECT tolerated_presence_count FROM availability) > 0 THEN 'available_presence_grace'
      ELSE 'no_driver_available'
    END AS reason_code,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN 'Loja não encontrada.'
      WHEN (SELECT delivery_mode FROM target_store) <> 'own' THEN 'Disponibilidade de entregador próprio não se aplica a esta loja.'
      WHEN (SELECT normal_presence_count FROM availability) > 0 THEN 'Entrega disponível.'
      WHEN (SELECT tolerated_presence_count FROM availability) > 0 THEN 'Entrega disponível no período de tolerância de presença do entregador.'
      ELSE 'Esta loja está sem entregador disponível no momento.'
    END AS reason_message,
    now() AS checked_at;
$function$;

CREATE OR REPLACE FUNCTION public.stores_with_online_drivers()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT sd.store_id
    FROM public.store_drivers sd
    JOIN public.drivers d ON d.user_id = sd.driver_user_id
   WHERE (sd.status = 'accepted' OR sd.status IS NULL)
     AND d.is_active = true
     AND d.is_online = true
     AND d.last_seen_at >= now() - interval '60 minutes';
$function$;
