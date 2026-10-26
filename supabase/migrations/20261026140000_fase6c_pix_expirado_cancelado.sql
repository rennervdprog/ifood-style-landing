-- Fase 6C (P2-2) — Pix Direto expirado é cancelado.
--
-- Estende public.auto_finalize_stale_orders() (definição atual copiada
-- INTEIRA de supabase/migrations/20260410135436_4d7d0e53-203d-4268-8e66-aad0b3e33bb7.sql):
-- pedidos aguardando_comprovante com pix_expires_at vencido passam a
-- status='cancelado' com cancel_reason='pix_expirado', contados no jsonb
-- como pix_expired_cancelled. O cron auto-finalize-stale-orders (jobid 2,
-- */30 * * * *) chama a edge auto-finalize-orders, que chama esta RPC —
-- NENHUMA mudança de cron.
--
-- NÃO APLICAR sem a palavra do Renner: no primeiro deploy, cancela os 2
-- pedidos parados do Pastelão Carioca (nº 43 e 44, R$ 26,50 cada, de
-- 25/08/2026) — provado no dry-run (transação + ROLLBACK) antes do PR.
CREATE OR REPLACE FUNCTION public.auto_finalize_stale_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _finalized_count integer := 0;
  _alert_count integer := 0;
  _pix_expired_count integer := 0;
  _store record;
BEGIN
  -- Finalize stale orders for own-delivery stores (2h+)
  -- + Fase 6C: cancela Pix Direto expirado (aguardando_comprovante com
  -- pix_expires_at vencido). Os dois CTEs de UPDATE rodam na mesma
  -- instrução WITH; a consulta principal lê os dois contadores.
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
  ),
  pix_stale AS (
    SELECT o.id
    FROM orders o
    WHERE o.status = 'aguardando_comprovante'
      AND o.pix_expires_at IS NOT NULL
      AND o.pix_expires_at < now()
  ),
  pix_cancelled AS (
    UPDATE orders
    SET status = 'cancelado', cancel_reason = 'pix_expirado'
    FROM pix_stale
    WHERE orders.id = pix_stale.id
    RETURNING orders.id
  )
  SELECT (SELECT count(*) FROM updated), (SELECT count(*) FROM pix_cancelled)
    INTO _finalized_count, _pix_expired_count;

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
    'pix_expired_cancelled', _pix_expired_count,
    'alerts_created', _alert_count,
    'timestamp', now()
  );
END;
$function$;
