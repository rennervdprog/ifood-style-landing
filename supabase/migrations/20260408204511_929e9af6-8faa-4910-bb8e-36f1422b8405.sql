
CREATE OR REPLACE FUNCTION public.verify_order_subtotal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _real_subtotal numeric;
  _order_record record;
  _delivery_mode text;
  _app_fee numeric;
BEGIN
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO _real_subtotal
  FROM public.order_items
  WHERE order_id = NEW.order_id;

  SELECT * INTO _order_record FROM public.orders WHERE id = NEW.order_id;

  IF _order_record IS NOT NULL AND ABS(_real_subtotal - _order_record.subtotal) > 0.01 THEN
    SELECT COALESCE(s.delivery_mode, 'platform') INTO _delivery_mode
    FROM public.stores s WHERE s.id = _order_record.store_id;

    IF _delivery_mode = 'own' THEN
      _app_fee := 0.90;
    ELSE
      _app_fee := ROUND(_real_subtotal * 0.15, 2);
    END IF;

    UPDATE public.orders
    SET subtotal = _real_subtotal,
        app_fee = _app_fee,
        total_price = GREATEST(0, _real_subtotal + COALESCE(_order_record.delivery_fee, 0))
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$function$;
