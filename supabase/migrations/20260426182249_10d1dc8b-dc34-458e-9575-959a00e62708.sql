CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category store_category,
  _avatar_url text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _selected_plan text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada. Faça login antes de cadastrar a loja.'
      USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    IF NOT EXISTS (SELECT 1 FROM stores WHERE owner_id = _user_id) THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
    END IF;
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO stores (name, category, owner_id, delivery_mode)
  VALUES (_store_name, _store_category, _user_id, 'own')
  RETURNING id INTO _store_id;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
  VALUES (
    _store_id,
    CASE WHEN _selected_plan = 'fixed' THEN 'fixed'::store_plan_type
         WHEN _selected_plan = 'hybrid' THEN 'hybrid'::store_plan_type
         ELSE 'commission_only'::store_plan_type END,
    CASE WHEN _selected_plan = 'fixed' THEN 180
         WHEN _selected_plan = 'hybrid' THEN 100 ELSE 0 END,
    CASE WHEN _selected_plan = 'fixed' THEN 0
         WHEN _selected_plan = 'hybrid' THEN 2.5 ELSE 6 END,
    true,
    CASE WHEN _selected_plan IN ('fixed', 'hybrid') THEN now() + interval '7 days' ELSE NULL END
  ) ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$$;