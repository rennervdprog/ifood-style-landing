
-- Fix: Remove duplicate split/commission processing from auto_finalize_stale_orders
-- The triggers accrue_fixed_plan_split and validate_order_prices already handle this
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
  -- Finalize stale orders for own-delivery stores (2h+)
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
    RETURNING orders.id
  )
  SELECT count(*) INTO _finalized_count FROM updated;

  -- NOTE: Commission/split accrual is handled by triggers:
  -- - accrue_fixed_plan_split (for fixed plan own delivery)
  -- - validate_order_prices (for app_fee calculation)
  -- No manual processing needed here to avoid double-counting.

  -- Generate compliance alerts for stores with many unfinalized orders (commission plans only)
  FOR _store IN
    SELECT s.id as store_id, s.name, count(*) as unfinalized_count
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status IN ('saiu_entrega', 'entregue')
      AND o.created_at < now() - interval '1 hour'
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

-- Remove duplicate settlement code trigger
DROP TRIGGER IF EXISTS trigger_generate_settlement_code ON public.orders;

-- Add explicit platform_split to delivery_fee_config
UPDATE public.admin_settings 
SET value = value || '{"platform_split": 2}'::jsonb,
    updated_at = now()
WHERE key = 'delivery_fee_config' 
AND NOT (value ? 'platform_split');

-- Clean stale commission data on Nata Lanches (fixed plan, should be 0)
UPDATE public.store_balances 
SET comissao_pendente = 0, pending_commission = 0, updated_at = now()
WHERE store_id = 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c'
AND comissao_pendente > 0;

-- Fix: Campanario repasse was double-counted. 3 orders × R$2 = R$6 (not 8)
UPDATE public.store_balances 
SET repasse_pendente = 6, updated_at = now()
WHERE store_id = 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5';
