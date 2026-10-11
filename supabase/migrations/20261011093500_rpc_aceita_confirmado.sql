-- Fix: aceita "confirmado" como alias de "preparando" na transição de status
-- Bug: frontend antigo enviava "confirmado", mas o enum só tem "preparando"
-- Isso travava o aceite de pedidos com erro de enum

CREATE OR REPLACE FUNCTION public.store_transition_order_status(_order_id uuid, _target_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order record;
  _uid uuid;
  _is_authorized boolean;
  _normalized_target text;
BEGIN
  _uid := auth.uid();

  -- Normaliza "confirmado" para "preparando" (compatibilidade com frontend antigo)
  _normalized_target := CASE WHEN _target_status = 'confirmado' THEN 'preparando' ELSE _target_status END;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = _order.store_id
      AND s.owner_id = _uid
  )
  OR public.is_platform_admin(_uid)
  OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para atualizar este pedido.';
  END IF;

  IF NOT (
    (_order.status = 'pendente' AND _normalized_target = 'preparando')
    OR (_order.status = 'preparando' AND _normalized_target = 'pronto_para_entrega')
    OR (
      _order.status = 'pronto_para_entrega'
      AND _normalized_target = 'finalizado'
      AND _order.neighborhood = 'RETIRADA'
    )
  ) THEN
    RAISE EXCEPTION 'Transição de pedido não permitida.';
  END IF;

  UPDATE public.orders
  SET status = _normalized_target::order_status
  WHERE id = _order.id;
END;
$function$;
