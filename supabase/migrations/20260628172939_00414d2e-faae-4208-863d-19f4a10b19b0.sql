
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_approval_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_approval_meta jsonb DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.is_valid_cpf(_doc text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text := regexp_replace(coalesce(_doc,''), '\D', '', 'g');
  s int; r int; i int;
BEGIN
  IF length(d) <> 11 THEN RETURN false; END IF;
  IF d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(d,i,1)::int * (11 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  IF r <> substr(d,10,1)::int THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(d,i,1)::int * (12 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  RETURN r = substr(d,11,1)::int;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_cnpj(_doc text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text := regexp_replace(coalesce(_doc,''), '\D', '', 'g');
  w1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
BEGIN
  IF length(d) <> 14 THEN RETURN false; END IF;
  IF d ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..12 LOOP s := s + substr(d,i,1)::int * w1[i]; END LOOP;
  r := s % 11; IF r < 2 THEN r := 0; ELSE r := 11 - r; END IF;
  IF r <> substr(d,13,1)::int THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..13 LOOP s := s + substr(d,i,1)::int * w2[i]; END LOOP;
  r := s % 11; IF r < 2 THEN r := 0; ELSE r := 11 - r; END IF;
  RETURN r = substr(d,14,1)::int;
END $$;

CREATE OR REPLACE FUNCTION public.validate_partner_profile(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
  store record;
  missing text[] := ARRAY[]::text[];
  reasons text[] := ARRAY[]::text[];
  doc_clean text;
  dup_count int;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reasons', ARRAY['profile_not_found']);
  END IF;
  IF p.role NOT IN ('lojista','motoboy') THEN
    RETURN jsonb_build_object('ok', false, 'reasons', ARRAY['role_not_eligible']);
  END IF;

  IF coalesce(p.full_name,'') = '' THEN missing := missing || 'full_name'; END IF;
  IF coalesce(p.document,'') = '' THEN missing := missing || 'document'; END IF;
  IF coalesce(p.whatsapp_number, p.phone, '') = '' THEN missing := missing || 'whatsapp_number'; END IF;
  IF coalesce(p.city,'') = '' THEN missing := missing || 'city'; END IF;

  doc_clean := regexp_replace(coalesce(p.document,''), '\D', '', 'g');

  IF p.role = 'lojista' THEN
    IF coalesce(p.email,'') = '' THEN missing := missing || 'email'; END IF;
    IF coalesce(p.cep,'') = '' THEN missing := missing || 'cep'; END IF;
    IF coalesce(p.street,'') = '' THEN missing := missing || 'street'; END IF;

    SELECT * INTO store FROM public.stores WHERE owner_id = _user_id ORDER BY created_at DESC LIMIT 1;
    IF store IS NULL THEN
      reasons := reasons || 'store_not_created';
    ELSE
      IF store.latitude IS NULL OR store.longitude IS NULL THEN reasons := reasons || 'store_not_geocoded'; END IF;
      IF coalesce(store.category,'') = '' THEN reasons := reasons || 'store_no_category'; END IF;
    END IF;

    IF length(doc_clean) NOT IN (11,14) OR
       (length(doc_clean)=11 AND NOT public.is_valid_cpf(doc_clean)) OR
       (length(doc_clean)=14 AND NOT public.is_valid_cnpj(doc_clean)) THEN
      reasons := reasons || 'invalid_document';
    END IF;

  ELSIF p.role = 'motoboy' THEN
    IF coalesce(p.vehicle,'') = '' THEN missing := missing || 'vehicle'; END IF;
    IF coalesce(p.cnh_number,'') = '' THEN missing := missing || 'cnh_number'; END IF;
    IF coalesce(p.cnh_front_url,'') = '' THEN missing := missing || 'cnh_front_url'; END IF;
    IF coalesce(p.selfie_url,'') = '' THEN missing := missing || 'selfie_url'; END IF;

    IF length(doc_clean) <> 11 OR NOT public.is_valid_cpf(doc_clean) THEN
      reasons := reasons || 'invalid_document';
    END IF;
    IF length(regexp_replace(coalesce(p.cnh_number,''),'\D','','g')) <> 11 THEN
      reasons := reasons || 'invalid_cnh';
    END IF;
  END IF;

  IF length(doc_clean) >= 11 THEN
    SELECT count(*) INTO dup_count
    FROM public.profiles
    WHERE user_id <> _user_id
      AND regexp_replace(coalesce(document,''),'\D','','g') = doc_clean;
    IF dup_count > 0 THEN reasons := reasons || 'duplicate_document'; END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', (array_length(missing,1) IS NULL AND array_length(reasons,1) IS NULL),
    'role', p.role,
    'missing', to_jsonb(missing),
    'reasons', to_jsonb(reasons)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.validate_partner_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_cpf(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_cnpj(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.try_auto_approve_partner(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
  cfg jsonb;
  enabled bool := false;
  shadow bool := true;
  p record;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE user_id = _user_id;
  IF NOT FOUND OR p.is_approved = true OR p.role NOT IN ('lojista','motoboy') THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true);
  END IF;

  SELECT value INTO cfg FROM public.admin_settings WHERE key = 'auto_approval';
  enabled := coalesce((cfg->>'enabled')::bool, false);
  shadow  := coalesce((cfg->>'shadow')::bool, true);

  v := public.validate_partner_profile(_user_id);

  UPDATE public.profiles
     SET auto_approval_last_run_at = now(),
         auto_approval_meta = v
   WHERE user_id = _user_id;

  IF (v->>'ok')::bool AND enabled AND NOT shadow THEN
    UPDATE public.profiles
       SET is_approved = true,
           approved_at = now()
     WHERE user_id = _user_id AND is_approved = false;

    INSERT INTO public.admin_logs (action, target_type, target_id, details)
    VALUES ('auto_approve_partner', p.role, _user_id, v);
  ELSE
    INSERT INTO public.admin_logs (action, target_type, target_id, details)
    VALUES (
      CASE WHEN (v->>'ok')::bool THEN 'auto_approve_shadow' ELSE 'auto_approve_skipped' END,
      p.role, _user_id, v
    );
  END IF;

  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.try_auto_approve_partner(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_auto_approve_partner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('lojista','motoboy') AND coalesce(NEW.is_approved,false) = false THEN
    PERFORM public.try_auto_approve_partner(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_approve_partner_on_profile ON public.profiles;
CREATE TRIGGER auto_approve_partner_on_profile
AFTER INSERT OR UPDATE OF document, cnh_number, cnh_front_url, selfie_url,
                          vehicle, full_name, email, whatsapp_number, phone,
                          cep, street, city
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_approve_partner();

CREATE OR REPLACE FUNCTION public.trg_auto_approve_partner_from_store()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    PERFORM public.try_auto_approve_partner(NEW.owner_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_approve_partner_on_store ON public.stores;
CREATE TRIGGER auto_approve_partner_on_store
AFTER INSERT OR UPDATE OF latitude, longitude, category, owner_id
ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_approve_partner_from_store();

INSERT INTO public.admin_settings (key, value)
VALUES ('auto_approval', '{"enabled": false, "shadow": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
