// Fase 3 do Sistema de Revenda - RPCs administrativas para o Super Admin
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}

const SQL = `
-- ============================================================
-- Sistema de Revenda - Fase 3: RPCs admin
-- ============================================================

-- admin_reseller_list: lista todos revendedores com métricas
CREATE OR REPLACE FUNCTION public.admin_reseller_list()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  code TEXT,
  status public.reseller_status,
  commission_rate NUMERIC,
  bounty_amount_cents INTEGER,
  pix_key TEXT,
  pix_key_type TEXT,
  total_referrals BIGINT,
  active_referrals BIGINT,
  balance_pending_cents BIGINT,
  total_paid_cents BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
  SELECT
    r.id, r.user_id,
    (SELECT u.email::text FROM auth.users u WHERE u.id = r.user_id),
    r.code, r.status, r.commission_rate, r.bounty_amount_cents,
    r.pix_key, r.pix_key_type,
    (SELECT count(*) FROM public.reseller_referrals rr WHERE rr.reseller_id = r.id),
    (SELECT count(*) FROM public.reseller_referrals rr WHERE rr.reseller_id = r.id AND rr.status='active'),
    COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions c WHERE c.reseller_id = r.id AND c.status='pending'),0),
    COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions c WHERE c.reseller_id = r.id AND c.status='paid'),0),
    r.created_at
  FROM public.resellers r
  ORDER BY r.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_list() TO authenticated;

-- admin_reseller_set_status: aprovar/bloquear
CREATE OR REPLACE FUNCTION public.admin_reseller_set_status(_reseller_id UUID, _status public.reseller_status, _notes TEXT DEFAULT NULL)
RETURNS public.resellers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.resellers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.resellers
  SET status = _status,
      approved_at = CASE WHEN _status='approved' THEN COALESCE(approved_at, now()) ELSE approved_at END,
      approved_by = CASE WHEN _status='approved' THEN COALESCE(approved_by, auth.uid()) ELSE approved_by END,
      notes = COALESCE(_notes, notes),
      updated_at = now()
  WHERE id = _reseller_id
  RETURNING * INTO v_row;

  IF _status = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT v_row.user_id, 'revendedor'
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_set_status(UUID, public.reseller_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_set_status(UUID, public.reseller_status, TEXT) TO authenticated;

-- admin_reseller_update_config: ajustar comissão / bounty
CREATE OR REPLACE FUNCTION public.admin_reseller_update_config(
  _reseller_id UUID,
  _commission_rate NUMERIC DEFAULT NULL,
  _bounty_amount_cents INTEGER DEFAULT NULL,
  _gmv_bonus_rate NUMERIC DEFAULT NULL
)
RETURNS public.resellers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.resellers;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.resellers
  SET commission_rate = COALESCE(_commission_rate, commission_rate),
      bounty_amount_cents = COALESCE(_bounty_amount_cents, bounty_amount_cents),
      gmv_bonus_rate = COALESCE(_gmv_bonus_rate, gmv_bonus_rate),
      updated_at = now()
  WHERE id = _reseller_id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_update_config(UUID, NUMERIC, INTEGER, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_update_config(UUID, NUMERIC, INTEGER, NUMERIC) TO authenticated;

-- admin_reseller_referrals: lista referrals com nome da loja
CREATE OR REPLACE FUNCTION public.admin_reseller_referrals(_reseller_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  reseller_id UUID,
  reseller_code TEXT,
  store_id UUID,
  store_name TEXT,
  status public.reseller_referral_status,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
  SELECT rr.id, rr.reseller_id, r.code, rr.store_id, s.name, rr.status, rr.activated_at, rr.created_at
  FROM public.reseller_referrals rr
  JOIN public.resellers r ON r.id = rr.reseller_id
  LEFT JOIN public.stores s ON s.id = rr.store_id
  WHERE _reseller_id IS NULL OR rr.reseller_id = _reseller_id
  ORDER BY rr.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_referrals(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_referrals(UUID) TO authenticated;

-- admin_reseller_commissions: lista comissões
CREATE OR REPLACE FUNCTION public.admin_reseller_commissions(_reseller_id UUID DEFAULT NULL, _status public.reseller_commission_status DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  reseller_id UUID,
  reseller_code TEXT,
  store_id UUID,
  store_name TEXT,
  type public.reseller_commission_type,
  amount_cents INTEGER,
  reference_month TEXT,
  status public.reseller_commission_status,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
  SELECT c.id, c.reseller_id, r.code, c.store_id, s.name, c.type, c.amount_cents, c.reference_month, c.status, c.paid_at, c.created_at
  FROM public.reseller_commissions c
  JOIN public.resellers r ON r.id = c.reseller_id
  LEFT JOIN public.stores s ON s.id = c.store_id
  WHERE (_reseller_id IS NULL OR c.reseller_id = _reseller_id)
    AND (_status IS NULL OR c.status = _status)
  ORDER BY c.created_at DESC
  LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_commissions(UUID, public.reseller_commission_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_commissions(UUID, public.reseller_commission_status) TO authenticated;

-- admin_reseller_withdrawals: lista solicitações de saque
CREATE OR REPLACE FUNCTION public.admin_reseller_withdrawals(_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  reseller_id UUID,
  reseller_code TEXT,
  reseller_email TEXT,
  amount_cents INTEGER,
  pix_key TEXT,
  pix_key_type TEXT,
  status TEXT,
  admin_notes TEXT,
  asaas_transfer_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
  SELECT w.id, w.reseller_id, r.code,
    (SELECT u.email::text FROM auth.users u WHERE u.id = r.user_id),
    w.amount_cents, w.pix_key, w.pix_key_type, w.status, w.admin_notes, w.asaas_transfer_id, w.processed_at, w.created_at
  FROM public.reseller_withdrawal_requests w
  JOIN public.resellers r ON r.id = w.reseller_id
  WHERE _status IS NULL OR w.status = _status
  ORDER BY w.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_withdrawals(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_withdrawals(TEXT) TO authenticated;

-- admin_reseller_withdrawal_process: aprovar / rejeitar / marcar pago
-- _action IN ('approve','reject','paid')
CREATE OR REPLACE FUNCTION public.admin_reseller_withdrawal_process(
  _withdrawal_id UUID,
  _action TEXT,
  _notes TEXT DEFAULT NULL,
  _asaas_transfer_id TEXT DEFAULT NULL
)
RETURNS public.reseller_withdrawal_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.reseller_withdrawal_requests;
  v_new_status TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _action NOT IN ('approve','reject','paid') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  v_new_status := CASE _action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject'  THEN 'rejected'
    WHEN 'paid'    THEN 'paid'
  END;

  UPDATE public.reseller_withdrawal_requests
  SET status = v_new_status,
      admin_notes = COALESCE(_notes, admin_notes),
      asaas_transfer_id = COALESCE(_asaas_transfer_id, asaas_transfer_id),
      processed_at = CASE WHEN _action IN ('paid','reject') THEN now() ELSE processed_at END,
      processed_by = auth.uid(),
      updated_at = now()
  WHERE id = _withdrawal_id
  RETURNING * INTO v_row;

  -- Quando marcado como pago: baixa as comissões pendentes até o valor
  IF _action = 'paid' THEN
    WITH to_pay AS (
      SELECT c.id, c.amount_cents,
        SUM(c.amount_cents) OVER (ORDER BY c.created_at) AS running
      FROM public.reseller_commissions c
      WHERE c.reseller_id = v_row.reseller_id AND c.status = 'pending'
    )
    UPDATE public.reseller_commissions c
    SET status = 'paid', paid_at = now(), paid_batch_id = v_row.id
    FROM to_pay tp
    WHERE c.id = tp.id AND tp.running <= v_row.amount_cents;
  END IF;

  -- Rejeição: nada a fazer nas comissões (permanecem pendentes)
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_withdrawal_process(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_withdrawal_process(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- admin_reseller_summary: KPIs globais
CREATE OR REPLACE FUNCTION public.admin_reseller_summary()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT jsonb_build_object(
    'total_resellers', (SELECT count(*) FROM public.resellers),
    'pending_resellers', (SELECT count(*) FROM public.resellers WHERE status='pending'),
    'approved_resellers', (SELECT count(*) FROM public.resellers WHERE status='approved'),
    'total_referrals', (SELECT count(*) FROM public.reseller_referrals),
    'active_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE status='active'),
    'pending_commissions_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE status='pending'),0),
    'paid_commissions_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE status='paid'),0),
    'pending_withdrawals', (SELECT count(*) FROM public.reseller_withdrawal_requests WHERE status='pending'),
    'pending_withdrawals_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_withdrawal_requests WHERE status='pending'),0)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_summary() TO authenticated;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const res = await q(SQL);
    return new Response(JSON.stringify({ ok: res.status < 300, status: res.status, body: res.body }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});