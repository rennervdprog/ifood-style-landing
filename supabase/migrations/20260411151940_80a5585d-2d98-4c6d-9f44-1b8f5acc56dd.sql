
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  _driver_type text;
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
  _driver_type := COALESCE(NEW.raw_user_meta_data->>'driver_type', 'platform');

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

  -- Only create drivers entry for PLATFORM motoboys, not store motoboys
  IF _role = 'motoboy' AND _driver_type != 'store' THEN
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
        CASE
          WHEN _selected_plan IN ('fixed', 'hybrid') THEN now() + interval '7 days'
          ELSE NULL
        END
      )
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
