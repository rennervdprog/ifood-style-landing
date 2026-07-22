// Hotfix3:
//  A) BUG: reseller_get_dashboard ainda referenciava s.city_slug (também inexistente).
//     Removido — usa apenas s.address_city.
//  B) BUG (regra): reseller_request_withdrawal permitia múltiplos saques pending
//     em aberto. Plano diz "second pending → already_pending".
//  C) BUG (payout): admin_reseller_withdrawal_process (_action='paid') não
//     fechava comissões quando a comissão individual era > amount do saque.
//     Trocamos por: ao marcar pago, fecha TODAS as pendentes daquele revendedor
//     (modelo "close book" — o valor do saque já foi validado como <= saldo).
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
-- A) dashboard sem city_slug
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
      'earnings_this_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND reference_month = to_char(now(),'YYYY-MM')),0)
    ),
    'stores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store_id', s.id,
        'name', s.name,
        'city', s.address_city,
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
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- B) reject múltiplos pending
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
  IF EXISTS (SELECT 1 FROM public.reseller_withdrawal_requests WHERE reseller_id = v_reseller.id AND status IN ('pending','processing','approved')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_pending');
  END IF;
  SELECT
    COALESCE((SELECT sum(amount_cents) FROM public.reseller_commissions WHERE reseller_id = v_reseller.id AND status IN ('pending','paid')),0)
    - COALESCE((SELECT sum(amount_cents) FROM public.reseller_withdrawal_requests WHERE reseller_id = v_reseller.id AND status IN ('pending','processing','approved','paid')),0)
    INTO v_available;
  IF v_available < _amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'available_cents', v_available);
  END IF;
  INSERT INTO public.reseller_withdrawal_requests(reseller_id, amount_cents, pix_key, pix_key_type, status)
    VALUES (v_reseller.id, _amount_cents, v_reseller.pix_key, COALESCE(v_reseller.pix_key_type,'aleatoria'), 'pending');
  RETURN jsonb_build_object('success', true, 'requested_cents', _amount_cents);
END; $$;

-- C) payout fecha TODAS as comissões pending do revendedor quando marca como pago
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
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _action NOT IN ('approve','reject','paid') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  v_new_status := CASE _action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'paid' THEN 'paid' END;

  UPDATE public.reseller_withdrawal_requests
  SET status = v_new_status,
      admin_notes = COALESCE(_notes, admin_notes),
      asaas_transfer_id = COALESCE(_asaas_transfer_id, asaas_transfer_id),
      processed_at = CASE WHEN _action IN ('paid','reject') THEN now() ELSE processed_at END,
      processed_by = auth.uid(),
      updated_at = now()
  WHERE id = _withdrawal_id
  RETURNING * INTO v_row;

  IF _action = 'paid' THEN
    UPDATE public.reseller_commissions
    SET status = 'paid', paid_at = now(), paid_batch_id = v_row.id
    WHERE reseller_id = v_row.reseller_id AND status = 'pending';
  END IF;
  RETURN v_row;
END $$;
`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const r = await q(SQL);
  return new Response(JSON.stringify({ ok: r.status < 300, status: r.status, body: r.body }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});