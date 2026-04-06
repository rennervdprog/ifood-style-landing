
CREATE OR REPLACE FUNCTION public.generate_collection_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _delivery_mode text;
BEGIN
  IF NEW.status = 'pronto_para_entrega' AND (OLD.status IS DISTINCT FROM 'pronto_para_entrega') AND NEW.collection_code IS NULL THEN
    SELECT COALESCE(s.delivery_mode, 'platform') INTO _delivery_mode
    FROM public.stores s WHERE s.id = NEW.store_id;
    
    IF _delivery_mode = 'platform' THEN
      NEW.collection_code := lpad(floor(random() * 10000)::text, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
