// v1.23.4 — Fase 5.6 + regra de saque
//  A) Trigger reseller_locked_at: quando referral vira 'active', trava vínculo em stores.
//  B) reseller_request_withdrawal: mínimo R$ 100 + cooldown 7 dias entre saques do mesmo revendedor.
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
-- A) Coluna + trigger de lock
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS reseller_locked_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public._reseller_lock_store_on_activation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') AND NEW.activated_at IS NOT NULL THEN
    UPDATE public.stores
    SET reseller_locked_at = now()
    WHERE id = NEW.store_id AND reseller_locked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reseller_lock_store_on_activation ON public.reseller_referrals;
CREATE TRIGGER trg_reseller_lock_store_on_activation
  AFTER UPDATE ON public.reseller_referrals
  FOR EACH ROW EXECUTE FUNCTION public._reseller_lock_store_on_activation();

-- B) Saque: mínimo R$ 100 + cooldown 7 dias
CREATE OR REPLACE FUNCTION public.reseller_request_withdrawal(_amount_cents INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_reseller RECORD;
  v_available INTEGER;
  v_last TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount_cents IS NULL OR _amount_cents < 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount', 'min_cents', 10000);
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
  SELECT max(created_at) INTO v_last FROM public.reseller_withdrawal_requests
    WHERE reseller_id = v_reseller.id AND status IN ('paid','processing');
  IF v_last IS NOT NULL AND v_last > now() - interval '7 days' THEN
    RETURN jsonb_build_object('success', false, 'error', 'cooldown_active',
      'next_allowed_at', to_char(v_last + interval '7 days', 'YYYY-MM-DD"T"HH24:MI:SSOF'));
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
END $$;
`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const r = await q(SQL);
  return new Response(JSON.stringify({ ok: r.status < 300, status: r.status, body: r.body }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});