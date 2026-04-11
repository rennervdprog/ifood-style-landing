
CREATE OR REPLACE FUNCTION public.search_motoboy_profiles(_search text)
RETURNS TABLE(user_id uuid, full_name text, phone text, whatsapp_number text, vehicle text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean text;
BEGIN
  -- Only store owners can search
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas lojistas podem buscar motoboys.';
  END IF;

  _clean := lower(trim(_search));

  RETURN QUERY
    SELECT p.user_id, p.full_name, p.phone, p.whatsapp_number, p.vehicle, p.email
    FROM public.profiles p
    WHERE p.role = 'motoboy'
      AND (
        lower(p.full_name) LIKE '%' || _clean || '%'
        OR lower(COALESCE(p.email, '')) LIKE '%' || _clean || '%'
        OR replace(COALESCE(p.phone, ''), '-', '') LIKE '%' || replace(_clean, '-', '') || '%'
        OR replace(COALESCE(p.whatsapp_number, ''), '-', '') LIKE '%' || replace(_clean, '-', '') || '%'
      )
    LIMIT 10;
END;
$$;
