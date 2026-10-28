-- Fase 1 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- Recria a tabela `store_networks` no repositório. A tabela JÁ EXISTE no banco
-- ao vivo (criada fora de migration) — por isso tudo aqui é idempotente:
-- CREATE TABLE IF NOT EXISTS + DO com checagem de coluna. Um CREATE TABLE seco
-- quebraria na hora de aplicar. NUNCA editar migration já aplicada.
--
-- Estado ao vivo conferido em 28/10/2026 (só leitura):
--   colunas: id, name, logo_url, owner_id, plan_type (default 'fixed'),
--   monthly_fee (default 180), max_units (default 10), is_approved
--   (default false), created_at, updated_at, matriz_store_id.
--   CHECK plan_type aceita só fixed/hybrid/commission_only/supporter.
--   owner_id ON DELETE CASCADE; matriz_store_id ON DELETE SET NULL.
--   RLS ligada. Policies ao vivo: auth_insert_own_network (INSERT direto por
--   qualquer autenticado), matriz_owner_select, matriz_owner_update (dono edita
--   QUALQUER campo — furo C2), platform_admin_all.
--
-- O que muda aqui (achados C2, C6, decisão 5):
--   1. plan_type passa a aceitar também 'pdv_only' (C6: cadastro de matriz com
--      plano Somente PDV quebrava sempre).
--   2. INSERT direto na tabela é revogado para `authenticated`: rede só nasce
--      pela função SECURITY DEFINER `register_as_matriz` (Fase 1, migration
--      20261028133000). A policy `auth_insert_own_network` é removida.
--   3. O dono só edita nome e logo: trigger `prevent_network_self_admin`
--      (abaixo) rejeita mudança de is_approved, max_units, plan_type,
--      monthly_fee, owner_id e matriz_store_id por quem não é admin da
--      plataforma. A policy de UPDATE do dono continua existindo (é a 1ª
--      camada); o trigger é a 2ª camada — se uma falhar, a outra segura.
--   4. A rede nasce aprovada (decisão 5) — o default de is_approved vira
--      true. O admin pode suspender (is_approved = false) depois.
--      NOTA: o default antigo era false, mas as 19 redes ao vivo já estão
--      aprovadas (aprovação manual anterior, sem registro de quem aprovou).
--
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança.

-- ---------------------------------------------------------------------------
-- 1. Tabela (idempotente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'fixed',
  monthly_fee numeric NOT NULL DEFAULT 180,
  max_units integer NOT NULL DEFAULT 10,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  matriz_store_id uuid REFERENCES public.stores (id) ON DELETE SET NULL
);

-- Colunas que podem faltar se a tabela ao vivo for mais antiga que este
-- CREATE TABLE (cada DO só adiciona o que não existe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'id') THEN
    ALTER TABLE public.store_networks ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'name') THEN
    ALTER TABLE public.store_networks ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'logo_url') THEN
    ALTER TABLE public.store_networks ADD COLUMN logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'owner_id') THEN
    ALTER TABLE public.store_networks ADD COLUMN owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'plan_type') THEN
    ALTER TABLE public.store_networks ADD COLUMN plan_type text NOT NULL DEFAULT 'fixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'monthly_fee') THEN
    ALTER TABLE public.store_networks ADD COLUMN monthly_fee numeric NOT NULL DEFAULT 180;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'max_units') THEN
    ALTER TABLE public.store_networks ADD COLUMN max_units integer NOT NULL DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'is_approved') THEN
    ALTER TABLE public.store_networks ADD COLUMN is_approved boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'created_at') THEN
    ALTER TABLE public.store_networks ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.store_networks ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'matriz_store_id') THEN
    ALTER TABLE public.store_networks ADD COLUMN matriz_store_id uuid REFERENCES public.stores (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. plan_type aceita 'pdv_only' (C6) + rede nasce aprovada (decisão 5)
-- ---------------------------------------------------------------------------
-- O CHECK antigo é substituído (o nome da constraint é o que existe ao vivo).
ALTER TABLE public.store_networks
  DROP CONSTRAINT IF EXISTS store_networks_plan_type_check;
ALTER TABLE public.store_networks
  ADD CONSTRAINT store_networks_plan_type_check
  CHECK (plan_type = ANY (ARRAY['fixed'::text, 'hybrid'::text, 'commission_only'::text, 'supporter'::text, 'pdv_only'::text]));

-- Default de is_approved: false -> true (decisão 5: a rede nasce aprovada,
-- igual a todo cadastro hoje; o admin pode suspender depois).
ALTER TABLE public.store_networks
  ALTER COLUMN is_approved SET DEFAULT true;

-- ---------------------------------------------------------------------------
-- 3. RLS + policies (C2)
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_networks ENABLE ROW LEVEL SECURITY;

-- Rede só nasce pela função SECURITY DEFINER register_as_matriz: remove a
-- policy que deixava qualquer autenticado inserir direto, e revoga o INSERT
-- no nível de GRANT (a função roda como dono e não é afetada).
DROP POLICY IF EXISTS auth_insert_own_network ON public.store_networks;
REVOKE INSERT ON TABLE public.store_networks FROM authenticated;

-- Leitura: dono da rede ou admin da plataforma (policy que já existia).
DROP POLICY IF EXISTS matriz_owner_select ON public.store_networks;
CREATE POLICY matriz_owner_select ON public.store_networks
  FOR SELECT
  USING (owner_id = (SELECT auth.uid()) OR public.is_platform_admin(auth.uid()));

-- UPDATE pelo dono: a policy continua permitindo (1ª camada); o trigger
-- abaixo é quem barra a mudança dos campos de administração (2ª camada).
DROP POLICY IF EXISTS matriz_owner_update ON public.store_networks;
CREATE POLICY matriz_owner_update ON public.store_networks
  FOR UPDATE
  USING (owner_id = (SELECT auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR public.is_platform_admin(auth.uid()));

-- Admin da plataforma: tudo (policy que já existia).
DROP POLICY IF EXISTS platform_admin_all ON public.store_networks;
CREATE POLICY platform_admin_all ON public.store_networks
  FOR ALL
  USING (public.is_platform_admin((SELECT auth.uid())))
  WITH CHECK (public.is_platform_admin((SELECT auth.uid())));

-- ---------------------------------------------------------------------------
-- 4. Trigger: o dono não se auto-aprova nem muda o próprio limite (C2)
-- ---------------------------------------------------------------------------
-- Segunda camada da trava: mesmo que a policy deixe passar, o trigger rejeita
-- qualquer UPDATE que mude campo de administração feito por quem não é admin
-- da plataforma. Funções SECURITY DEFINER (rodam como postgres) e o
-- service_role passam direto — é por elas que o admin opera.
CREATE OR REPLACE FUNCTION public.prevent_network_self_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      RAISE EXCEPTION 'Somente o admin da plataforma pode aprovar ou suspender uma rede.';
    END IF;
    IF OLD.max_units IS DISTINCT FROM NEW.max_units THEN
      RAISE EXCEPTION 'Somente o admin da plataforma pode mudar o limite de sublojas.';
    END IF;
    IF OLD.plan_type IS DISTINCT FROM NEW.plan_type THEN
      RAISE EXCEPTION 'Somente o admin da plataforma pode mudar o plano da rede.';
    END IF;
    IF OLD.monthly_fee IS DISTINCT FROM NEW.monthly_fee THEN
      RAISE EXCEPTION 'Somente o admin da plataforma pode mudar a mensalidade da rede.';
    END IF;
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Somente o admin da plataforma pode transferir uma rede.';
    END IF;
    IF OLD.matriz_store_id IS DISTINCT FROM NEW.matriz_store_id THEN
      RAISE EXCEPTION 'Somente o admin da plataforma pode trocar a loja-matriz da rede.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_prevent_network_self_admin ON public.store_networks;
CREATE TRIGGER trigger_prevent_network_self_admin
  BEFORE UPDATE ON public.store_networks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_network_self_admin();

-- O trigger de updated_at (trg_touch_store_networks / touch_store_networks)
-- já existe ao vivo e não é tocado aqui.
