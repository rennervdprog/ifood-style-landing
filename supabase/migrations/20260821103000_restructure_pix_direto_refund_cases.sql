-- Reestrutura reembolsos do marketplace para PIX Direto confirmado.
-- Pagamentos físicos nunca geram crédito/reembolso na plataforma.
-- PIX Direto é transferido à loja: o caso registra a devolução direta e sua evidência.

CREATE TABLE IF NOT EXISTS public.pix_direto_refund_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  payment_method_snapshot text NOT NULL DEFAULT 'pix_direto' CHECK (payment_method_snapshot = 'pix_direto'),
  payment_confirmed_at timestamptz NOT NULL,
  eligible_amount numeric(12,2) NOT NULL CHECK (eligible_amount >= 0),
  requested_amount numeric(12,2) NOT NULL CHECK (requested_amount >= 0 AND requested_amount <= eligible_amount),
  reason text NOT NULL CHECK (reason IN ('wrong_product', 'missing_items', 'damaged', 'late_delivery', 'poor_quality', 'other', 'cancelled_order')),
  description text,
  evidence_urls text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(evidence_urls) <= 4),
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'under_review', 'refund_due_by_store', 'proof_submitted', 'completed', 'rejected', 'disputed', 'withdrawn')),
  store_response text,
  store_responded_at timestamptz,
  store_responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_amount numeric(12,2) CHECK (refund_amount IS NULL OR (refund_amount > 0 AND refund_amount <= eligible_amount)),
  refund_reference text,
  refund_proof_url text,
  refund_submitted_at timestamptz,
  refund_submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_confirmed_at timestamptz,
  client_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pix_direto_refund_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_case_id uuid NOT NULL REFERENCES public.pix_direto_refund_cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('client', 'store', 'admin', 'system')),
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pix_direto_refund_cases_store_status
  ON public.pix_direto_refund_cases(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pix_direto_refund_cases_requester
  ON public.pix_direto_refund_cases(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pix_direto_refund_events_case
  ON public.pix_direto_refund_events(refund_case_id, created_at ASC);

ALTER TABLE public.pix_direto_refund_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_direto_refund_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own PIX direct refund cases" ON public.pix_direto_refund_cases;
DROP POLICY IF EXISTS "Store owners view PIX direct refund cases" ON public.pix_direto_refund_cases;
DROP POLICY IF EXISTS "Admins view PIX direct refund cases" ON public.pix_direto_refund_cases;
CREATE POLICY "Clients view own PIX direct refund cases"
  ON public.pix_direto_refund_cases FOR SELECT TO authenticated
  USING (requester_id = auth.uid());
CREATE POLICY "Store owners view PIX direct refund cases"
  ON public.pix_direto_refund_cases FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pix_direto_refund_cases.store_id AND s.owner_id = auth.uid()
  ));
CREATE POLICY "Admins view PIX direct refund cases"
  ON public.pix_direto_refund_cases FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Participants view PIX direct refund events" ON public.pix_direto_refund_events;
CREATE POLICY "Participants view PIX direct refund events"
  ON public.pix_direto_refund_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pix_direto_refund_cases c
    WHERE c.id = pix_direto_refund_events.refund_case_id
      AND (
        c.requester_id = auth.uid()
        OR public.is_platform_admin(auth.uid())
        OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = c.store_id AND s.owner_id = auth.uid())
      )
  ));

-- O fluxo legado não pode mais ser aberto diretamente por REST/RLS.
DROP POLICY IF EXISTS "Clients can create refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Store owners can update refund requests" ON public.refund_requests;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.refund_requests FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.process_refund(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pix_direto_refund_log_event(
  p_case_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_event_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.pix_direto_refund_events(refund_case_id, actor_id, actor_role, event_type, details)
  VALUES (p_case_id, p_actor_id, p_actor_role, p_event_type, COALESCE(p_details, '{}'::jsonb));
END;
$$;

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
    jsonb_build_object('payment_method', 'pix_direto', 'eligible_amount', ROUND(COALESCE(v_order.total_price, 0), 2))
  );
  RETURN v_case_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já existe um caso de reembolso para este pedido.';
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_pix_direto_refund_case(
  p_case_id uuid,
  p_approve boolean,
  p_response text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_case public.pix_direto_refund_cases%ROWTYPE;
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_is_store_owner boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória.'; END IF;
  SELECT * INTO v_case FROM public.pix_direto_refund_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado.'; END IF;
  v_is_admin := public.is_platform_admin(v_actor);
  v_is_store_owner := EXISTS (SELECT 1 FROM public.stores s WHERE s.id = v_case.store_id AND s.owner_id = v_actor);
  IF NOT v_is_admin AND NOT v_is_store_owner THEN RAISE EXCEPTION 'Sem permissão para responder este caso.'; END IF;
  IF v_case.status NOT IN ('opened', 'under_review') THEN RAISE EXCEPTION 'Este caso não aceita nova resposta neste estado.'; END IF;

  UPDATE public.pix_direto_refund_cases
     SET status = CASE WHEN p_approve THEN 'refund_due_by_store' ELSE 'rejected' END,
         store_response = NULLIF(btrim(COALESCE(p_response, '')), ''),
         store_responded_at = now(),
         store_responded_by = v_actor,
         resolved_at = CASE WHEN p_approve THEN NULL ELSE now() END,
         resolved_by = CASE WHEN p_approve THEN NULL ELSE v_actor END,
         updated_at = now()
   WHERE id = p_case_id;

  PERFORM public.pix_direto_refund_log_event(
    p_case_id, v_actor, CASE WHEN v_is_admin THEN 'admin' ELSE 'store' END,
    CASE WHEN p_approve THEN 'refund_approved_by_store' ELSE 'refund_rejected_by_store' END,
    jsonb_build_object('response', NULLIF(btrim(COALESCE(p_response, '')), ''))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_pix_direto_refund_proof(
  p_case_id uuid,
  p_refund_amount numeric,
  p_reference text,
  p_proof_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_case public.pix_direto_refund_cases%ROWTYPE;
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_is_store_owner boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória.'; END IF;
  SELECT * INTO v_case FROM public.pix_direto_refund_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado.'; END IF;
  v_is_admin := public.is_platform_admin(v_actor);
  v_is_store_owner := EXISTS (SELECT 1 FROM public.stores s WHERE s.id = v_case.store_id AND s.owner_id = v_actor);
  IF NOT v_is_admin AND NOT v_is_store_owner THEN RAISE EXCEPTION 'Sem permissão para registrar a devolução.'; END IF;
  IF v_case.status <> 'refund_due_by_store' THEN RAISE EXCEPTION 'Este caso não está aguardando devolução pela loja.'; END IF;
  IF p_refund_amount IS NULL OR p_refund_amount <= 0 OR p_refund_amount > v_case.eligible_amount THEN
    RAISE EXCEPTION 'Valor de devolução inválido.';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reference, '')), '') IS NULL AND NULLIF(btrim(COALESCE(p_proof_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a referência ou o comprovante da devolução.';
  END IF;

  UPDATE public.pix_direto_refund_cases
     SET status = 'proof_submitted', refund_amount = ROUND(p_refund_amount, 2),
         refund_reference = NULLIF(btrim(COALESCE(p_reference, '')), ''),
         refund_proof_url = NULLIF(btrim(COALESCE(p_proof_url, '')), ''),
         refund_submitted_at = now(), refund_submitted_by = v_actor, updated_at = now()
   WHERE id = p_case_id;

  PERFORM public.pix_direto_refund_log_event(
    p_case_id, v_actor, CASE WHEN v_is_admin THEN 'admin' ELSE 'store' END,
    'refund_proof_submitted', jsonb_build_object('refund_amount', ROUND(p_refund_amount, 2))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_pix_direto_refund_receipt(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_case public.pix_direto_refund_cases%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória.'; END IF;
  SELECT * INTO v_case FROM public.pix_direto_refund_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado.'; END IF;
  IF v_case.requester_id <> v_actor THEN RAISE EXCEPTION 'Sem permissão para confirmar este recebimento.'; END IF;
  IF v_case.status <> 'proof_submitted' THEN RAISE EXCEPTION 'Não há devolução aguardando confirmação.'; END IF;

  UPDATE public.pix_direto_refund_cases
     SET status = 'completed', client_confirmed_at = now(), client_confirmed_by = v_actor,
         resolved_at = now(), resolved_by = v_actor, updated_at = now()
   WHERE id = p_case_id;
  PERFORM public.pix_direto_refund_log_event(p_case_id, v_actor, 'client', 'refund_receipt_confirmed');
END;
$$;

CREATE OR REPLACE FUNCTION public.dispute_pix_direto_refund_case(
  p_case_id uuid,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_case public.pix_direto_refund_cases%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória.'; END IF;
  SELECT * INTO v_case FROM public.pix_direto_refund_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso não encontrado.'; END IF;
  IF v_case.requester_id <> v_actor THEN RAISE EXCEPTION 'Sem permissão para contestar este caso.'; END IF;
  IF v_case.status NOT IN ('proof_submitted', 'rejected') THEN RAISE EXCEPTION 'Este caso não pode ser contestado neste estado.'; END IF;

  UPDATE public.pix_direto_refund_cases
     SET status = 'disputed', admin_notes = NULLIF(btrim(COALESCE(p_description, '')), ''), updated_at = now()
   WHERE id = p_case_id;
  PERFORM public.pix_direto_refund_log_event(p_case_id, v_actor, 'client', 'case_disputed', jsonb_build_object('description', NULLIF(btrim(COALESCE(p_description, '')), '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_cancellation_policy(
  _order_id uuid,
  _reason text DEFAULT 'Cancelado pelo cliente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor uuid := auth.uid();
  v_direct_pix_confirmed boolean;
  v_case_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória.'; END IF;
  IF v_order.client_id <> v_actor
     AND NOT public.is_platform_admin(v_actor)
     AND NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = v_order.store_id AND s.owner_id = v_actor)
  THEN RAISE EXCEPTION 'Sem permissão para cancelar este pedido.'; END IF;
  IF v_order.status IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedidos entregues/finalizados não podem ser cancelados. Use a solicitação de reembolso quando elegível.';
  END IF;
  IF v_order.status = 'cancelado' THEN RAISE EXCEPTION 'Pedido já está cancelado.'; END IF;

  v_direct_pix_confirmed := v_order.payment_method = 'pix_direto'
    AND v_order.pix_confirmed_at IS NOT NULL
    AND v_order.confirmed_at IS NOT NULL;

  UPDATE public.orders
     SET status = 'cancelado', cancel_reason = COALESCE(_reason, 'Cancelado')
   WHERE id = _order_id;

  IF v_direct_pix_confirmed THEN
    INSERT INTO public.pix_direto_refund_cases (
      order_id, store_id, requester_id, payment_confirmed_at,
      eligible_amount, requested_amount, reason, description, status
    ) VALUES (
      v_order.id, v_order.store_id, v_order.client_id, v_order.pix_confirmed_at,
      ROUND(COALESCE(v_order.total_price, 0), 2), ROUND(COALESCE(v_order.total_price, 0), 2),
      'cancelled_order', 'Pedido cancelado antes da conclusão.', 'refund_due_by_store'
    ) ON CONFLICT (order_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_case_id;

    PERFORM public.pix_direto_refund_log_event(
      v_case_id, v_actor,
      CASE WHEN public.is_platform_admin(v_actor) THEN 'admin' WHEN v_order.client_id = v_actor THEN 'client' ELSE 'store' END,
      'case_opened_from_cancellation', jsonb_build_object('reason', COALESCE(_reason, 'Cancelado'))
    );
  END IF;

  RETURN jsonb_build_object(
    'cancelled', true,
    'payment_method', COALESCE(v_order.payment_method, 'unknown'),
    'refund_amount', 0,
    'refund_method', 'none',
    'requires_store_refund', v_direct_pix_confirmed,
    'refund_case_id', v_case_id,
    'legacy_gateway_refund_required', v_order.payment_method = 'pix'
  );
END;
$$;

-- O crédito automático legado foi aposentado. Mantemos nome apenas para resposta explícita em caso de cliente antigo.
CREATE OR REPLACE FUNCTION public.process_refund(
  _refund_id uuid,
  _approved_amount numeric,
  _admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'Fluxo de crédito automático aposentado. Use os casos de devolução PIX Direto.';
END;
$$;

REVOKE ALL ON FUNCTION public.pix_direto_refund_log_event(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_pix_direto_refund_case(uuid, text, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_pix_direto_refund_case(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_pix_direto_refund_proof(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_pix_direto_refund_receipt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispute_pix_direto_refund_case(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_cancellation_policy(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pix_direto_refund_case(uuid, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_pix_direto_refund_case(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pix_direto_refund_proof(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pix_direto_refund_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_pix_direto_refund_case(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_cancellation_policy(uuid, text) TO authenticated;

COMMENT ON TABLE public.pix_direto_refund_cases IS 'Casos de devolução para PIX Direto confirmado. Não representa crédito de carteira nem estorno automático de gateway.';
COMMENT ON FUNCTION public.create_pix_direto_refund_case(uuid, text, text, text[]) IS 'Abre caso somente para pedido concluído, PIX Direto confirmado e pertencente ao cliente autenticado.';
COMMENT ON FUNCTION public.apply_cancellation_policy(uuid, text) IS 'Cancela pedido sem crédito automático. PIX Direto confirmado abre caso de devolução direta pela loja.';
