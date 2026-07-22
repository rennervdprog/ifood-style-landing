// v1.24.1 + v1.24.2 — Recurring monthly cron + Weekly anti-fraud cron
// Instala:
//   - reseller_process_recurring(_ref_month TEXT DEFAULT NULL, _dry_run BOOL)
//   - reseller_run_fraud_check(_dry_run BOOL)
//   - crons: 'reseller-recurring-monthly' (dia 5, 04:00 UTC), 'reseller-fraud-weekly' (dom 05:00)
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
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

const SQL = `
-- ============ v1.24.1: Recurring monthly cron ============
CREATE OR REPLACE FUNCTION public.reseller_process_recurring(
  _ref_month TEXT DEFAULT NULL,   -- 'YYYY-MM'; NULL = mês anterior
  _dry_run BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref TEXT;
  v_start DATE; v_end DATE;
  v_row RECORD;
  v_processed INT := 0;
  v_credited BIGINT := 0;
  v_amount_cents INT;
  v_candidates JSONB := '[]'::jsonb;
BEGIN
  v_ref := COALESCE(_ref_month, to_char((now() - interval '1 month') AT TIME ZONE 'UTC', 'YYYY-MM'));
  v_start := to_date(v_ref || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month')::date;

  FOR v_row IN
    SELECT
      rr.reseller_id,
      rr.store_id,
      r.commission_rate,
      sp.plan_type,
      sp.monthly_fee,
      sp.last_billed_at,
      sp.is_active,
      s.name AS store_name,
      s.status AS store_status
    FROM public.reseller_referrals rr
    JOIN public.resellers r ON r.id = rr.reseller_id AND r.status='approved'
    JOIN public.stores s ON s.id = rr.store_id
    JOIN public.store_plans sp ON sp.store_id = rr.store_id
    WHERE rr.status = 'active'
      AND sp.is_active = true
      AND s.status NOT IN ('cancelada','suspensa','arquivada')
      AND sp.last_billed_at >= v_start
      AND sp.last_billed_at <  v_end
      AND COALESCE(sp.monthly_fee,0) > 0
  LOOP
    v_amount_cents := ROUND(v_row.commission_rate * v_row.monthly_fee * 100)::int;
    IF v_amount_cents <= 0 THEN CONTINUE; END IF;

    -- idempotente por (reseller, store, mês, recurring)
    IF EXISTS (
      SELECT 1 FROM public.reseller_commissions
      WHERE reseller_id = v_row.reseller_id
        AND store_id = v_row.store_id
        AND type = 'recurring'
        AND reference_month = v_ref
    ) THEN
      CONTINUE;
    END IF;

    v_candidates := v_candidates || jsonb_build_object(
      'reseller_id', v_row.reseller_id,
      'store_id', v_row.store_id,
      'store', v_row.store_name,
      'plan', v_row.plan_type,
      'monthly_fee', v_row.monthly_fee,
      'rate', v_row.commission_rate,
      'amount_cents', v_amount_cents
    );

    IF NOT _dry_run THEN
      INSERT INTO public.reseller_commissions(
        reseller_id, store_id, type, amount_cents, reference_month, status, metadata
      ) VALUES (
        v_row.reseller_id, v_row.store_id, 'recurring', v_amount_cents, v_ref, 'pending',
        jsonb_build_object('plan_type', v_row.plan_type, 'monthly_fee', v_row.monthly_fee,
                           'commission_rate', v_row.commission_rate,
                           'billed_at', v_row.last_billed_at)
      );
      v_processed := v_processed + 1;
      v_credited := v_credited + v_amount_cents;
    END IF;
  END LOOP;

  INSERT INTO public.reseller_cron_runs(function_name, dry_run, processed, credited_cents, details)
  VALUES ('reseller_process_recurring', _dry_run, v_processed, v_credited,
          jsonb_build_object('ref_month', v_ref, 'candidates', v_candidates));

  RETURN jsonb_build_object(
    'ref_month', v_ref, 'dry_run', _dry_run,
    'processed', v_processed, 'credited_cents', v_credited,
    'candidates', v_candidates
  );
END $$;
REVOKE ALL ON FUNCTION public.reseller_process_recurring(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_process_recurring(TEXT, BOOLEAN) TO service_role;

-- admin trigger manual
CREATE OR REPLACE FUNCTION public.admin_reseller_run_recurring_cron(
  _ref_month TEXT DEFAULT NULL, _dry_run BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  RETURN public.reseller_process_recurring(_ref_month, _dry_run);
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_run_recurring_cron(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_run_recurring_cron(TEXT, BOOLEAN) TO authenticated;

-- ============ v1.24.2: Weekly anti-fraud ============
CREATE OR REPLACE FUNCTION public.reseller_run_fraud_check(_dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
  v_blocked INT := 0;
  v_alerts JSONB := '[]'::jsonb;
  v_ratio NUMERIC;
BEGIN
  -- 1) Ghost ratio: revendedores approved com >= 5 indicações e ratio de fantasmas > 30%
  FOR v_row IN
    SELECT r.id, r.code, r.user_id,
           count(rr.id) AS total_refs,
           count(rr.id) FILTER (
             WHERE NOT EXISTS (
               SELECT 1 FROM public.orders o
               WHERE o.store_id = rr.store_id
                 AND o.created_at >= now() - interval '90 days'
             )
           ) AS ghost_refs
    FROM public.resellers r
    JOIN public.reseller_referrals rr ON rr.reseller_id = r.id
    WHERE r.status = 'approved'
    GROUP BY r.id, r.code, r.user_id
    HAVING count(rr.id) >= 5
  LOOP
    v_ratio := v_row.ghost_refs::numeric / GREATEST(v_row.total_refs,1);
    IF v_ratio > 0.30 THEN
      v_alerts := v_alerts || jsonb_build_object(
        'reseller_id', v_row.id, 'code', v_row.code,
        'reason', 'ghost_ratio',
        'ghost_refs', v_row.ghost_refs, 'total_refs', v_row.total_refs,
        'ratio', v_ratio
      );
      IF NOT _dry_run THEN
        UPDATE public.resellers
           SET status='blocked',
               notes = COALESCE(notes,'') || E'\n[' || now()::text || '] auto-block ghost_ratio=' || round(v_ratio*100)::text || '%',
               updated_at = now()
         WHERE id = v_row.id;
        v_blocked := v_blocked + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2) Auto-indicação: dono da loja indicada é o próprio revendedor (bater user_id)
  FOR v_row IN
    SELECT rr.id AS referral_id, rr.reseller_id, rr.store_id, r.code
    FROM public.reseller_referrals rr
    JOIN public.resellers r ON r.id = rr.reseller_id
    JOIN public.stores s ON s.id = rr.store_id
    WHERE r.status = 'approved'
      AND rr.status IN ('pending','active')
      AND s.owner_id = r.user_id
  LOOP
    v_alerts := v_alerts || jsonb_build_object(
      'reseller_id', v_row.reseller_id, 'code', v_row.code,
      'reason', 'self_referral', 'referral_id', v_row.referral_id, 'store_id', v_row.store_id
    );
    IF NOT _dry_run THEN
      UPDATE public.reseller_referrals
         SET status='blocked', updated_at=now()
       WHERE id = v_row.referral_id;
      UPDATE public.resellers
         SET notes = COALESCE(notes,'') || E'\n[' || now()::text || '] self_referral store=' || v_row.store_id::text
       WHERE id = v_row.reseller_id;
    END IF;
  END LOOP;

  INSERT INTO public.reseller_cron_runs(function_name, dry_run, processed, credited_cents, details)
  VALUES ('reseller_run_fraud_check', _dry_run, jsonb_array_length(v_alerts), 0,
          jsonb_build_object('alerts', v_alerts, 'blocked', v_blocked));

  RETURN jsonb_build_object('dry_run', _dry_run, 'alerts', v_alerts, 'blocked_resellers', v_blocked);
END $$;
REVOKE ALL ON FUNCTION public.reseller_run_fraud_check(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_run_fraud_check(BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_reseller_run_fraud_cron(_dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  RETURN public.reseller_run_fraud_check(_dry_run);
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_run_fraud_cron(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_run_fraud_cron(BOOLEAN) TO authenticated;

-- ============ Schedule crons ============
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('reseller-recurring-monthly')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='reseller-recurring-monthly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'reseller-recurring-monthly',
  '0 4 5 * *',
  $cron$ SELECT public.reseller_process_recurring(NULL, false); $cron$
);

DO $$
BEGIN
  PERFORM cron.unschedule('reseller-fraud-weekly')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='reseller-fraud-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'reseller-fraud-weekly',
  '0 5 * * 0',
  $cron$ SELECT public.reseller_run_fraud_check(false); $cron$
);
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.install = await q(SQL);
  out.dry_recurring = await q(`SELECT public.reseller_process_recurring(NULL, true) AS r;`);
  out.dry_fraud = await q(`SELECT public.reseller_run_fraud_check(true) AS r;`);
  out.crons = await q(`SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'reseller%' ORDER BY jobname;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});