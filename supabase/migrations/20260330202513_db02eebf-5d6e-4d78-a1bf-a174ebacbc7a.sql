
-- Fix search_path for generate_delivery_pin
CREATE OR REPLACE FUNCTION public.generate_delivery_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pendente' AND NEW.delivery_pin IS NULL THEN
    NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;
