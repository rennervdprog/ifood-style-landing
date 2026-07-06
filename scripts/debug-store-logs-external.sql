-- Debug store logs — captura chamadas de edge functions relacionadas a lojas
-- marcadas para depuração (ex.: Cantinho da Silvia). Executar no Supabase EXTERNO
-- (qkjhguziuchqsbxzruea) pelo SQL Editor.

CREATE TABLE IF NOT EXISTS public.debug_store_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid,
  user_id     uuid,
  function_name text NOT NULL,
  direction   text NOT NULL CHECK (direction IN ('request','response','error')),
  status      int,
  duration_ms int,
  payload     jsonb,
  error       text,
  user_agent  text,
  route       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debug_store_logs_store   ON public.debug_store_logs (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_store_logs_created ON public.debug_store_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_store_logs_fn      ON public.debug_store_logs (function_name, created_at DESC);

-- Retenção: apagar após 14 dias (rodar via cron/pg_cron se disponível)
-- DELETE FROM public.debug_store_logs WHERE created_at < now() - interval '14 days';

GRANT SELECT ON public.debug_store_logs TO authenticated;
GRANT INSERT ON public.debug_store_logs TO authenticated, anon;
GRANT ALL    ON public.debug_store_logs TO service_role;

ALTER TABLE public.debug_store_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer sessão pode INSERIR (o logger roda no cliente). Não expõe leitura.
DROP POLICY IF EXISTS "debug_logs_insert_any" ON public.debug_store_logs;
CREATE POLICY "debug_logs_insert_any"
  ON public.debug_store_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Apenas admins leem
DROP POLICY IF EXISTS "debug_logs_select_admin" ON public.debug_store_logs;
CREATE POLICY "debug_logs_select_admin"
  ON public.debug_store_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Apenas admins deletam (limpeza manual)
DROP POLICY IF EXISTS "debug_logs_delete_admin" ON public.debug_store_logs;
CREATE POLICY "debug_logs_delete_admin"
  ON public.debug_store_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));