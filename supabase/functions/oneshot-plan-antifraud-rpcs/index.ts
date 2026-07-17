const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

const SQL = `
-- =========================================================
-- Helper interno: aplica troca de plano (compartilhado)
-- =========================================================
CREATE OR REPLACE FUNCTION public._apply_plan_change(
  _store_id UUID,
  _new_plan store_plan_type,
  _new_fee NUMERIC,
  _new_commission NUMERIC,
  _prorata_credit NUMERIC DEFAULT 0,
  _source TEXT DEFAULT 'admin_approval',
  _actor UUID DEFAULT NULL,
  _from_plan store_plan_type DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _credit_cents INTEGER := COALESCE(ROUND(_prorata_credit * 100)::INTEGER, 0);
BEGIN
  UPDATE public.store_plans SET
    plan_type = _new_plan,
    monthly_fee = _new_fee,
    commission_rate = _new_commission,
    billing_credit_cents = COALESCE(billing_credit_cents, 0) + GREATEST(_credit_cents, 0),
    last_billed_at = now(),
    next_billing_date = (now() + interval '30 days')::date,
    updated_at = now()
  WHERE store_id = _store_id AND is_active = true;

  INSERT INTO public.admin_logs(action, target_store_id, metadata, actor_user_id)
  VALUES(
    'plan_change_applied',
    _store_id,
    jsonb_build_object(
      'from_plan', _from_plan,
      'to_plan', _new_plan,
      'monthly_fee', _new_fee,
      'commission_rate', _new_commission,
      'prorata_credit', _prorata_credit,
      'source', _source
    ),
    _actor
  );
END;
$$;

-- =========================================================
-- approve_plan_change v2 — aplica prorata, reseta ciclo, loga
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req record;
  _current_plan store_plan_type;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar mudanças de plano.';
  END IF;

  SELECT * INTO _req FROM plan_change_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  SELECT plan_type INTO _current_plan FROM store_plans WHERE store_id = _req.store_id AND is_active = true;

  PERFORM public._apply_plan_change(
    _req.store_id,
    _req.requested_plan_type,
    _req.requested_monthly_fee,
    _req.requested_commission_rate,
    COALESCE(_req.prorata_credit, 0),
    'admin_approval',
    auth.uid(),
    _current_plan
  );

  UPDATE plan_change_requests SET
    status = 'approved',
    admin_notes = COALESCE(_admin_notes, admin_notes),
    processed_at = now()
  WHERE id = _request_id;
END;
$$;

-- =========================================================
-- reject_plan_change v2 — loga
-- =========================================================
CREATE OR REPLACE FUNCTION public.reject_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req record;
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

  INSERT INTO public.admin_logs(action, target_store_id, metadata, actor_user_id)
  VALUES('plan_change_rejected', _req.store_id, jsonb_build_object(
    'requested_plan', _req.requested_plan_type,
    'monthly_fee', _req.requested_monthly_fee,
    'reason', _admin_notes
  ), auth.uid());
END;
$$;

-- =========================================================
-- register_as_lojista v2 — IP/device rate-limit + OTP obrigatório
-- =========================================================
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category store_category,
  _avatar_url text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _selected_plan text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _device_id text DEFAULT NULL,
  _skip_otp_check boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
  _split_override numeric := NULL;
  _pdv_rate numeric := 0;
  _pix_fee numeric := 1.99;
  _ip_count int;
  _dev_count int;
  _otp_ok timestamptz;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Sessao nao encontrada.' USING ERRCODE='28000'; END IF;

  -- Rate-limit por IP e device (24h)
  IF _ip IS NOT NULL THEN
    SELECT COUNT(*) INTO _ip_count FROM signup_attempts WHERE ip = _ip AND created_at > now() - interval '24 hours';
    IF _ip_count >= 5 THEN RAISE EXCEPTION 'Muitas tentativas deste IP nas últimas 24h.'; END IF;
  END IF;
  IF _device_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _dev_count FROM signup_attempts WHERE device_id = _device_id AND created_at > now() - interval '24 hours';
    IF _dev_count >= 3 THEN RAISE EXCEPTION 'Muitas tentativas deste dispositivo nas últimas 24h.'; END IF;
  END IF;

  -- Registra tentativa (mesmo que falhe depois)
  INSERT INTO signup_attempts(user_id, ip, device_id, created_at)
  VALUES(_user_id, _ip, _device_id, now())
  ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM stores WHERE owner_id=_user_id) THEN
    RAISE EXCEPTION 'Usuario ja possui cadastro de parceiro.';
  END IF;

  -- Exige WhatsApp verificado por OTP (a menos que explicitamente pulado — legacy)
  IF NOT _skip_otp_check AND _whatsapp IS NOT NULL THEN
    SELECT whatsapp_verified_at INTO _otp_ok FROM profiles WHERE user_id = _user_id;
    IF _otp_ok IS NULL OR _otp_ok < now() - interval '1 hour' THEN
      RAISE EXCEPTION 'WhatsApp não verificado. Confirme o código enviado antes de continuar.' USING ERRCODE='P0001';
    END IF;
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id,_full_name,'lojista',_document,_avatar_url,_whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name=EXCLUDED.full_name, role='lojista', document=EXCLUDED.document,
    avatar_url=COALESCE(EXCLUDED.avatar_url,profiles.avatar_url),
    whatsapp_number=COALESCE(EXCLUDED.whatsapp_number,profiles.whatsapp_number);

  INSERT INTO stores (name, category, owner_id, delivery_mode, is_visible)
  VALUES (_store_name,_store_category,_user_id,'own',
    CASE WHEN _selected_plan='pdv_only' THEN false ELSE true END)
  RETURNING id INTO _store_id;

  IF _selected_plan='fixed' THEN
    _plan_type:='fixed'; _monthly_fee:=0.00; _commission_rate:=0.00;
  ELSIF _selected_plan='autonomy' THEN
    _plan_type:='autonomy'; _monthly_fee:=0.00; _commission_rate:=0.00; _split_override:=0.00;
  ELSIF _selected_plan IN ('supporter','apoiador') THEN
    _plan_type:='supporter'; _monthly_fee:=75.00; _commission_rate:=0.00;
  ELSIF _selected_plan='hybrid' THEN
    _plan_type:='hybrid'; _monthly_fee:=50.00; _commission_rate:=2.5; _pdv_rate:=2;
  ELSIF _selected_plan='pdv_only' THEN
    _plan_type:='pdv_only'; _monthly_fee:=69.00; _commission_rate:=0.00;
  ELSE
    _plan_type:='commission_only'; _monthly_fee:=0.00; _commission_rate:=6.0; _pdv_rate:=2;
  END IF;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active,
    trial_ends_at, platform_delivery_split_override, pdv_enabled, pdv_commission_rate, pix_operational_fee_override)
  VALUES (_store_id, _plan_type, _monthly_fee, _commission_rate, true,
    CASE WHEN _plan_type IN ('hybrid','supporter','pdv_only') THEN now() + interval '7 days' ELSE NULL END,
    _split_override, true, _pdv_rate, _pix_fee)
  ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(JSON.stringify({ status: r.status, body: await r.text() }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});