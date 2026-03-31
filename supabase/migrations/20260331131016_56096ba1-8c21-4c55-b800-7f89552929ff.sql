
-- Update delivery pin trigger to only generate for non-payment-pending orders
CREATE OR REPLACE FUNCTION public.generate_delivery_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pendente' AND NEW.delivery_pin IS NULL THEN
    NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
