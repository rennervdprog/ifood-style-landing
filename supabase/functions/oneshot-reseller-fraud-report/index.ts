// Installs admin_reseller_fraud_report() RPC on external Supabase.
// Returns recent fraud cron runs + currently blocked resellers + blocked referrals.
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
CREATE OR REPLACE FUNCTION public.admin_reseller_fraud_report(_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_runs JSONB;
  v_blocked_resellers JSONB;
  v_blocked_referrals JSONB;
  v_last_alerts JSONB;
  v_summary JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'created_at') DESC), '[]'::jsonb) INTO v_runs
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'created_at', created_at,
      'dry_run', dry_run,
      'processed', processed,
      'blocked', COALESCE((details->>'blocked')::int, 0),
      'alerts_count', COALESCE(jsonb_array_length(details->'alerts'), 0)
    ) AS x
    FROM public.reseller_cron_runs
    WHERE function_name = 'reseller_run_fraud_check'
    ORDER BY created_at DESC
    LIMIT _limit
  ) t;

  SELECT COALESCE(details->'alerts', '[]'::jsonb) INTO v_last_alerts
  FROM public.reseller_cron_runs
  WHERE function_name = 'reseller_run_fraud_check'
    AND dry_run = false
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'code', r.code, 'email', r.email,
    'notes', r.notes, 'updated_at', r.updated_at,
    'total_referrals', (SELECT count(*) FROM public.reseller_referrals rr WHERE rr.reseller_id = r.id)
  ) ORDER BY r.updated_at DESC), '[]'::jsonb) INTO v_blocked_resellers
  FROM public.resellers r
  WHERE r.status = 'blocked';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', rr.id,
    'reseller_id', rr.reseller_id,
    'reseller_code', r.code,
    'store_id', rr.store_id,
    'store_name', s.name,
    'updated_at', rr.updated_at
  ) ORDER BY rr.updated_at DESC), '[]'::jsonb) INTO v_blocked_referrals
  FROM public.reseller_referrals rr
  JOIN public.resellers r ON r.id = rr.reseller_id
  LEFT JOIN public.stores s ON s.id = rr.store_id
  WHERE rr.status = 'blocked';

  v_summary := jsonb_build_object(
    'blocked_resellers_count', jsonb_array_length(v_blocked_resellers),
    'blocked_referrals_count', jsonb_array_length(v_blocked_referrals),
    'last_run_alerts', COALESCE(jsonb_array_length(v_last_alerts), 0)
  );

  RETURN jsonb_build_object(
    'summary', v_summary,
    'runs', v_runs,
    'last_alerts', COALESCE(v_last_alerts, '[]'::jsonb),
    'blocked_resellers', v_blocked_resellers,
    'blocked_referrals', v_blocked_referrals
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_reseller_fraud_report(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_fraud_report(INT) TO authenticated;

-- Unblock helper (undo false positives)
CREATE OR REPLACE FUNCTION public.admin_reseller_unblock(_reseller_id UUID, _reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  UPDATE public.resellers
     SET status = 'approved',
         notes = COALESCE(notes,'') || E'\n[' || now()::text || '] unblocked by admin: ' || COALESCE(_reason,'—'),
         updated_at = now()
   WHERE id = _reseller_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_reseller_unblock(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_unblock(UUID, TEXT) TO authenticated;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.install = await q(SQL);
  out.sample = await q(`SELECT public.admin_reseller_fraud_report(5) AS r;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});