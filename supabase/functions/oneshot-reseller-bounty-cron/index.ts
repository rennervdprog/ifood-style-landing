// v1.24.0 — Fase 5.1: cron diário de bounty
// Instala:
//   1) public.reseller_cron_runs (auditoria de execuções)
//   2) public.reseller_process_bounties(_dry_run bool) RPC idempotente
//   3) Schedule pg_cron 'reseller-bounty-daily' rodando 03:00 UTC
//
// Regras:
//   - Referral status='pending' vira 'active' quando:
//       a) store possui >= 20 pedidos com status='entregue' nos últimos 30 dias
//       b) stores.whatsapp_verified_at IS NOT NULL
//   - Ao ativar, cria commission type='bounty' com valor = resellers.bounty_amount_cents
//     (default 15000 = R$ 150). Unique index já impede duplicata.
//   - _dry_run=true retorna candidatos sem alterar dados.
//   - Chamável via HTTP para teste manual (POST { dry_run: true }).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}

const SQL_INSTALL = `
-- 1) Tabela de auditoria de crons
CREATE TABLE IF NOT EXISTS public.reseller_cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dry_run BOOLEAN NOT NULL DEFAULT false,
  processed INTEGER NOT NULL DEFAULT 0,
  credited_cents BIGINT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_reseller_cron_runs_fn ON public.reseller_cron_runs(function_name, run_at DESC);
GRANT SELECT ON public.reseller_cron_runs TO authenticated;
GRANT ALL ON public.reseller_cron_runs TO service_role;
ALTER TABLE public.reseller_cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reseller_cron_runs_admin_read" ON public.reseller_cron_runs;
CREATE POLICY "reseller_cron_runs_admin_read" ON public.reseller_cron_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 2) RPC de processamento de bounty
CREATE OR REPLACE FUNCTION public.reseller_process_bounties(_dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
  v_processed INT := 0;
  v_credited BIGINT := 0;
  v_bounty_cents INT;
  v_candidates JSONB := '[]'::jsonb;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  FOR v_row IN
    SELECT
      rr.id           AS referral_id,
      rr.reseller_id,
      rr.store_id,
      r.bounty_amount_cents,
      s.name          AS store_name,
      s.whatsapp_verified_at,
      (SELECT count(*) FROM public.orders o
         WHERE o.store_id = rr.store_id
           AND o.status = 'entregue'
           AND o.created_at >= now() - interval '30 days') AS delivered_30d
    FROM public.reseller_referrals rr
    JOIN public.resellers r ON r.id = rr.reseller_id AND r.status = 'approved'
    JOIN public.stores s    ON s.id = rr.store_id
    WHERE rr.status = 'pending'
  LOOP
    IF v_row.delivered_30d < 20 OR v_row.whatsapp_verified_at IS NULL THEN
      CONTINUE;
    END IF;

    -- Idempotência extra (além do unique index): pula se já existe bounty
    IF EXISTS (
      SELECT 1 FROM public.reseller_commissions
      WHERE reseller_id = v_row.reseller_id
        AND store_id = v_row.store_id
        AND type = 'bounty'
    ) THEN
      CONTINUE;
    END IF;

    v_bounty_cents := COALESCE(v_row.bounty_amount_cents, 15000);
    v_candidates := v_candidates || jsonb_build_object(
      'referral_id', v_row.referral_id,
      'reseller_id', v_row.reseller_id,
      'store_id',    v_row.store_id,
      'store_name',  v_row.store_name,
      'bounty_cents', v_bounty_cents,
      'delivered_30d', v_row.delivered_30d
    );

    IF NOT _dry_run THEN
      BEGIN
        UPDATE public.reseller_referrals
          SET status = 'active', activated_at = now(), updated_at = now()
          WHERE id = v_row.referral_id;

        INSERT INTO public.reseller_commissions(
          reseller_id, store_id, type, amount_cents, status, metadata
        ) VALUES (
          v_row.reseller_id, v_row.store_id, 'bounty', v_bounty_cents, 'pending',
          jsonb_build_object(
            'source', 'cron_bounty',
            'delivered_30d', v_row.delivered_30d,
            'triggered_at', now()
          )
        );

        v_processed := v_processed + 1;
        v_credited  := v_credited + v_bounty_cents;
      EXCEPTION WHEN unique_violation THEN
        -- corrida com outra execução; ignora
        NULL;
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'referral_id', v_row.referral_id,
          'error', SQLERRM
        );
      END;
    END IF;
  END LOOP;

  INSERT INTO public.reseller_cron_runs(
    function_name, dry_run, processed, credited_cents, details, errors_json
  ) VALUES (
    'reseller_process_bounties', _dry_run, v_processed, v_credited,
    jsonb_build_object('candidates', v_candidates),
    CASE WHEN jsonb_array_length(v_errors) > 0 THEN v_errors ELSE NULL END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', _dry_run,
    'processed', v_processed,
    'credited_cents', v_credited,
    'candidates', v_candidates,
    'errors', v_errors
  );
END $$;

REVOKE ALL ON FUNCTION public.reseller_process_bounties(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_process_bounties(BOOLEAN) TO service_role;

-- Wrapper admin (para chamar via app no Super Admin)
CREATE OR REPLACE FUNCTION public.admin_reseller_run_bounty_cron(_dry_run BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN public.reseller_process_bounties(_dry_run);
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_run_bounty_cron(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_run_bounty_cron(BOOLEAN) TO authenticated;

-- 3) Schedule pg_cron: diário 03:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
DECLARE v_jobid INT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'reseller-bounty-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'reseller-bounty-daily',
    '0 3 * * *',
    $c$ SELECT public.reseller_process_bounties(false); $c$
  );
END $$;
`;

const SQL_RUN = (dry: boolean) =>
  `SELECT public.reseller_process_bounties(${dry ? "true" : "false"}) AS result;`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "install";

  if (mode === "install") {
    const r = await q(SQL_INSTALL);
    return new Response(JSON.stringify({ ok: r.status < 300, status: r.status, body: r.body }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (mode === "run" || mode === "dryrun") {
    const dry = mode === "dryrun";
    const r = await q(SQL_RUN(dry));
    return new Response(JSON.stringify({ ok: r.status < 300, status: r.status, body: r.body }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: false, error: "invalid mode (install|run|dryrun)" }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
});