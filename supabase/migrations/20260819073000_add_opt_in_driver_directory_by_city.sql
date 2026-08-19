-- Base voluntária de motoboys por cidade.
-- A ItaSuper apenas disponibiliza o contato expressamente autorizado; não contrata,
-- não intermedeia e não participa de qualquer acordo entre lojista e motoboy.

BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_directory_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL,
  is_listed boolean NOT NULL DEFAULT false,
  contact_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_directory_preferences_city_not_blank CHECK (length(trim(city)) >= 2)
);

ALTER TABLE public.driver_directory_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Motoboys manage own directory preference" ON public.driver_directory_preferences;
CREATE POLICY "Motoboys manage own directory preference"
  ON public.driver_directory_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_driver_directory_preference(
  _city text,
  _is_listed boolean
)
RETURNS public.driver_directory_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _city_normalized text := initcap(trim(_city));
  _row public.driver_directory_preferences;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'motoboy'
  ) THEN
    RAISE EXCEPTION 'Apenas motoboys podem alterar esta preferência.';
  END IF;

  IF length(_city_normalized) < 2 THEN
    RAISE EXCEPTION 'Informe uma cidade válida.';
  END IF;

  INSERT INTO public.driver_directory_preferences (
    user_id, city, is_listed, contact_consent_at, created_at, updated_at
  )
  VALUES (
    auth.uid(),
    _city_normalized,
    _is_listed,
    CASE WHEN _is_listed THEN now() ELSE NULL END,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    city = EXCLUDED.city,
    is_listed = EXCLUDED.is_listed,
    contact_consent_at = CASE
      WHEN EXCLUDED.is_listed THEN COALESCE(public.driver_directory_preferences.contact_consent_at, now())
      ELSE NULL
    END,
    updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_store_city_opt_in_drivers(
  _store_id uuid,
  _search text DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  city text,
  vehicle text,
  whatsapp_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _store_city text;
  _search_normalized text := lower(trim(coalesce(_search, '')));
BEGIN
  SELECT s.address_city INTO _store_city
  FROM public.stores s
  WHERE s.id = _store_id
    AND s.owner_id = auth.uid();

  IF _store_city IS NULL OR length(trim(_store_city)) < 2 THEN
    RAISE EXCEPTION 'Defina a cidade no endereço da loja antes de consultar a base de motoboys.';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    pref.city,
    p.vehicle,
    COALESCE(NULLIF(p.whatsapp_number, ''), NULLIF(p.phone, '')) AS whatsapp_number
  FROM public.driver_directory_preferences pref
  JOIN public.profiles p ON p.user_id = pref.user_id
  WHERE pref.is_listed = true
    AND pref.contact_consent_at IS NOT NULL
    AND p.role = 'motoboy'
    AND lower(trim(pref.city)) = lower(trim(_store_city))
    AND COALESCE(NULLIF(p.whatsapp_number, ''), NULLIF(p.phone, '')) IS NOT NULL
    AND (
      _search_normalized = ''
      OR lower(coalesce(p.full_name, '')) LIKE '%' || _search_normalized || '%'
      OR lower(coalesce(p.vehicle, '')) LIKE '%' || _search_normalized || '%'
    )
  ORDER BY p.full_name
  LIMIT 50;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_driver_directory_preference(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_store_city_opt_in_drivers(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_driver_directory_preference(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_store_city_opt_in_drivers(uuid, text) TO authenticated;

COMMENT ON TABLE public.driver_directory_preferences IS
  'Preferências voluntárias de inclusão de motoboys em base por cidade para contato direto de lojistas.';

COMMIT;
