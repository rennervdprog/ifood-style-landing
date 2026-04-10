
CREATE OR REPLACE FUNCTION public.generate_settlement_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  _delivery_mode text;
BEGIN
  -- Only generate for cash/card payments when status changes to entregue/finalizado
  IF NEW.payment_method IN ('dinheiro', 'cartao')
     AND NEW.status IN ('entregue', 'finalizado')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.settlement_code IS NULL THEN

    -- Check if store uses own delivery - skip settlement code
    SELECT delivery_mode INTO _delivery_mode
    FROM public.stores WHERE id = NEW.store_id;

    IF _delivery_mode = 'own' THEN
      RETURN NEW;
    END IF;

    NEW.settlement_code := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;
