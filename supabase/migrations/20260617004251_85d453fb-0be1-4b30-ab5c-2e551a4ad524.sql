-- Fase 3: trigger de sincronização profiles.role ← user_roles (retrocompat).
-- Mantém profiles.role espelhando o role mais "alto" em user_roles para código legado que ainda lê profiles.role.
-- user_roles permanece como fonte de verdade (regra de projeto). Esta migration é aditiva: não remove nada.

CREATE OR REPLACE FUNCTION public.sync_profile_role_from_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_top_role text;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Escolhe o role com maior prioridade existente para esse usuário
  SELECT role::text INTO v_top_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1
    WHEN 'lojista_matriz' THEN 2
    WHEN 'lojista' THEN 3
    WHEN 'lojista_unidade' THEN 4
    WHEN 'moderator' THEN 5
    WHEN 'motoboy' THEN 6
    WHEN 'cliente' THEN 7
    ELSE 99
  END
  LIMIT 1;

  IF v_top_role IS NOT NULL THEN
    UPDATE public.profiles SET role = v_top_role WHERE id = v_user_id AND COALESCE(role, '') <> v_top_role;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_aiud ON public.user_roles;
CREATE TRIGGER trg_sync_profile_role_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_from_user_roles();

REVOKE ALL ON FUNCTION public.sync_profile_role_from_user_roles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_role_from_user_roles() TO service_role;