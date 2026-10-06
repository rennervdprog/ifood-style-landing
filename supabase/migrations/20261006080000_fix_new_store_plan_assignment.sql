-- Corrige a corrida entre o trigger de perfil e register_as_lojista.
-- Novos cadastros devem respeitar o plano escolhido; lojas legadas não são alteradas.

CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category public.store_category,
  _avatar_url text DEFAULT NULL::text,
  _whatsapp text DEFAULT NULL::text,
  _selected_plan text DEFAULT NULL::text,
  _ip text DEFAULT NULL::text,
  _device_id text DEFAULT NULL::text,
  _skip_otp_check boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type public.store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
  _split_override numeric := NULL;
  _pdv_rate numeric := 0;
  _pix_fee numeric := 1.99;
  _ip_count int;
  _dev_count int;
  _otp_ok timestamptz;
  _selected_plan_normalized text := lower(trim(coalesce(_selected_plan, '')));
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessao nao encontrada.' USING ERRCODE = '28000';
  END IF;

  IF _selected_plan_normalized NOT IN ('fixed', 'pdv_only', 'pdv', 'somente_pdv') THEN
    RAISE EXCEPTION 'Plano indisponível para novos cadastros. Escolha Essencial ou Somente PDV.'
      USING ERRCODE = '22023';
  END IF;

  IF _ip IS NOT NULL THEN
    SELECT COUNT(*) INTO _ip_count
    FROM public.signup_attempts
    WHERE ip = _ip AND created_at > now() - interval '24 hours';
    IF _ip_count >= 5 THEN
      RAISE EXCEPTION 'Muitas tentativas deste IP nas últimas 24h.';
    END IF;
  END IF;

  IF _device_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _dev_count
    FROM public.signup_attempts
    WHERE device_id = _device_id AND created_at > now() - interval '24 hours';
    IF _dev_count >= 3 THEN
      RAISE EXCEPTION 'Muitas tentativas deste dispositivo nas últimas 24h.';
    END IF;
  END IF;

  INSERT INTO public.signup_attempts (user_id, ip, device_id, created_at)
  VALUES (_user_id, _ip, _device_id, now())
  ON CONFLICT DO NOTHING;

  -- Não reutiliza uma loja legítima já existente. O trigger de perfil pode,
  -- porém, criar a loja durante o INSERT abaixo; essa loja é a própria loja
  -- deste cadastro e deve receber o plano escolhido.
  IF EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _user_id) THEN
    RAISE EXCEPTION 'Usuario ja possui cadastro de parceiro.';
  END IF;

  IF NOT _skip_otp_check AND _whatsapp IS NOT NULL THEN
    SELECT whatsapp_verified_at INTO _otp_ok
    FROM public.profiles
    WHERE user_id = _user_id;
    IF _otp_ok IS NULL OR _otp_ok < now() - interval '1 hour' THEN
      RAISE EXCEPTION 'WhatsApp não verificado. Confirme o código enviado antes de continuar.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, public.profiles.whatsapp_number);

  -- O trigger ensure_lojista_has_store pode ter criado esta loja como fallback.
  SELECT id INTO _store_id
  FROM public.stores
  WHERE owner_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _store_id IS NULL THEN
    INSERT INTO public.stores (name, category, owner_id, delivery_mode, is_visible)
    VALUES (
      _store_name,
      _store_category,
      _user_id,
      'own',
      CASE WHEN _selected_plan_normalized IN ('pdv_only', 'pdv', 'somente_pdv') THEN false ELSE true END
    )
    RETURNING id INTO _store_id;
  ELSE
    UPDATE public.stores
    SET name = COALESCE(NULLIF(trim(_store_name), ''), name),
        category = COALESCE(category, _store_category),
        delivery_mode = COALESCE(delivery_mode, 'own'),
        is_visible = CASE
          WHEN _selected_plan_normalized IN ('pdv_only', 'pdv', 'somente_pdv') THEN false
          ELSE COALESCE(is_visible, true)
        END
    WHERE id = _store_id;
  END IF;

  IF _selected_plan_normalized = 'fixed' THEN
    _plan_type := 'fixed'::public.store_plan_type;
    _monthly_fee := 0.00;
    _commission_rate := 0.00;
    _pdv_rate := 0.00;
  ELSE
    _plan_type := 'pdv_only'::public.store_plan_type;
    _monthly_fee := 69.00;
    _commission_rate := 0.00;
    _pdv_rate := 0.00;
  END IF;

  INSERT INTO public.store_plans (
    store_id, plan_type, monthly_fee, commission_rate, is_active,
    trial_ends_at, platform_delivery_split_override,
    pdv_enabled, pdv_commission_rate, pix_operational_fee_override,
    revenue_threshold, upgrade_monthly_fee, upgrade_trigger_months,
    months_above_threshold, upgraded_at, upgrade_notified_at,
    essencial_upgrade_scheduled_at, essencial_upgrade_notified_at
  )
  VALUES (
    _store_id,
    _plan_type,
    _monthly_fee,
    _commission_rate,
    true,
    CASE WHEN _plan_type = 'pdv_only' THEN now() + interval '7 days' ELSE NULL END,
    _split_override,
    true,
    _pdv_rate,
    CASE WHEN _plan_type = 'fixed' THEN _pix_fee ELSE NULL END,
    CASE WHEN _plan_type = 'fixed' THEN 5000.00 ELSE NULL END,
    CASE WHEN _plan_type = 'fixed' THEN 89.90 ELSE NULL END,
    CASE WHEN _plan_type = 'fixed' THEN 1 ELSE NULL END,
    0,
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (store_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    monthly_fee = EXCLUDED.monthly_fee,
    commission_rate = EXCLUDED.commission_rate,
    is_active = true,
    trial_ends_at = EXCLUDED.trial_ends_at,
    platform_delivery_split_override = EXCLUDED.platform_delivery_split_override,
    pdv_enabled = EXCLUDED.pdv_enabled,
    pdv_commission_rate = EXCLUDED.pdv_commission_rate,
    pix_operational_fee_override = EXCLUDED.pix_operational_fee_override,
    revenue_threshold = EXCLUDED.revenue_threshold,
    upgrade_monthly_fee = EXCLUDED.upgrade_monthly_fee,
    upgrade_trigger_months = EXCLUDED.upgrade_trigger_months,
    months_above_threshold = EXCLUDED.months_above_threshold,
    upgraded_at = EXCLUDED.upgraded_at,
    upgrade_notified_at = EXCLUDED.upgrade_notified_at,
    essencial_upgrade_scheduled_at = EXCLUDED.essencial_upgrade_scheduled_at,
    essencial_upgrade_notified_at = EXCLUDED.essencial_upgrade_notified_at,
    updated_at = now();

  RETURN _store_id;
END;
$function$;

-- Repara somente o padrão inconsistente criado pelo fallback para lojas novas:
-- a coluna stores.plan_type é Essencial, mas store_plans ficou no legado de 6%.
UPDATE public.store_plans sp
SET plan_type = 'fixed'::public.store_plan_type,
    monthly_fee = 0.00,
    commission_rate = 0.00,
    is_active = true,
    trial_ends_at = NULL,
    pdv_enabled = true,
    pdv_commission_rate = 0.00,
    pix_operational_fee_override = 1.99,
    revenue_threshold = 5000.00,
    upgrade_monthly_fee = 89.90,
    upgrade_trigger_months = 1,
    months_above_threshold = 0,
    upgraded_at = NULL,
    upgrade_notified_at = NULL,
    essencial_upgrade_scheduled_at = NULL,
    essencial_upgrade_notified_at = NULL,
    updated_at = now()
FROM public.stores s
WHERE s.id = sp.store_id
  AND s.plan_type = 'essencial'
  AND sp.plan_type = 'commission_only'
  AND sp.commission_rate = 6.00
  AND sp.monthly_fee = 0.00
  AND sp.is_active = true;
