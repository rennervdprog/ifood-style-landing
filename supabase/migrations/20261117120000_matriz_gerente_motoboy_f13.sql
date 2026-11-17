-- F13 (E2E matriz 17/11/2026) — gerente de unidade nao conseguia vincular
-- motoboy: a busca (search_motoboy_profiles) exigia ser owner de alguma loja
-- e as policies de store_drivers exigiam is_store_owner. Como o checklist de
-- publicacao exige um entregador aceito, era impossivel publicar uma unidade
-- usando so a UI. Correcao: estender o acesso de DONO para GERENTE DAQUELA
-- UNIDADE, via is_unit_manager (SECURITY DEFINER; store_managers ativa
-- naquela loja). Nenhum acesso alem do escopo da propria unidade:
--  - a busca continua global por desenho (igual para donos: qualquer dono
--    busca qualquer motoboy); o portao por loja esta no INSERT abaixo;
--  - SELECT/INSERT/DELETE em store_drivers espelham as policies do dono,
--    trocando is_store_owner por is_unit_manager, mesma loja;
--  - UPDATE nao foi estendido: nem o dono tem policy de UPDATE em
--    store_drivers (so o proprio motoboy atualiza o status); manter a
--    paridade dono/gerente, sem criar acesso novo para ninguem;
--  - profiles: a policy de leitura de motoboy vinculado passa a valer
--    tambem para o gerente da unidade do vinculo (mesma condicao do dono).
--    Sem isso o gerente veria a linha do vinculo sem nome/telefone.
--  - list_store_city_opt_in_drivers: mesmo portao por loja (dono OU
--    gerente daquela loja); antes o gerente caia no erro de cidade.
-- NAO TOCA em billing, checklist, publish_network_unit ou edges.

-- ---------------------------------------------------------------------------
-- 1. search_motoboy_profiles — gerente ativo tambem pode buscar
--    (definicao ao vivo copiada verbatim; so o portao mudou)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_motoboy_profiles(_search text)
 RETURNS TABLE(user_id uuid, full_name text, phone text, whatsapp_number text, vehicle text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _clean text;
BEGIN
  -- Donos de loja OU gerentes ativos de unidade podem buscar. A busca nao
  -- recebe loja (e global por desenho, como ja era para donos); o vinculo
  -- a uma loja especifica e controlado pelas policies de store_drivers.
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.store_managers WHERE user_id = auth.uid() AND is_active) THEN
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
$function$;

-- ---------------------------------------------------------------------------
-- 2. list_store_city_opt_in_drivers — gerente daquela loja tambem consulta
--    (mesma logica ao vivo; so o portao de dono ganhou o OU gerente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_store_city_opt_in_drivers(_store_id uuid, _search text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, full_name text, city text, vehicle text, whatsapp_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE _store_city text; _search_normalized text := lower(trim(coalesce(_search, '')));
BEGIN
  SELECT s.address_city INTO _store_city FROM public.stores s WHERE s.id = _store_id AND (s.owner_id = auth.uid() OR public.is_unit_manager(auth.uid(), s.id));
  IF _store_city IS NULL OR length(trim(_store_city)) < 2 THEN RAISE EXCEPTION 'Defina a cidade no endereço da loja antes de consultar a base de motoboys.'; END IF;
  RETURN QUERY SELECT p.user_id, p.full_name, pref.city, p.vehicle, COALESCE(NULLIF(p.whatsapp_number, ''), NULLIF(p.phone, '')) AS whatsapp_number FROM public.driver_directory_preferences pref JOIN public.profiles p ON p.user_id = pref.user_id WHERE pref.is_listed = true AND pref.contact_consent_at IS NOT NULL AND p.role = 'motoboy' AND lower(trim(pref.city)) = lower(trim(_store_city)) AND COALESCE(NULLIF(p.whatsapp_number, ''), NULLIF(p.phone, '')) IS NOT NULL AND (_search_normalized = '' OR lower(coalesce(p.full_name, '')) LIKE '%' || _search_normalized || '%' OR lower(coalesce(p.vehicle, '')) LIKE '%' || _search_normalized || '%') ORDER BY p.full_name LIMIT 50;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. store_drivers — policies do gerente, espelhando as do dono
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Unit managers can read own unit drivers" ON public.store_drivers;
CREATE POLICY "Unit managers can read own unit drivers" ON public.store_drivers
  FOR SELECT TO authenticated
  USING (public.is_unit_manager(auth.uid(), store_id));

DROP POLICY IF EXISTS "Unit managers can invite drivers to own unit" ON public.store_drivers;
CREATE POLICY "Unit managers can invite drivers to own unit" ON public.store_drivers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_unit_manager(auth.uid(), store_id) AND status = 'pending'::store_driver_status);

DROP POLICY IF EXISTS "Unit managers can delete own unit drivers" ON public.store_drivers;
CREATE POLICY "Unit managers can delete own unit drivers" ON public.store_drivers
  FOR DELETE TO authenticated
  USING (public.is_unit_manager(auth.uid(), store_id));

-- ---------------------------------------------------------------------------
-- 4. profiles — gerente le o perfil do motoboy vinculado a SUA unidade
--    (mesma condicao da policy do dono; renomeada para refletir o alcance)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Store owners can read linked driver profiles" ON public.profiles;
CREATE POLICY "Store owners and unit managers can read linked driver profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.store_drivers sd
      WHERE sd.driver_user_id = profiles.user_id
        AND (public.is_store_owner(auth.uid(), sd.store_id) OR public.is_unit_manager(auth.uid(), sd.store_id))
    )
  );
