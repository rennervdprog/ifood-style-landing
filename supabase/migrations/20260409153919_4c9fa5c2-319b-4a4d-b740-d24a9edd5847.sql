
-- Add commission_rate to stores (percentage, default 15)
ALTER TABLE public.stores ADD COLUMN commission_rate numeric NOT NULL DEFAULT 15;

-- Update validate_order_prices to use store commission_rate
CREATE OR REPLACE FUNCTION public.validate_order_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _commission_rate numeric;
BEGIN
  SELECT COALESCE(s.commission_rate, 15) INTO _commission_rate
  FROM public.stores s WHERE s.id = NEW.store_id;

  NEW.app_fee := ROUND(COALESCE(NEW.subtotal, 0) * (_commission_rate / 100.0), 2);

  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;

  NEW.total_price := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0));

  RETURN NEW;
END;
$function$;

-- Update verify_order_subtotal
CREATE OR REPLACE FUNCTION public.verify_order_subtotal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _real_subtotal numeric;
  _order_record record;
  _app_fee numeric;
  _commission_rate numeric;
BEGIN
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO _real_subtotal
  FROM public.order_items
  WHERE order_id = NEW.order_id;

  SELECT * INTO _order_record FROM public.orders WHERE id = NEW.order_id;

  IF _order_record IS NOT NULL AND ABS(_real_subtotal - _order_record.subtotal) > 0.01 THEN
    SELECT COALESCE(s.commission_rate, 15) INTO _commission_rate
    FROM public.stores s WHERE s.id = _order_record.store_id;

    _app_fee := ROUND(_real_subtotal * (_commission_rate / 100.0), 2);

    UPDATE public.orders
    SET subtotal = _real_subtotal,
        app_fee = _app_fee,
        total_price = GREATEST(0, _real_subtotal + COALESCE(_order_record.delivery_fee, 0))
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update client_confirm_delivery
CREATE OR REPLACE FUNCTION public.client_confirm_delivery(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order record;
  _commission numeric;
  _commission_rate numeric;
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

  UPDATE orders
  SET delivery_confirmed_by_client = true,
      status = 'finalizado',
      confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = _order_id;

  SELECT COALESCE(s.commission_rate, 15) INTO _commission_rate
  FROM public.stores s WHERE s.id = _order.store_id;

  _commission := ROUND(_order.subtotal * (_commission_rate / 100.0), 2);

  INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (_order.store_id, _commission, _commission, 0, now())
  ON CONFLICT (store_id) DO UPDATE SET
    comissao_pendente = store_balances.comissao_pendente + _commission,
    pending_commission = store_balances.pending_commission + _commission,
    updated_at = now();
END;
$function$;

-- Update driver_confirm_store_return
CREATE OR REPLACE FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _is_physical_payment boolean;
  _delivery_fee numeric;
  _commission numeric;
  _commission_rate numeric;
BEGIN
  SELECT id, status, driver_id, payment_method, subtotal, delivery_fee, store_id, return_to_store_confirmed, settlement_code
  INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF _order.status NOT IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedido precisa estar com status entregue ou finalizado.';
  END IF;

  IF _order.return_to_store_confirmed THEN
    RAISE EXCEPTION 'Retorno já confirmado.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _delivery_fee := COALESCE(_order.delivery_fee, 0);

  SELECT COALESCE(s.commission_rate, 15) INTO _commission_rate
  FROM public.stores s WHERE s.id = _order.store_id;

  _commission := ROUND(COALESCE(_order.subtotal, 0) * (_commission_rate / 100.0), 2);

  IF NOT _is_physical_payment THEN
    RAISE EXCEPTION 'Este pedido não exige acerto físico com a loja.';
  END IF;

  IF _order.settlement_code IS NOT NULL THEN
    IF _settlement_code IS NULL OR _settlement_code != _order.settlement_code THEN
      RAISE EXCEPTION 'Código de acerto inválido. Solicite o código ao lojista.';
    END IF;
  END IF;

  UPDATE public.orders
  SET return_to_store_confirmed = true,
      status = 'finalizado'
  WHERE id = _order_id;

  INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (_order.store_id, _commission, _commission, 0, now())
  ON CONFLICT (store_id) DO UPDATE
  SET comissao_pendente = public.store_balances.comissao_pendente + _commission,
      pending_commission = public.store_balances.comissao_pendente + _commission,
      updated_at = now();

  UPDATE public.driver_earnings
  SET status = 'pago_loja'
  WHERE order_id = _order_id
    AND driver_user_id = auth.uid()
    AND status IN ('waiting_store_settlement', 'pendente');

  UPDATE public.driver_balances
  SET pending_amount = GREATEST(public.driver_balances.pending_amount - _delivery_fee, 0),
      paid_amount = public.driver_balances.paid_amount + _delivery_fee,
      updated_at = now()
  WHERE driver_user_id = auth.uid();
END;
$function$;

-- Update auto_finalize_stale_orders
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

  -- Generate commission using store's custom rate
  INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  SELECT 
    o.store_id,
    ROUND(o.subtotal * (COALESCE(s.commission_rate, 15) / 100.0), 2),
    ROUND(o.subtotal * (COALESCE(s.commission_rate, 15) / 100.0), 2),
    0,
    now()
  FROM orders o
  JOIN stores s ON o.store_id = s.id
  WHERE s.delivery_mode = 'own'
    AND o.status = 'finalizado'
    AND o.confirmed_at >= now() - interval '1 minute'
  ON CONFLICT (store_id) DO UPDATE SET
    comissao_pendente = store_balances.comissao_pendente + EXCLUDED.comissao_pendente,
    pending_commission = store_balances.pending_commission + EXCLUDED.pending_commission,
    updated_at = now();

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
