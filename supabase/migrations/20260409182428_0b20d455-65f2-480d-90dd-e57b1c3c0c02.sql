-- Plan change requests table
CREATE TABLE public.plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  current_plan_type store_plan_type NOT NULL,
  current_monthly_fee numeric NOT NULL DEFAULT 0,
  requested_plan_type store_plan_type NOT NULL,
  requested_monthly_fee numeric NOT NULL DEFAULT 0,
  requested_commission_rate numeric NOT NULL DEFAULT 0,
  prorata_credit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

-- Store owners can read their own requests
CREATE POLICY "Store owners can read own plan requests"
ON public.plan_change_requests FOR SELECT
TO authenticated
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Store owners can insert requests for own stores
CREATE POLICY "Store owners can request plan changes"
ON public.plan_change_requests FOR INSERT
TO authenticated
WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Admin can do everything
CREATE POLICY "Admin can manage all plan requests"
ON public.plan_change_requests FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Function to calculate prorata credit
CREATE OR REPLACE FUNCTION public.calculate_prorata_credit(_store_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _plan record;
  _days_in_cycle integer := 30;
  _days_used integer;
  _daily_rate numeric;
  _credit numeric;
BEGIN
  SELECT * INTO _plan FROM store_plans
  WHERE store_id = _store_id AND is_active = true LIMIT 1;

  IF NOT FOUND OR _plan.monthly_fee <= 0 THEN
    RETURN 0;
  END IF;

  -- Calculate days used since last billing or start
  _days_used := LEAST(
    EXTRACT(DAY FROM (now() - COALESCE(_plan.last_billed_at, _plan.started_at)))::integer,
    _days_in_cycle
  );

  _daily_rate := _plan.monthly_fee / _days_in_cycle;
  _credit := GREATEST(0, ROUND((_days_in_cycle - _days_used) * _daily_rate, 2));

  RETURN _credit;
END;
$$;

-- Function to approve and apply plan change
CREATE OR REPLACE FUNCTION public.approve_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _req record;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar mudanças de plano.';
  END IF;

  SELECT * INTO _req FROM plan_change_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  -- Update the store plan
  UPDATE store_plans SET
    plan_type = _req.requested_plan_type,
    monthly_fee = _req.requested_monthly_fee,
    commission_rate = _req.requested_commission_rate,
    updated_at = now()
  WHERE store_id = _req.store_id AND is_active = true;

  -- Mark request as approved
  UPDATE plan_change_requests SET
    status = 'approved',
    admin_notes = COALESCE(_admin_notes, admin_notes),
    processed_at = now()
  WHERE id = _request_id;
END;
$$;

-- Function to reject plan change
CREATE OR REPLACE FUNCTION public.reject_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _req record;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar mudanças de plano.';
  END IF;

  SELECT * INTO _req FROM plan_change_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  UPDATE plan_change_requests SET
    status = 'rejected',
    admin_notes = COALESCE(_admin_notes, admin_notes),
    processed_at = now()
  WHERE id = _request_id;
END;
$$;