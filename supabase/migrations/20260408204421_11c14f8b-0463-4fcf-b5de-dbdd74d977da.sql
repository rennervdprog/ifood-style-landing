
CREATE OR REPLACE FUNCTION public.client_confirm_delivery(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order record;
  _commission numeric;
  _delivery_mode text;
BEGIN
  SELECT id, client_id, status, store_id, subtotal, delivery_confirmed_by_client
  INTO _order
  FROM orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.client_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o dono deste pedido.';
  END IF;

  IF _order.delivery_confirmed_by_client THEN
    RAISE EXCEPTION 'Entrega já confirmada.';
  END IF;

  IF _order.status NOT IN ('saiu_entrega', 'entregue', 'em_transito') THEN
    RAISE EXCEPTION 'Pedido não está em status de entrega.';
  END IF;

  -- Mark delivery as confirmed by client
  UPDATE orders
  SET delivery_confirmed_by_client = true,
      status = 'finalizado',
      confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = _order_id;

  -- Determine commission based on delivery mode
  SELECT COALESCE(s.delivery_mode, 'platform') INTO _delivery_mode
  FROM stores s WHERE s.id = _order.store_id;

  IF _delivery_mode = 'own' THEN
    _commission := 0.90;
  ELSE
    _commission := ROUND(_order.subtotal * 0.15, 2);
  END IF;

  INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (_order.store_id, _commission, _commission, 0, now())
  ON CONFLICT (store_id) DO UPDATE SET
    comissao_pendente = store_balances.comissao_pendente + _commission,
    pending_commission = store_balances.pending_commission + _commission,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_finalize_stale_orders()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _finalized_count integer := 0;
  _alert_count integer := 0;
  _store record;
BEGIN
  -- Auto-finalize orders that have been in saiu_entrega or entregue for more than 2 hours
  -- Only for own-delivery stores
  WITH stale AS (
    SELECT o.id, o.store_id, o.subtotal
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status IN ('saiu_entrega', 'entregue')
      AND o.created_at < now() - interval '2 hours'
  ),
  updated AS (
    UPDATE orders
    SET status = 'finalizado', confirmed_at = now()
    FROM stale
    WHERE orders.id = stale.id
    RETURNING orders.id, orders.store_id, orders.subtotal
  )
  SELECT count(*) INTO _finalized_count FROM updated;

  -- Generate commission for auto-finalized orders (R$0.90 fixed for own-delivery)
  INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  SELECT 
    o.store_id,
    0.90,
    0.90,
    0,
    now()
  FROM orders o
  JOIN stores s ON o.store_id = s.id
  WHERE s.delivery_mode = 'own'
    AND o.status = 'finalizado'
    AND o.confirmed_at >= now() - interval '1 minute'
  ON CONFLICT (store_id) DO UPDATE SET
    comissao_pendente = store_balances.comissao_pendente + 0.90,
    pending_commission = store_balances.pending_commission + 0.90,
    updated_at = now();

  -- Check for compliance violations: stores with 10+ non-finalized orders
  FOR _store IN
    SELECT s.id as store_id, s.name, count(*) as unfinalized_count
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status IN ('saiu_entrega', 'entregue')
      AND o.created_at < now() - interval '1 hour'
    GROUP BY s.id, s.name
    HAVING count(*) >= 10
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM compliance_alerts
      WHERE store_id = _store.store_id
        AND alert_type = 'unfinalized_orders'
        AND is_resolved = false
    ) THEN
      INSERT INTO compliance_alerts (store_id, alert_type, message)
      VALUES (
        _store.store_id,
        'unfinalized_orders',
        'Loja "' || _store.name || '" possui ' || _store.unfinalized_count || ' pedidos não finalizados. Possível evasão de comissão.'
      );
      _alert_count := _alert_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'finalized', _finalized_count,
    'alerts_created', _alert_count,
    'timestamp', now()
  );
END;
$function$;
