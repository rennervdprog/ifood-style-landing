-- Permitir que a transição false->true de is_approved não seja bloqueada (apenas bloquear true->false e mudanças de role)
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio cargo.';
    END IF;
    -- Permitir auto-aprovação (false -> true), mas bloquear remover aprovação (true -> false)
    IF OLD.is_approved = true AND NEW.is_approved = false THEN
      RAISE EXCEPTION 'Não é permitido remover o próprio status de aprovação.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Atualizar handle_new_user para auto-aprovar lojistas
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.partner_role;
  _full_name text;
  _document text;
  _vehicle text;
  _whatsapp text;
  _phone text;
  _store_name text;
  _store_category text;
  _city text;
  _cep text;
  _street text;
  _neighborhood text;
  _pix_type text;
  _pix_key text;
  _selected_plan text;
  _driver_type text;
  _new_store_id uuid;
  _supporter_count integer;
  _auto_approve boolean;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.partner_role, 'cliente');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _document := NEW.raw_user_meta_data->>'document';
  _vehicle := NEW.raw_user_meta_data->>'vehicle';
  _whatsapp := NEW.raw_user_meta_data->>'whatsapp';
  _phone := NEW.raw_user_meta_data->>'phone';
  _store_name := NEW.raw_user_meta_data->>'store_name';
  _store_category := NEW.raw_user_meta_data->>'store_category';
  _city := COALESCE(NEW.raw_user_meta_data->>'city', 'itatinga');
  _cep := NEW.raw_user_meta_data->>'cep';
  _street := NEW.raw_user_meta_data->>'street';
  _neighborhood := NEW.raw_user_meta_data->>'neighborhood';
  _pix_type := NEW.raw_user_meta_data->>'pix_type';
  _pix_key := NEW.raw_user_meta_data->>'pix_key';
  _selected_plan := NEW.raw_user_meta_data->>'selected_plan';
  _driver_type := COALESCE(NEW.raw_user_meta_data->>'driver_type', 'platform');

  _auto_approve := (_role = 'lojista');

  IF _selected_plan = 'supporter' THEN
    SELECT COUNT(*) INTO _supporter_count
    FROM public.store_plans
    WHERE plan_type = 'fixed' AND monthly_fee = 130 AND is_active = true;
    IF _supporter_count >= 10 THEN
      _selected_plan := 'fixed';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone, email, city, cep, street, neighborhood, pix_type, pix_key, is_approved)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone, NEW.email, _city, _cep, _street, _neighborhood,
    CASE WHEN _pix_type IS NOT NULL THEN _pix_type::public.pix_type ELSE NULL END,
    _pix_key,
    _auto_approve)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    document = COALESCE(EXCLUDED.document, profiles.document),
    vehicle = COALESCE(EXCLUDED.vehicle, profiles.vehicle),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    city = COALESCE(EXCLUDED.city, profiles.city),
    cep = COALESCE(EXCLUDED.cep, profiles.cep),
    street = COALESCE(EXCLUDED.street, profiles.street),
    neighborhood = COALESCE(EXCLUDED.neighborhood, profiles.neighborhood),
    pix_type = COALESCE(EXCLUDED.pix_type, profiles.pix_type),
    pix_key = COALESCE(EXCLUDED.pix_key, profiles.pix_key),
    is_approved = (profiles.is_approved OR EXCLUDED.is_approved);

  IF _role = 'motoboy' AND _driver_type != 'store' THEN
    INSERT INTO public.drivers (user_id, name, is_active, city)
    VALUES (NEW.id, _full_name, false, _city)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF _role = 'lojista' AND _store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, category, owner_id, status, address_city, delivery_mode, address_cep, address_street, address_neighborhood)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'ativo', _city, 'own', _cep, _street, _neighborhood)
    RETURNING id INTO _new_store_id;

    IF _new_store_id IS NOT NULL THEN
      INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
      VALUES (
        _new_store_id,
        CASE
          WHEN _selected_plan = 'supporter' THEN 'fixed'::public.store_plan_type
          WHEN _selected_plan = 'fixed' THEN 'fixed'::public.store_plan_type
          WHEN _selected_plan = 'hybrid' THEN 'hybrid'::public.store_plan_type
          ELSE 'commission_only'::public.store_plan_type
        END,
        CASE
          WHEN _selected_plan = 'supporter' THEN 130
          WHEN _selected_plan = 'fixed' THEN 180
          WHEN _selected_plan = 'hybrid' THEN 100
          ELSE 0
        END,
        CASE
          WHEN _selected_plan IN ('supporter', 'fixed') THEN 0
          WHEN _selected_plan = 'hybrid' THEN 2.5
          ELSE 6
        END,
        true,
        CASE
          WHEN _selected_plan IN ('supporter', 'fixed', 'hybrid') THEN now() + interval '7 days'
          ELSE NULL
        END
      )
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: aprovar lojistas pendentes
UPDATE public.profiles
SET is_approved = true
WHERE role = 'lojista' AND is_approved = false;

-- Backfill: ativar lojas em análise
UPDATE public.stores
SET status = 'ativo'
WHERE status = 'analise';