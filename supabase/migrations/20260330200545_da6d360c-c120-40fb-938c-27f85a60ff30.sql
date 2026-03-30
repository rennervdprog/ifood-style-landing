
-- Function to register as a store owner (creates profile + store + links owner_id)
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category store_category,
  _avatar_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
  -- Check not already registered
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  -- Upsert profile
  INSERT INTO profiles (user_id, full_name, role, document, avatar_url)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  -- Create store
  INSERT INTO stores (name, category, owner_id)
  VALUES (_store_name, _store_category, _user_id)
  RETURNING id INTO _store_id;

  RETURN _store_id;
END;
$$;

-- Function to register as a driver
CREATE OR REPLACE FUNCTION public.register_as_motoboy(
  _full_name text,
  _document text,
  _vehicle text,
  _avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  -- Check not already registered
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  -- Upsert profile
  INSERT INTO profiles (user_id, full_name, role, document, vehicle, avatar_url)
  VALUES (_user_id, _full_name, 'motoboy', _document, _vehicle, _avatar_url)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'motoboy',
    document = EXCLUDED.document,
    vehicle = EXCLUDED.vehicle,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  -- Register as driver
  INSERT INTO drivers (user_id, name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
