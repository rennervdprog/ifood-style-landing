
-- Add delivery_pin and confirmed_at to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Add pix_key and pix_type to profiles
DO $$ BEGIN
  CREATE TYPE public.pix_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_type public.pix_type;

-- Function to generate random 4-digit PIN
CREATE OR REPLACE FUNCTION public.generate_delivery_pin()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'pendente' AND NEW.delivery_pin IS NULL THEN
    NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger to auto-generate PIN on order creation
DROP TRIGGER IF EXISTS set_delivery_pin ON public.orders;
CREATE TRIGGER set_delivery_pin
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_delivery_pin();

-- Update driver_finish_delivery to require PIN verification
CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
BEGIN
  SELECT delivery_pin, status, driver_id INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.status != 'em_transito' THEN
    RAISE EXCEPTION 'Este pedido não está em trânsito.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF NOT public.is_driver(auth.uid()) THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.delivery_pin IS NOT NULL AND (_pin IS NULL OR _pin != _order.delivery_pin) THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o cliente.';
  END IF;

  UPDATE public.orders
  SET status = 'entregue', confirmed_at = now()
  WHERE id = _order_id;
END;
$function$;
