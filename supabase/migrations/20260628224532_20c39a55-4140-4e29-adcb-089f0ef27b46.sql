-- 1) Adiciona PIN de entrega ao perfil do cliente
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_pin text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_delivery_pin_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_delivery_pin_format
  CHECK (delivery_pin IS NULL OR delivery_pin ~ '^[0-9]{4}$');

-- 2) Atualiza geração do PIN do pedido: usa o PIN do cliente quando disponível
CREATE OR REPLACE FUNCTION public.generate_delivery_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _client_pin text;
BEGIN
  IF NEW.status = 'pendente' AND NEW.delivery_pin IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT delivery_pin INTO _client_pin
      FROM public.profiles
      WHERE user_id = NEW.client_id
      LIMIT 1;
    END IF;

    IF _client_pin IS NOT NULL AND _client_pin ~ '^[0-9]{4}$' THEN
      NEW.delivery_pin := _client_pin;
    ELSE
      NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;