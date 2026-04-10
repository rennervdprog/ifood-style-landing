
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
  _order record;
  _commission_rate numeric;
  _commission numeric;
BEGIN
  -- Finalize stale orders for own-delivery stores
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

  -- Generate commission only for stores with commission plans
  FOR _order IN
    SELECT o.store_id, o.subtotal
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status = 'finalizado'
      AND o.confirmed_at >= now() - interval '1 minute'
  LOOP
    _commission_rate := public.get_store_commission_rate(_order.store_id);
    
    IF _commission_rate > 0 THEN
      _commission := ROUND(_order.subtotal * (_commission_rate / 100.0), 2);
      
      INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
      VALUES (_order.store_id, _commission, _commission, 0, now())
      ON CONFLICT (store_id) DO UPDATE SET
        comissao_pendente = store_balances.comissao_pendente + _commission,
        pending_commission = store_balances.pending_commission + _commission,
        updated_at = now();
    END IF;
  END LOOP;

  -- Generate compliance alerts ONLY for stores that have commission (skip fixed plans)
  FOR _store IN
    SELECT s.id as store_id, s.name, count(*) as unfinalized_count
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status IN ('saiu_entrega', 'entregue')
      AND o.created_at < now() - interval '1 hour'
      -- Exclude fixed plan stores (no commission = no evasion risk)
      AND public.get_store_commission_rate(s.id) > 0
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
