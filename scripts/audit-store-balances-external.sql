-- =====================================================================
-- Audit log centralizado de store_balances (aplicar no Supabase EXTERNO)
--
-- Como aplicar:
--   Via ext-sql-runner (action=run_sql) ou cole no SQL Editor do externo.
--
-- O que faz:
--   1) Garante a tabela financial_audit_log (se ainda não existir)
--   2) Cria trigger AFTER INSERT/UPDATE em store_balances que loga
--      before/after de repasse_pendente e comissao_pendente
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  store_id uuid,
  before_data jsonb,
  after_data jsonb,
  diff jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.financial_audit_log TO authenticated;
GRANT ALL ON public.financial_audit_log TO service_role;
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='financial_audit_log'
      AND policyname='audit_log_admin_select'
  ) THEN
    CREATE POLICY audit_log_admin_select ON public.financial_audit_log
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.audit_store_balances_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diff jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- ignora updates sem mudança real nos campos monetários
    IF NEW.repasse_pendente IS NOT DISTINCT FROM OLD.repasse_pendente
       AND NEW.comissao_pendente IS NOT DISTINCT FROM OLD.comissao_pendente
       AND COALESCE(NEW.pdv_commission_pending,0) IS NOT DISTINCT FROM COALESCE(OLD.pdv_commission_pending,0)
    THEN
      RETURN NEW;
    END IF;
    v_diff := jsonb_build_object(
      'repasse_pendente', (COALESCE(NEW.repasse_pendente,0) - COALESCE(OLD.repasse_pendente,0)),
      'comissao_pendente', (COALESCE(NEW.comissao_pendente,0) - COALESCE(OLD.comissao_pendente,0))
    );
    INSERT INTO public.financial_audit_log(kind, store_id, before_data, after_data, diff, source)
    VALUES ('store_balances_update', NEW.store_id, to_jsonb(OLD), to_jsonb(NEW), v_diff,
            current_setting('application_name', true));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_log(kind, store_id, before_data, after_data, source)
    VALUES ('store_balances_insert', NEW.store_id, NULL, to_jsonb(NEW),
            current_setting('application_name', true));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_store_balances ON public.store_balances;
CREATE TRIGGER trg_audit_store_balances
AFTER INSERT OR UPDATE ON public.store_balances
FOR EACH ROW EXECUTE FUNCTION public.audit_store_balances_change();