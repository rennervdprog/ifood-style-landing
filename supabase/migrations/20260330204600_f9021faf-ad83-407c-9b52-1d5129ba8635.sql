
-- Add whatsapp_number column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Update register_as_lojista to accept whatsapp
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text, _document text, _store_name text, _store_category store_category,
  _avatar_url text DEFAULT NULL, _whatsapp text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  RETURN _store_id;
END;
$$;

-- Update register_as_motoboy to accept whatsapp
CREATE OR REPLACE FUNCTION public.register_as_motoboy(
  _full_name text, _document text, _vehicle text,
  _avatar_url text DEFAULT NULL, _whatsapp text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, vehicle, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'motoboy', _document, _vehicle, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'motoboy',
    document = EXCLUDED.document,
    vehicle = EXCLUDED.vehicle,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO drivers (user_id, name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
