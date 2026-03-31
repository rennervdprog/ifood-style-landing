
-- Add collection_code to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS collection_code text;

-- Function to generate collection code when order moves to pronto_para_entrega
CREATE OR REPLACE FUNCTION public.generate_collection_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pronto_para_entrega' AND (OLD.status IS DISTINCT FROM 'pronto_para_entrega') AND NEW.collection_code IS NULL THEN
    NEW.collection_code := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for collection code generation
DROP TRIGGER IF EXISTS trg_generate_collection_code ON public.orders;
CREATE TRIGGER trg_generate_collection_code
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_collection_code();

-- RPC: Driver validates collection code at store pickup
CREATE OR REPLACE FUNCTION public.driver_validate_collection(_order_id uuid, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order RECORD;
BEGIN
  SELECT id, status, driver_id, collection_code INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF NOT public.is_driver(auth.uid()) THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.status != 'em_transito' THEN
    RAISE EXCEPTION 'Pedido não está no status correto para validação de coleta.';
  END IF;

  IF _order.collection_code IS NULL THEN
    RAISE EXCEPTION 'Este pedido não possui código de coleta.';
  END IF;

  IF _code IS NULL OR _code != _order.collection_code THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o lojista.';
  END IF;

  -- Mark collection as validated by clearing collection_code (acts as a flag)
  -- We'll use a new column instead
  UPDATE public.orders SET collection_validated = true WHERE id = _order_id;
END;
$$;

-- Add collection_validated column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS collection_validated boolean NOT NULL DEFAULT false;
