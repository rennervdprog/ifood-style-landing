-- Janela canônica de 20 minutos para envio do comprovante de PIX Direto.
-- O servidor é a autoridade; clientes não podem escolher ou ampliar o prazo.

CREATE OR REPLACE FUNCTION public.set_pix_direct_proof_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_deadline timestamptz := LEAST(
    now() + interval '20 minutes',
    COALESCE(NEW.created_at, now()) + interval '20 minutes'
  );
BEGIN
  IF NEW.payment_method = 'pix_direto' AND NEW.status = 'aguardando_comprovante' THEN
    IF TG_OP = 'INSERT'
       OR OLD.payment_method IS DISTINCT FROM 'pix_direto'
       OR OLD.status IS DISTINCT FROM 'aguardando_comprovante'
       OR OLD.pix_expires_at IS NULL
    THEN
      NEW.pix_expires_at := v_deadline;
    ELSE
      -- O prazo é imutável enquanto o pedido aguarda o comprovante.
      NEW.pix_expires_at := OLD.pix_expires_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pix_direct_proof_deadline ON public.orders;
CREATE TRIGGER trg_set_pix_direct_proof_deadline
  BEFORE INSERT OR UPDATE OF payment_method, status, pix_expires_at ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pix_direct_proof_deadline();

-- Pedidos PIX Direto legados sem prazo ficam inválidos e não podem receber comprovante.
-- Backfill de pedidos legados: usa a criação original, sem ampliar prazo para pedidos antigos.
UPDATE public.orders
   SET pix_expires_at = COALESCE(created_at, now()) + interval '20 minutes'
 WHERE payment_method = 'pix_direto'
   AND status = 'aguardando_comprovante'
   AND pix_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.attach_pix_proof(
  p_order_id uuid,
  p_proof_path text,
  p_anon_session text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_order record;
BEGIN
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.payment_method IS DISTINCT FROM 'pix_direto' THEN
    RAISE EXCEPTION 'Pedido não utiliza PIX Direto';
  END IF;
  IF v_order.status IS DISTINCT FROM 'aguardando_comprovante' THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF v_order.pix_expires_at IS NULL OR now() >= v_order.pix_expires_at THEN
    RAISE EXCEPTION 'Prazo expirado';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF v_order.client_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  ELSE
    IF coalesce(v_order.anon_session_id, '') IS DISTINCT FROM coalesce(p_anon_session, '') THEN
      RAISE EXCEPTION 'Não autorizado';
    END IF;
  END IF;
  IF coalesce(p_proof_path, '') = '' THEN RAISE EXCEPTION 'Comprovante inválido'; END IF;

  UPDATE public.orders
     SET pix_proof_url = p_proof_path,
         pix_proof_uploaded_at = now(),
         status = 'comprovante_enviado'
   WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_pending_pix_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.orders
       SET status = 'cancelado'
     WHERE payment_method = 'pix_direto'
       AND status = 'aguardando_comprovante'
       AND (pix_expires_at IS NULL OR now() >= pix_expires_at)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN coalesce(v_count, 0);
END;
$$;

COMMENT ON COLUMN public.orders.pix_expires_at IS
  'Prazo imutável de 20 minutos para envio do comprovante de PIX Direto, definido pelo servidor.';
COMMENT ON FUNCTION public.attach_pix_proof(uuid, text, text) IS
  'Associa comprovante somente a pedido PIX Direto aguardando comprovante e dentro da janela canônica de 20 minutos.';
COMMENT ON FUNCTION public.expire_pending_pix_orders() IS
  'Cancela pedidos PIX Direto aguardando comprovante quando o prazo canônico de 20 minutos expirou ou está ausente.';
