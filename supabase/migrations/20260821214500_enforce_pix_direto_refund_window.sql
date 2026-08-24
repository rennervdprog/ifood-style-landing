-- Limita a abertura de novos casos de devolução PIX Direto a 24 horas após a conclusão do pedido.
-- Cancelamentos antes da entrega continuam sob apply_cancellation_policy e não usam esta janela.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_request_expires_at timestamptz;

-- Pedidos já concluídos não tinham um marcador de entrega próprio. Para não deixá-los
-- elegíveis indefinidamente, usa-se a melhor marca temporal legada disponível.
UPDATE public.orders
   SET refund_request_expires_at = COALESCE(confirmed_at, created_at) + interval '24 hours'
 WHERE status IN ('entregue', 'finalizado')
   AND refund_request_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_refund_request_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  -- Registra uma única vez a conclusão do pedido. Transições posteriores não reiniciam o prazo.
  IF NEW.status IN ('entregue', 'finalizado')
     AND NEW.refund_request_expires_at IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    NEW.refund_request_expires_at := now() + interval '24 hours';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_refund_request_window ON public.orders;
CREATE TRIGGER trg_set_refund_request_window
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_refund_request_window();

CREATE INDEX IF NOT EXISTS idx_orders_refund_request_expires_at
  ON public.orders(refund_request_expires_at)
  WHERE refund_request_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_pix_direto_refund_case(
  p_order_id uuid,
  p_reason text,
  p_description text DEFAULT NULL,
  p_evidence_urls text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_case_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;
  IF cardinality(COALESCE(p_evidence_urls, '{}'::text[])) > 4 THEN
    RAISE EXCEPTION 'Envie no máximo quatro evidências.';
  END IF;
  IF p_reason NOT IN ('wrong_product', 'missing_items', 'damaged', 'late_delivery', 'poor_quality', 'other') THEN
    RAISE EXCEPTION 'Motivo de reembolso inválido.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_order.client_id <> v_actor THEN RAISE EXCEPTION 'Sem permissão para abrir este caso.'; END IF;
  IF v_order.payment_method <> 'pix_direto' THEN
    RAISE EXCEPTION 'Somente pedidos pagos por PIX Direto confirmado podem solicitar reembolso pela plataforma.';
  END IF;
  IF v_order.pix_confirmed_at IS NULL OR v_order.confirmed_at IS NULL THEN
    RAISE EXCEPTION 'O PIX Direto ainda não foi confirmado pela loja.';
  END IF;
  IF v_order.status NOT IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'A solicitação de reembolso está disponível após a conclusão do pedido.';
  END IF;
  IF v_order.refund_request_expires_at IS NULL OR v_order.refund_request_expires_at <= now() THEN
    RAISE EXCEPTION 'O prazo de 24 horas após a conclusão do pedido para solicitar reembolso expirou.';
  END IF;

  INSERT INTO public.pix_direto_refund_cases (
    order_id, store_id, requester_id, payment_confirmed_at,
    eligible_amount, requested_amount, reason, description, evidence_urls, status
  ) VALUES (
    v_order.id, v_order.store_id, v_order.client_id, v_order.pix_confirmed_at,
    ROUND(COALESCE(v_order.total_price, 0), 2), ROUND(COALESCE(v_order.total_price, 0), 2),
    p_reason, NULLIF(btrim(COALESCE(p_description, '')), ''), COALESCE(p_evidence_urls, '{}'::text[]), 'opened'
  ) RETURNING id INTO v_case_id;

  PERFORM public.pix_direto_refund_log_event(
    v_case_id, v_actor, 'client', 'case_opened',
    jsonb_build_object(
      'payment_method', 'pix_direto',
      'eligible_amount', ROUND(COALESCE(v_order.total_price, 0), 2),
      'refund_request_expires_at', v_order.refund_request_expires_at
    )
  );
  RETURN v_case_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já existe um caso de reembolso para este pedido.';
END;
$$;

COMMENT ON COLUMN public.orders.refund_request_expires_at IS
  'Prazo imutável para abertura de um caso PIX Direto: 24 horas após a primeira conclusão do pedido.';
COMMENT ON FUNCTION public.create_pix_direto_refund_case(uuid, text, text, text[]) IS
  'Abre caso somente para PIX Direto confirmado, pedido concluído do cliente autenticado e dentro de 24 horas da conclusão.';
