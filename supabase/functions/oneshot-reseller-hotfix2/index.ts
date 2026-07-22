// Hotfix2:
//  A) SECURITY: policy resellers_self_pix_update permitia revendedor alterar
//     commission_rate próprio (só travava status). Trocamos por RPC dedicada.
//  B) BUG: reseller_get_dashboard referenciava s.city (coluna inexistente).
//     Uso address_city como fallback.
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
-- A) Remove policy insegura, cria RPC controlada
DROP POLICY IF EXISTS "resellers_self_pix_update" ON public.resellers;

CREATE OR REPLACE FUNCTION public.reseller_update_pix(_pix_key TEXT, _pix_key_type TEXT)
RETURNS public.resellers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_row public.resellers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pix_key IS NULL OR length(trim(_pix_key)) < 3 THEN RAISE EXCEPTION 'invalid_pix_key'; END IF;
  IF _pix_key_type NOT IN ('cpf','cnpj','email','phone','random') THEN RAISE EXCEPTION 'invalid_pix_key_type'; END IF;
  UPDATE public.resellers
     SET pix_key = _pix_key, pix_key_type = _pix_key_type, updated_at = now()
   WHERE user_id = v_uid
  RETURNING * INTO v_row;
  IF v_row IS NULL THEN RAISE EXCEPTION 'reseller_not_found'; END IF;
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.reseller_update_pix(TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_update_pix(TEXT,TEXT) TO authenticated;

-- B) Corrige dashboard: usa coalesce address_city / city_slug (colunas reais)
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
        'city', COALESCE(s.address_city, s.city_slug),
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
`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const r = await q(SQL);
  return new Response(JSON.stringify({ ok: r.status < 300, status: r.status, body: r.body }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});