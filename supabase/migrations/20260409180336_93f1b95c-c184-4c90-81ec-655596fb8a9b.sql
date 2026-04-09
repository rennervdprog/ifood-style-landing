
-- 1. Update handle_new_user to also create store_plans
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.partner_role;
  _full_name text;
  _document text;
  _vehicle text;
  _whatsapp text;
  _phone text;
  _store_name text;
  _store_category text;
  _city text;
  _cep text;
  _street text;
  _neighborhood text;
  _delivery_mode text;
  _pix_type text;
  _pix_key text;
  _selected_plan text;
  _new_store_id uuid;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.partner_role, 'cliente');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _document := NEW.raw_user_meta_data->>'document';
  _vehicle := NEW.raw_user_meta_data->>'vehicle';
  _whatsapp := NEW.raw_user_meta_data->>'whatsapp';
  _phone := NEW.raw_user_meta_data->>'phone';
  _store_name := NEW.raw_user_meta_data->>'store_name';
  _store_category := NEW.raw_user_meta_data->>'store_category';
  _city := COALESCE(NEW.raw_user_meta_data->>'city', 'itatinga');
  _cep := NEW.raw_user_meta_data->>'cep';
  _street := NEW.raw_user_meta_data->>'street';
  _neighborhood := NEW.raw_user_meta_data->>'neighborhood';
  _pix_type := NEW.raw_user_meta_data->>'pix_type';
  _pix_key := NEW.raw_user_meta_data->>'pix_key';
  _selected_plan := NEW.raw_user_meta_data->>'selected_plan';

  _delivery_mode := CASE WHEN lower(trim(_city)) = 'itatinga' THEN 'platform' ELSE 'own' END;

  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone, email, city, cep, street, neighborhood, pix_type, pix_key)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone, NEW.email, _city, _cep, _street, _neighborhood,
    CASE WHEN _pix_type IS NOT NULL THEN _pix_type::public.pix_type ELSE NULL END,
    _pix_key)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    document = COALESCE(EXCLUDED.document, profiles.document),
    vehicle = COALESCE(EXCLUDED.vehicle, profiles.vehicle),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    city = COALESCE(EXCLUDED.city, profiles.city),
    cep = COALESCE(EXCLUDED.cep, profiles.cep),
    street = COALESCE(EXCLUDED.street, profiles.street),
    neighborhood = COALESCE(EXCLUDED.neighborhood, profiles.neighborhood),
    pix_type = COALESCE(EXCLUDED.pix_type, profiles.pix_type),
    pix_key = COALESCE(EXCLUDED.pix_key, profiles.pix_key);

  IF _role = 'motoboy' THEN
    INSERT INTO public.drivers (user_id, name, is_active, city)
    VALUES (NEW.id, _full_name, false, _city)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF _role = 'lojista' AND _store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, category, owner_id, status, address_city, delivery_mode, address_cep, address_street, address_neighborhood)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'analise', _city, _delivery_mode, _cep, _street, _neighborhood)
    RETURNING id INTO _new_store_id;

    -- Auto-create store_plans based on selected plan
    IF _new_store_id IS NOT NULL THEN
      INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active)
      VALUES (
        _new_store_id,
        CASE
          WHEN _selected_plan = 'fixed' THEN 'fixed'::public.store_plan_type
          WHEN _selected_plan = 'hybrid' THEN 'hybrid'::public.store_plan_type
          ELSE 'commission_only'::public.store_plan_type
        END,
        CASE
          WHEN _selected_plan = 'fixed' THEN 180
          WHEN _selected_plan = 'hybrid' THEN 100
          ELSE 0
        END,
        CASE
          WHEN _selected_plan = 'fixed' THEN 0
          WHEN _selected_plan = 'hybrid' THEN 2.5
          ELSE 15
        END,
        true
      )
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Helper function: get effective commission rate from store_plans (0 for fixed)
CREATE OR REPLACE FUNCTION public.get_store_commission_rate(_store_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN sp.plan_type = 'fixed' THEN 0 ELSE sp.commission_rate END
     FROM public.store_plans sp
     WHERE sp.store_id = _store_id AND sp.is_active = true
     LIMIT 1),
    COALESCE((SELECT s.commission_rate FROM public.stores s WHERE s.id = _store_id), 15)
  )
$$;

-- 3. Update validate_order_prices to use store_plans
CREATE OR REPLACE FUNCTION public.validate_order_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _commission_rate numeric;
BEGIN
  _commission_rate := public.get_store_commission_rate(NEW.store_id);

  NEW.app_fee := ROUND(COALESCE(NEW.subtotal, 0) * (_commission_rate / 100.0), 2);

  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;

  NEW.total_price := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0));

  RETURN NEW;
END;
$function$;

-- 4. Update verify_order_subtotal to use store_plans
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
    _commission_rate := public.get_store_commission_rate(_order_record.store_id);
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

-- 5. Update client_confirm_delivery to use store_plans and skip commission for fixed
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

  _commission_rate := public.get_store_commission_rate(_order.store_id);

  -- Skip commission accrual for fixed plans (rate = 0)
  IF _commission_rate > 0 THEN
    _commission := ROUND(_order.subtotal * (_commission_rate / 100.0), 2);

    INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
    VALUES (_order.store_id, _commission, _commission, 0, now())
    ON CONFLICT (store_id) DO UPDATE SET
      comissao_pendente = store_balances.comissao_pendente + _commission,
      pending_commission = store_balances.pending_commission + _commission,
      updated_at = now();
  END IF;
END;
$function$;

-- 6. Update auto_finalize_stale_orders to use store_plans
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

-- 7. Update driver_confirm_store_return to use store_plans
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

  _commission_rate := public.get_store_commission_rate(_order.store_id);

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

  -- Only accrue commission if rate > 0
  IF _commission_rate > 0 THEN
    _commission := ROUND(COALESCE(_order.subtotal, 0) * (_commission_rate / 100.0), 2);

    INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
    VALUES (_order.store_id, _commission, _commission, 0, now())
    ON CONFLICT (store_id) DO UPDATE
    SET comissao_pendente = public.store_balances.comissao_pendente + _commission,
        pending_commission = public.store_balances.comissao_pendente + _commission,
        updated_at = now();
  END IF;

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
