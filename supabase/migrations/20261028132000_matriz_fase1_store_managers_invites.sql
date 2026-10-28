-- Fase 1 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- Tabelas novas do vínculo gerente <-> subloja (plano 4.1):
--
--   store_managers — QUEM gerencia cada subloja, numa tabela própria.
--   É esta tabela (e não o perfil do usuário) que diz quem gerencia o quê.
--   1 gerente por subloja ativa E 1 subloja ativa por gerente (o plano diz:
--   "um gerente não pode estar em duas filiais ao mesmo tempo").
--   Colunas: loja, usuário, quem vinculou, quando, papel, ativo.
--
--   network_invites — o convite do gerente: e-mail, subloja, quem convidou,
--   código, validade de 7 dias, status (pending/accepted/declined/expired).
--   Sem ele não há como vincular ninguém (o fluxo de aceitar o convite é
--   Fase 2; aqui fica só a tabela + travas).
--
-- Escrita DIRETA nas duas tabelas é proibida para o usuário comum:
-- não há policy de INSERT/UPDATE para `authenticated` — só o admin da
-- plataforma (policy) e as funções SECURITY DEFINER `link_unit_user` /
-- `unlink_unit_user` (migration 20261028133000) escrevem nelas.
--
-- Backfill: NÃO há o que migrar. Os únicos 2 perfis `lojista_unidade` ao
-- vivo (28/10/2026) têm `unit_store_id` NULL e apontam para a rede
-- "Pizzaria Fake", que não tem nenhuma loja (achado A2) — não existe
-- vínculo real para preservar. Quando a Fase 2 vincular gerentes de
-- verdade, os vínculos nascerão aqui.

-- ---------------------------------------------------------------------------
-- 1. store_managers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  linked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'manager',
  is_active boolean NOT NULL DEFAULT true,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_managers_role_check CHECK (role = 'manager')
);

-- 1 gerente por subloja ATIVA (desvincular marca is_active = false e libera
-- a vaga; o histórico fica na tabela).
CREATE UNIQUE INDEX IF NOT EXISTS store_managers_one_active_per_store
  ON public.store_managers (store_id) WHERE is_active;

-- 1 subloja ativa por gerente (plano 4.1: "um gerente não pode estar em
-- duas filiais ao mesmo tempo").
CREATE UNIQUE INDEX IF NOT EXISTS store_managers_one_active_per_user
  ON public.store_managers (user_id) WHERE is_active;

ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;

-- Leitura: admin da plataforma, dono da rede da loja, ou o próprio gerente.
CREATE POLICY store_managers_select ON public.store_managers
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.stores s
      JOIN public.store_networks n ON n.id = s.network_id
      WHERE s.id = store_managers.store_id
        AND n.owner_id = (SELECT auth.uid())
    )
  );

-- Escrita: SÓ o admin da plataforma via policy. Dono da rede vincula e
-- desvincula pelas funções SECURITY DEFINER link_unit_user /
-- unlink_unit_user — nunca por escrita direta na tabela (plano 4.2).
CREATE POLICY store_managers_admin_all ON public.store_managers
  FOR ALL
  USING (public.is_platform_admin((SELECT auth.uid())))
  WITH CHECK (public.is_platform_admin((SELECT auth.uid())));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.store_managers FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. network_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.network_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES public.store_networks (id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  code text NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT network_invites_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text])),
  CONSTRAINT network_invites_email_check CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- O código do convite é único (é o que o gerente usa para aceitar).
CREATE UNIQUE INDEX IF NOT EXISTS network_invites_code_key
  ON public.network_invites (code);

-- 1 convite pendente por (subloja, e-mail): reenviar o convite não empilha
-- convites — o dono reenvia marcando o anterior como expirado (Fase 2).
CREATE UNIQUE INDEX IF NOT EXISTS network_invites_one_pending_per_email
  ON public.network_invites (store_id, lower(email)) WHERE status = 'pending';

ALTER TABLE public.network_invites ENABLE ROW LEVEL SECURITY;

-- Leitura: admin da plataforma ou dono da rede do convite.
CREATE POLICY network_invites_select ON public.network_invites
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.store_networks n
      WHERE n.id = network_invites.network_id
        AND n.owner_id = (SELECT auth.uid())
    )
  );

-- Escrita: SÓ o admin da plataforma via policy. O dono da rede convida pela
-- função SECURITY DEFINER da Fase 2 — nunca por escrita direta na tabela.
CREATE POLICY network_invites_admin_all ON public.network_invites
  FOR ALL
  USING (public.is_platform_admin((SELECT auth.uid())))
  WITH CHECK (public.is_platform_admin((SELECT auth.uid())));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.network_invites FROM authenticated;
