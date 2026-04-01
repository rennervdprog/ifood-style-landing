
-- Create trigger function to auto-create profile from auth.users metadata on signup
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
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.partner_role, 'cliente');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _document := NEW.raw_user_meta_data->>'document';
  _vehicle := NEW.raw_user_meta_data->>'vehicle';
  _whatsapp := NEW.raw_user_meta_data->>'whatsapp';
  _phone := NEW.raw_user_meta_data->>'phone';
  _store_name := NEW.raw_user_meta_data->>'store_name';
  _store_category := NEW.raw_user_meta_data->>'store_category';

  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    document = COALESCE(EXCLUDED.document, profiles.document),
    vehicle = COALESCE(EXCLUDED.vehicle, profiles.vehicle),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- If motoboy, create driver record
  IF _role = 'motoboy' THEN
    INSERT INTO public.drivers (user_id, name, is_active)
    VALUES (NEW.id, _full_name, false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- If lojista, create store
  IF _role = 'lojista' AND _store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, category, owner_id, status)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'analise');
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
