
-- Fase 6: Auditoria de segurança - corrige 2 findings ERROR

-- 1. user_roles: remove política pública que expõe mapeamento user_id -> role (inclusive admins)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
-- Políticas "Users can read own roles" e "Admins can read all roles" já cobrem o caso autorizado.

-- 2. stores: revoga acesso de leitura às colunas sensíveis para anon/authenticated.
-- Edge functions usam service_role e continuam tendo acesso total.
-- RLS continua permitindo SELECT publicamente, mas Postgres bloqueia colunas sem GRANT.
REVOKE SELECT (
  asaas_subaccount_api_key,
  asaas_pix_key,
  asaas_pix_key_type,
  asaas_account_id,
  asaas_min_withdraw_amount
) ON public.stores FROM anon, authenticated;

-- Lojistas (owners) e admins precisam continuar lendo essas colunas para configuração.
-- Concedemos via política separada usando view de segurança.
CREATE OR REPLACE VIEW public.store_payment_credentials
WITH (security_invoker = true)
AS
SELECT
  s.id AS store_id,
  s.asaas_subaccount_api_key,
  s.asaas_pix_key,
  s.asaas_pix_key_type,
  s.asaas_account_id,
  s.asaas_wallet_id,
  s.asaas_min_withdraw_amount
FROM public.stores s
WHERE s.owner_id = auth.uid() OR public.is_platform_admin(auth.uid());

GRANT SELECT ON public.store_payment_credentials TO authenticated;

COMMENT ON VIEW public.store_payment_credentials IS
  'Credenciais Asaas das lojas - acessível apenas pelo dono da loja e admins da plataforma.';
