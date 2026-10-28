-- Fase 1 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- Trava do perfil (achado C1 — CRÍTICO): a policy "Users can update own
-- profile" não restringia colunas, e o trigger `prevent_role_self_change`
-- só bloqueava `role` / `is_approved`. Qualquer usuário logado podia escrever
-- `unit_store_id` / `network_id` no próprio perfil — e `is_unit_manager`
-- lia justamente esse campo. Resultado: qualquer um virava gerente de
-- qualquer loja.
--
-- Fecha em DUAS camadas (plano 4.2):
--   (a) Policy RLS restritiva: o WITH CHECK da policy de UPDATE do próprio
--       usuário passa a exigir que os 3 campos de vínculo não mudem
--       (comparados com a linha gravada, via função auxiliar SECURITY
--       DEFINER), salvo para admin da plataforma. O `role` já era travado
--       pelo trigger; aqui ele entra na policy também.
--   (b) Trigger: `prevent_role_self_change` (já existe ao vivo) passa a
--       bloquear também `unit_store_id` e `network_id` para não-admin.
--       É a segunda camada: se a policy falhar, o trigger segura.
--
-- O cadastro normal NÃO quebra: nome, telefone, avatar, endereço, PIX etc.
-- continuam editáveis pelo próprio usuário — a trava só impede a troca dos
-- 3 campos de vínculo, que o cadastro normal nunca toca (conferido em
-- src/pages/PerfilPage.tsx, CadastroLojista.tsx e AuthPage.tsx em 28/10/2026:
-- os updates/upserts de perfil do app só escrevem campos comuns).
--
-- Escapes preservados do trigger original (não mudar o comportamento de quem
-- já operava por essas vias):
--   - `app.bypass_role_guard = '1'` (ex.: `register_as_matriz` muda o role
--     do próprio usuário ao virar matriz);
--   - `current_user` service_role / supabase_admin / postgres (funções
--     SECURITY DEFINER como `link_unit_user` e o service_role passam direto);
--   - admin da plataforma pode mudar tudo (policy "Platform admin can update
--     all profiles" continua existindo).
--
-- O campo `unit_store_id` do perfil vira só-leitura e, depois da Fase 2
-- migrar os vínculos para `store_managers`, será removido (plano 4.1).
-- Até lá, `is_unit_manager` continua lendo as duas fontes (ver migration
-- 20261028133000).

-- ---------------------------------------------------------------------------
-- 1. Função auxiliar da policy: os campos de vínculo mudaram?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER para ler a linha gravada mesmo quando a policy está sendo
-- avaliada. Compara os valores PROPOSTOS (NEW, passados como argumentos)
-- com os valores GRAVADOS. Durante um UPDATE, a consulta enxerga a linha
-- antes da atualização (snapshot do statement), então a comparação é
-- OLD x NEW de verdade.
-- Retorna true quando NADA mudou nos 3 campos, ou quando quem chama é admin.
CREATE OR REPLACE FUNCTION public.profile_link_fields_unchanged(
  _user_id uuid,
  _unit_store_id uuid,
  _network_id uuid,
  _role public.partner_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_platform_admin(auth.uid())
    OR NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = _user_id
        AND (
          p.unit_store_id IS DISTINCT FROM _unit_store_id
          OR p.network_id IS DISTINCT FROM _network_id
          OR p.role IS DISTINCT FROM _role
        )
    );
$function$;

-- ---------------------------------------------------------------------------
-- 2. Camada (a): policy RLS restritiva no UPDATE do próprio perfil
-- ---------------------------------------------------------------------------
-- USING continua sendo "é o meu perfil". O WITH CHECK passa a exigir, além
-- disso, que os campos de vínculo não tenham mudado (ou que seja admin).
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.profile_link_fields_unchanged(user_id, unit_store_id, network_id, role)
  );

-- As demais policies de profiles não são tocadas:
--   "Users can read own profile", "Users can insert own profile"
--   (INSERT não deixa criar vínculo: profiles.user_id é UNIQUE e não há
--   policy de DELETE para o próprio usuário, então não dá para apagar o
--   perfil e recriá-lo com vínculo), "Platform admin can read/update all
--   profiles", "Store owners can read linked driver profiles".

-- ---------------------------------------------------------------------------
-- 3. Camada (b): trigger estendido — bloqueia os 3 campos para não-admin
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE da função que já existe ao vivo; preserva o corpo
-- original e acrescenta os dois campos de vínculo ao bloqueio.
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bypass_role_guard', true) = '1' THEN RETURN NEW; END IF;
  IF current_user IN ('service_role', 'supabase_admin', 'postgres') THEN RETURN NEW; END IF;
  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio cargo.';
    END IF;
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio status de aprovação.';
    END IF;
    -- Fase 1 (C1): o vínculo com loja/rede também não pode ser alterado
    -- pelo próprio usuário — só o dono da rede ou o admin vinculam,
    -- pela função SECURITY DEFINER link_unit_user (tabela store_managers).
    IF OLD.unit_store_id IS DISTINCT FROM NEW.unit_store_id THEN
      RAISE EXCEPTION 'Não é permitido alterar a própria loja vinculada. Peça ao dono da rede ou ao admin.';
    END IF;
    IF OLD.network_id IS DISTINCT FROM NEW.network_id THEN
      RAISE EXCEPTION 'Não é permitido alterar a própria rede vinculada. Peça ao dono da rede ou ao admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- O trigger `trigger_prevent_role_self_change` já existe ao vivo e aponta
-- para esta função — o CREATE OR REPLACE acima já o atualiza. Recria de
-- forma idempotente caso o banco tenha sido recriado do zero.
DROP TRIGGER IF EXISTS trigger_prevent_role_self_change ON public.profiles;
CREATE TRIGGER trigger_prevent_role_self_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();
