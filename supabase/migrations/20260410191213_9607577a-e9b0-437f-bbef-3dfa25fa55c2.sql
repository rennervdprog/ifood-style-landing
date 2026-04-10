
-- Update get_store_commission_rate fallback from 15 to 5
CREATE OR REPLACE FUNCTION public.get_store_commission_rate(_store_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT CASE WHEN sp.plan_type = 'fixed' THEN 0 ELSE sp.commission_rate END
     FROM public.store_plans sp
     WHERE sp.store_id = _store_id AND sp.is_active = true
     LIMIT 1),
    COALESCE((SELECT s.commission_rate FROM public.stores s WHERE s.id = _store_id), 5)
  )
$function$;

-- Update handle_new_user to use 5% for commission_only plan
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
  _delivery_mode text;
  _pix_type text;
  _pix_key text;
  _selected_plan text;
  _new_store_id uuid;
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

  _delivery_mode := CASE WHEN lower(trim(_city)) = 'itatinga' THEN 'platform' ELSE 'own' END;

  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone, email, city, cep, street, neighborhood, pix_type, pix_key)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone, NEW.email, _city, _cep, _street, _neighborhood,
    CASE WHEN _pix_type IS NOT NULL THEN _pix_type::public.pix_type ELSE NULL END,
    _pix_key)
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
    pix_key = COALESCE(EXCLUDED.pix_key, profiles.pix_key);

  IF _role = 'motoboy' THEN
    INSERT INTO public.drivers (user_id, name, is_active, city)
    VALUES (NEW.id, _full_name, false, _city)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF _role = 'lojista' AND _store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, category, owner_id, status, address_city, delivery_mode, address_cep, address_street, address_neighborhood)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'analise', _city, _delivery_mode, _cep, _street, _neighborhood)
    RETURNING id INTO _new_store_id;

    IF _new_store_id IS NOT NULL THEN
      INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
      VALUES (
        _new_store_id,
        CASE
          WHEN _selected_plan = 'fixed' THEN 'fixed'::public.store_plan_type
          WHEN _selected_plan = 'hybrid' THEN 'hybrid'::public.store_plan_type
          ELSE 'commission_only'::public.store_plan_type
        END,
        CASE
          WHEN _selected_plan = 'fixed' THEN 180
          WHEN _selected_plan = 'hybrid' THEN 100
          ELSE 0
        END,
        CASE
          WHEN _selected_plan = 'fixed' THEN 0
          WHEN _selected_plan = 'hybrid' THEN 2.5
          ELSE 5
        END,
        true,
        now() + interval '7 days'
      )
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update register_as_lojista (version with _selected_plan param)
CREATE OR REPLACE FUNCTION public.register_as_lojista(_full_name text, _document text, _store_name text, _store_category store_category, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text, _selected_plan text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO stores (name, category, owner_id)
  VALUES (_store_name, _store_category, _user_id)
  RETURNING id INTO _store_id;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
  VALUES (
    _store_id,
    CASE
      WHEN _selected_plan = 'fixed' THEN 'fixed'::store_plan_type
      WHEN _selected_plan = 'hybrid' THEN 'hybrid'::store_plan_type
      ELSE 'commission_only'::store_plan_type
    END,
    CASE
      WHEN _selected_plan = 'fixed' THEN 180
      WHEN _selected_plan = 'hybrid' THEN 100
      ELSE 0
    END,
    CASE
      WHEN _selected_plan = 'fixed' THEN 0
      WHEN _selected_plan = 'hybrid' THEN 2.5
      ELSE 5
    END,
    true,
    now() + interval '7 days'
  ) ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$function$;

-- Update default commission_rate on stores table
ALTER TABLE public.stores ALTER COLUMN commission_rate SET DEFAULT 5;

-- Update existing stores that still have the old 15% default (only if they haven't been customized)
UPDATE public.stores SET commission_rate = 5 WHERE commission_rate = 15;

-- Update existing commission_only store_plans from 15% to 5%
UPDATE public.store_plans SET commission_rate = 5 WHERE plan_type = 'commission_only' AND commission_rate = 15;
