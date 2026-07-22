// Fase 2 do Sistema de Revenda:
// - Estende reseller_get_dashboard com commissions e withdrawals
// - Adiciona reseller_request_withdrawal RPC

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
-- Estender reseller_get_dashboard: incluir últimas comissões e saques
CREATE OR REPLACE FUNCTION public.reseller_get_dashboard()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_reseller RECORD; v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_reseller FROM public.resellers WHERE user_id = v_uid;
  IF v_reseller IS NULL THEN RETURN jsonb_build_object('registered', false); END IF;

  SELECT jsonb_build_object(
    'registered', true,
    'reseller', to_jsonb(v_reseller),
    'stats', jsonb_build_object(
      'total_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE reseller_id = v_reseller.id),
      'active_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE reseller_id = v_reseller.id AND status='active'),
      'pending_referrals', (SELECT count(*) FROM public.reseller_referrals WHERE reseller_id = v_reseller.id AND status='pending'),
      'balance_pending_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND status='pending'),0),
      'balance_paid_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND status='paid'),0),
      'earnings_this_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND reference_month = to_char(now(),'YYYY-MM')),0),
      'withdrawn_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_withdrawal_requests WHERE reseller_id = v_reseller.id AND status='paid'),0),
      'pending_withdrawal_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_withdrawal_requests WHERE reseller_id = v_reseller.id AND status IN ('pending','processing')),0)
    ),
    'stores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store_id', s.id,
        'name', s.name,
        'city', s.city,
        'plan_type', sp.plan_type,
        'status', s.status,
        'referral_status', rr.status,
        'activated_at', rr.activated_at,
        'gmv_60d_cents', COALESCE((SELECT (sum(o.total_price)*100)::int FROM public.orders o WHERE o.store_id = s.id AND o.status='entregue' AND o.created_at >= now() - interval '60 days'),0),
        'commissions_total_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND store_id = s.id),0)
      ) ORDER BY rr.created_at DESC)
      FROM public.reseller_referrals rr
      JOIN public.stores s ON s.id = rr.store_id
      LEFT JOIN public.store_plans sp ON sp.store_id = s.id
      WHERE rr.reseller_id = v_reseller.id
    ), '[]'::jsonb),
    'commissions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'kind', type, 'amount_cents', amount_cents, 'status', status,
        'reference_month', reference_month, 'created_at', created_at
      ) ORDER BY created_at DESC)
      FROM (
        SELECT * FROM public.reseller_commissions
        WHERE reseller_id = v_reseller.id
        ORDER BY created_at DESC LIMIT 30
      ) c
    ), '[]'::jsonb),
    'withdrawals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'amount_cents', amount_cents, 'status', status,
        'pix_key', pix_key, 'created_at', created_at, 'paid_at', processed_at
      ) ORDER BY created_at DESC)
      FROM (
        SELECT * FROM public.reseller_withdrawal_requests
        WHERE reseller_id = v_reseller.id
        ORDER BY created_at DESC LIMIT 20
      ) w
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_get_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_get_dashboard() TO authenticated;

-- reseller_request_withdrawal: revendedor solicita saque do saldo pendente
CREATE OR REPLACE FUNCTION public.reseller_request_withdrawal(_amount_cents INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_reseller RECORD; v_available INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount_cents IS NULL OR _amount_cents < 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  SELECT * INTO v_reseller FROM public.resellers WHERE user_id = v_uid;
  IF v_reseller IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_reseller'); END IF;
  IF v_reseller.status <> 'approved' THEN RETURN jsonb_build_object('success', false, 'error', 'not_approved'); END IF;
  IF v_reseller.pix_key IS NULL OR v_reseller.pix_key = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pix');
  END IF;

  -- saldo disponível = comissões pagas ao revendedor menos saques já solicitados
  SELECT
    COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND status IN ('pending','paid')),0)
    - COALESCE((SELECT sum(amount_cents) FROM public.reseller_withdrawal_requests WHERE reseller_id = v_reseller.id AND status IN ('pending','processing','paid')),0)
    INTO v_available;

  IF v_available < _amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'available_cents', v_available);
  END IF;

  INSERT INTO public.reseller_withdrawal_requests(reseller_id, amount_cents, pix_key, pix_key_type, status)
    VALUES (v_reseller.id, _amount_cents, v_reseller.pix_key, COALESCE(v_reseller.pix_key_type,'aleatoria'), 'pending');

  RETURN jsonb_build_object('success', true, 'requested_cents', _amount_cents);
END; $$;
REVOKE ALL ON FUNCTION public.reseller_request_withdrawal(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_request_withdrawal(INTEGER) TO authenticated;

-- Ajustar CHECK do valor mínimo p/ R$50 (5000 cents) já que dashboard usa esse mínimo
ALTER TABLE public.reseller_withdrawal_requests DROP CONSTRAINT IF EXISTS reseller_withdrawal_requests_amount_cents_check;
ALTER TABLE public.reseller_withdrawal_requests ADD CONSTRAINT reseller_withdrawal_requests_amount_cents_check CHECK (amount_cents >= 5000);
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.apply = await q(SQL);
  out.verify = await q(`SELECT proname FROM pg_proc WHERE proname IN ('reseller_get_dashboard','reseller_request_withdrawal') ORDER BY proname;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});