-- Retira o plano Autonomia da aquisição de novas lojas e de migrações voluntárias.
-- O suporte operacional para lojas legadas é preservado: nenhum registro existente em
-- stores, store_plans ou histórico financeiro é alterado por esta migration.

BEGIN;

-- O template deixa de ser elegível para novas ofertas e telas que respeitam is_active.
UPDATE public.plan_templates
SET is_active = false
WHERE plan_type::text = 'autonomy'
  AND is_active IS DISTINCT FROM false;

-- A versão curta da RPC é usada pelo fluxo web atual. O plano deve ser explicitamente
-- uma das duas ofertas vigentes; aliases históricos de PDV continuam aceitos para
-- compatibilidade com clientes antigos.
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category store_category,
  _avatar_url text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _selected_plan text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
  _pdv_rate numeric := 2;
  _pix_fee numeric := 1.99;
  _selected_plan_normalized text := lower(trim(coalesce(_selected_plan, '')));
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessao nao encontrada.' USING ERRCODE = '28000';
  END IF;

  IF _selected_plan_normalized NOT IN ('fixed', 'pdv_only', 'pdv', 'somente_pdv') THEN
    RAISE EXCEPTION 'Plano indisponível para novos cadastros. Escolha Essencial ou Somente PDV.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _user_id) THEN
    RAISE EXCEPTION 'Usuario ja possui cadastro de parceiro.';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, public.profiles.whatsapp_number);

  INSERT INTO public.stores (name, category, owner_id, delivery_mode, is_visible, plan_type)
  VALUES (
    _store_name,
    _store_category,
    _user_id,
    'own',
    CASE WHEN _selected_plan_normalized IN ('pdv_only', 'pdv', 'somente_pdv') THEN false ELSE true END,
    CASE WHEN _selected_plan_normalized IN ('pdv_only', 'pdv', 'somente_pdv') THEN 'pdv_only' ELSE 'essencial' END
  )
  RETURNING id INTO _store_id;

  IF _selected_plan_normalized = 'fixed' THEN
    _plan_type := 'fixed';
    _monthly_fee := 0;
    _commission_rate := 0;
  ELSE
    _plan_type := 'pdv_only';
    _monthly_fee := 69;
    _commission_rate := 0;
    _pdv_rate := 0;
  END IF;

  INSERT INTO public.store_plans (
    store_id,
    plan_type,
    monthly_fee,
    commission_rate,
    is_active,
    trial_ends_at,
    platform_delivery_split_override,
    pdv_enabled,
    pdv_commission_rate,
    pdv_fixed_fee_per_sale,
    pix_operational_fee_override
  )
  VALUES (
    _store_id,
    _plan_type,
    _monthly_fee,
    _commission_rate,
    true,
    CASE WHEN _plan_type = 'pdv_only' THEN now() + interval '7 days' ELSE NULL END,
    NULL,
    true,
    _pdv_rate,
    CASE WHEN _plan_type = 'pdv_only' THEN 0 ELSE 1 END,
    _pix_fee
  )
  ON CONFLICT (store_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    monthly_fee = EXCLUDED.monthly_fee,
    commission_rate = EXCLUDED.commission_rate;

  IF _plan_type = 'pdv_only' THEN
    INSERT INTO public.store_addons (store_id, addon_key, status, price_override)
    VALUES (_store_id, 'pdv', 'active', 0)
    ON CONFLICT (store_id, addon_key) DO UPDATE SET
      status = 'active',
      price_override = 0;
  END IF;

  RETURN _store_id;
END;
$$;

-- Há uma sobrecarga usada por fluxos com proteção de IP/dispositivo e validação OTP.
-- Ela recebe a mesma validação de oferta para não deixar um caminho alternativo aceitar
-- Autonomia ou planos já descontinuados.
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
  _skip_otp_check boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
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

  INSERT INTO public.stores (name, category, owner_id, delivery_mode, is_visible)
  VALUES (
    _store_name,
    _store_category,
    _user_id,
    'own',
    CASE WHEN _selected_plan_normalized IN ('pdv_only', 'pdv', 'somente_pdv') THEN false ELSE true END
  )
  RETURNING id INTO _store_id;

  IF _selected_plan_normalized = 'fixed' THEN
    _plan_type := 'fixed';
    _monthly_fee := 0;
    _commission_rate := 0;
  ELSE
    _plan_type := 'pdv_only';
    _monthly_fee := 69;
    _commission_rate := 0;
  END IF;

  INSERT INTO public.store_plans (
    store_id,
    plan_type,
    monthly_fee,
    commission_rate,
    is_active,
    trial_ends_at,
    platform_delivery_split_override,
    pdv_enabled,
    pdv_commission_rate,
    pix_operational_fee_override
  )
  VALUES (
    _store_id,
    _plan_type,
    _monthly_fee,
    _commission_rate,
    true,
    CASE WHEN _plan_type = 'pdv_only' THEN now() + interval '7 days' ELSE NULL END,
    NULL,
    true,
    _pdv_rate,
    _pix_fee
  )
  ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$$;

-- Solicitações de troca são uma superfície distinta do cadastro. Bloquear no banco
-- impede a criação de novos pedidos de migração para Autonomia mesmo se uma interface
-- antiga ou uma chamada direta tentar enviá-los.
CREATE OR REPLACE FUNCTION public.reject_retired_plan_change_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requested_plan_type::text = 'autonomy' THEN
    RAISE EXCEPTION 'O plano Autonomia não está disponível para novas migrações.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_retired_plan_change_request ON public.plan_change_requests;

CREATE TRIGGER trg_reject_retired_plan_change_request
BEFORE INSERT OR UPDATE OF requested_plan_type ON public.plan_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.reject_retired_plan_change_request();

COMMIT;
