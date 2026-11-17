-- Hotfix da migration 20261117120000 (F13): o portao novo de
-- search_motoboy_profiles usava `user_id` NAO QUALIFICADO em
-- `FROM public.store_managers WHERE user_id = auth.uid()`. Como a funcao
-- tem parametro OUT chamado `user_id` (RETURNS TABLE), o PL/pgSQL resolve
-- `user_id` como ambiguo (42702) e a busca passou a falhar PARA TODOS,
-- inclusive donos (a probe DEPOIS da 120000 pegou: dono.search_rpc 42702).
-- Correcao: qualificar com o alias da tabela (sm.user_id). Nenhuma outra
-- linha muda; a migration 120000 aplicada NAO foi editada.
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
  -- (sm.user_id QUALIFICADO: `user_id` pelado e ambiguo com o OUT param.)
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.store_managers sm WHERE sm.user_id = auth.uid() AND sm.is_active) THEN
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
