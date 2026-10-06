-- ⚠️ Executar no BANCO EXTERNO (qkjhguziuchqsbxzruea).
-- Bug: o trigger handle_new_user criava a loja no cadastro com plano legado
-- 'commission_only' (6%) e a RPC register_as_lojista depois falhava com
-- "já possui cadastro", deixando a loja presa no plano errado.
-- Correção: trigger cria só as ofertas vigentes (Essencial / Somente PDV)
-- + backfill das lojas novas que caíram no legado.

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
  _is_pdv boolean;
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
  _selected_plan := lower(trim(coalesce(NEW.raw_user_meta_data->>'selected_plan', '')));
  _driver_type := COALESCE(NEW.raw_user_meta_data->>'driver_type', 'platform');
  _is_pdv := _selected_plan IN ('pdv_only', 'pdv', 'somente_pdv');

  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone, email, city, cep, street, neighborhood, pix_type, pix_key, is_approved)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone, NEW.email, _city, _cep, _street, _neighborhood,
    CASE WHEN _pix_type IS NOT NULL THEN _pix_type::public.pix_type ELSE NULL END,
    _pix_key,
    (_role = 'lojista'))
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
    INSERT INTO public.stores (name, category, owner_id, status, address_city, delivery_mode, address_cep, address_street, address_neighborhood, is_visible, plan_type)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'ativo', _city, 'own', _cep, _street, _neighborhood,
      NOT _is_pdv, CASE WHEN _is_pdv THEN 'pdv_only' ELSE 'essencial' END)
    RETURNING id INTO _new_store_id;

    IF _new_store_id IS NOT NULL THEN
      -- Só ofertas vigentes: Essencial (grátis até o gatilho) ou Somente PDV.
      INSERT INTO public.store_plans (
        store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at,
        pdv_enabled, pdv_commission_rate, pdv_fixed_fee_per_sale, pix_operational_fee_override
      )
      VALUES (
        _new_store_id,
        CASE WHEN _is_pdv THEN 'pdv_only'::public.store_plan_type ELSE 'fixed'::public.store_plan_type END,
        CASE WHEN _is_pdv THEN 69 ELSE 0 END,
        0,
        true,
        CASE WHEN _is_pdv THEN now() + interval '7 days' ELSE NULL END,
        true,
        0,
        CASE WHEN _is_pdv THEN 0 ELSE 1 END,
        1.99
      )
      ON CONFLICT (store_id) DO NOTHING;

      IF _is_pdv THEN
        INSERT INTO public.store_addons (store_id, addon_key, status, price_override)
        VALUES (_new_store_id, 'pdv', 'active', 0)
        ON CONFLICT (store_id, addon_key) DO UPDATE SET status = 'active', price_override = 0;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: lojas criadas desde a retirada dos planos legados (20/08/2026)
-- que caíram em commission_only voltam para a oferta escolhida no cadastro.
UPDATE public.store_plans sp
SET plan_type = CASE WHEN lower(u.raw_user_meta_data->>'selected_plan') IN ('pdv_only','pdv','somente_pdv')
                     THEN 'pdv_only'::public.store_plan_type ELSE 'fixed'::public.store_plan_type END,
    monthly_fee = CASE WHEN lower(u.raw_user_meta_data->>'selected_plan') IN ('pdv_only','pdv','somente_pdv') THEN 69 ELSE 0 END,
    commission_rate = 0,
    pdv_commission_rate = 0,
    updated_at = now()
FROM public.stores s
JOIN auth.users u ON u.id = s.owner_id
WHERE sp.store_id = s.id
  AND sp.plan_type = 'commission_only'
  AND sp.is_active = true
  AND s.created_at >= '2026-08-20'
  AND lower(coalesce(u.raw_user_meta_data->>'selected_plan', '')) IN ('fixed','pdv_only','pdv','somente_pdv');
