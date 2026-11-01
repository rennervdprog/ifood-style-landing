-- Agente de impressão ItaSuper (programa Windows instalado no PC da loja).
-- Cada linha é um agente pareado a uma loja: nasce como código de pareamento
-- (gerado pelo lojista no painel, válido por 30 min, uso único) e, no
-- pareamento, troca o código por um token (guardado só como hash SHA-256).
-- A Edge Function `print-agent` fala com esta tabela via service role.

CREATE TABLE IF NOT EXISTS public.print_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text,
  pairing_code text,
  pairing_expires_at timestamptz,
  token_hash text,
  printer_name text,
  app_version text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS print_agents_pairing_code_key
  ON public.print_agents (pairing_code)
  WHERE pairing_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS print_agents_token_hash_key
  ON public.print_agents (token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS print_agents_store_id_idx
  ON public.print_agents (store_id);

ALTER TABLE public.print_agents ENABLE ROW LEVEL SECURITY;

-- O lojista (dono da loja) e o admin da plataforma enxergam/gerenciam os
-- agentes das próprias lojas; o pareamento em si é consumido pela Edge
-- Function com service role (fora do RLS).
DROP POLICY IF EXISTS print_agents_owner_select ON public.print_agents;
CREATE POLICY print_agents_owner_select ON public.print_agents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS print_agents_owner_insert ON public.print_agents;
CREATE POLICY print_agents_owner_insert ON public.print_agents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS print_agents_owner_update ON public.print_agents;
CREATE POLICY print_agents_owner_update ON public.print_agents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.print_agents TO authenticated;
