
CREATE OR REPLACE FUNCTION public.validate_order_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store_delivery_mode text;
  _app_fee numeric;
BEGIN
  -- Get the store's delivery mode
  SELECT COALESCE(s.delivery_mode, 'platform') INTO _store_delivery_mode
  FROM public.stores s WHERE s.id = NEW.store_id;

  -- For own-delivery stores, platform fee is fixed R$0.90
  -- For platform delivery, fee is 15% of subtotal
  IF _store_delivery_mode = 'own' THEN
    _app_fee := 0.90;
  ELSE
    _app_fee := ROUND(COALESCE(NEW.subtotal, 0) * 0.15, 2);
  END IF;
  
  NEW.app_fee := _app_fee;

  -- Ensure delivery_fee is non-negative
  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;

  -- Recalculate total_price = subtotal + delivery_fee
  NEW.total_price := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0));

  RETURN NEW;
END;
$function$;
