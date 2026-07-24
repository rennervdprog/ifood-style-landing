const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  out["1_columns_store_plans"] = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='store_plans'
    ORDER BY ordinal_position;`);

  out["2_active_plans_by_type"] = await q(`
    SELECT plan_type,
           count(*) AS lojas,
           min(monthly_fee) AS min_fee,
           max(monthly_fee) AS max_fee,
           avg(monthly_fee)::numeric(10,2) AS avg_fee,
           sum(monthly_fee) AS mrr_total
    FROM public.store_plans
    WHERE is_active = true
    GROUP BY plan_type
    ORDER BY plan_type;`);

  // Divergências: monthly_fee ≠ preço oficial do template ativo
  out["3_price_mismatch_vs_template"] = await q(`
    SELECT sp.store_id, s.name, sp.plan_type,
           sp.monthly_fee AS cobrado,
           t.monthly_fee AS oficial,
           (sp.monthly_fee - t.monthly_fee) AS diff
    FROM public.store_plans sp
    JOIN public.plan_templates t ON t.plan_type = sp.plan_type
    LEFT JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.is_active = true AND t.is_active = true
      AND sp.monthly_fee IS DISTINCT FROM t.monthly_fee
      AND sp.plan_type IN ('fixed','autonomy','pdv_only')
    ORDER BY sp.plan_type;`);

  // Lojas em planos legados (hybrid/commission_only) — templates desativados
  out["4_stores_on_legacy_plans"] = await q(`
    SELECT sp.store_id, s.name, sp.plan_type, sp.monthly_fee, sp.next_billing_date
    FROM public.store_plans sp
    LEFT JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.is_active = true AND sp.plan_type IN ('hybrid','commission_only')
    ORDER BY sp.plan_type;`);

  // Cobranças em atraso (fixed/pdv_only têm next_billing_date obrigatório)
  out["5_overdue"] = await q(`
    SELECT sp.store_id, s.name, sp.plan_type, sp.monthly_fee,
           sp.next_billing_date,
           (now()::date - sp.next_billing_date::date) AS days_overdue
    FROM public.store_plans sp
    LEFT JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.is_active = true
      AND sp.plan_type IN ('fixed','pdv_only')
      AND sp.next_billing_date IS NOT NULL
      AND sp.next_billing_date < now()
    ORDER BY days_overdue DESC;`);

  // fixed/pdv_only SEM next_billing_date — cron não vai cobrar
  out["6_missing_next_billing"] = await q(`
    SELECT sp.store_id, s.name, sp.plan_type, sp.monthly_fee, sp.created_at
    FROM public.store_plans sp
    LEFT JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.is_active = true
      AND sp.plan_type IN ('fixed','pdv_only')
      AND sp.next_billing_date IS NULL
    ORDER BY sp.created_at;`);

  // Autonomia com GMV alto que já deveriam estar pagando R$ 199,90
  out["7_autonomy_high_gmv"] = await q(`
    WITH gmv AS (
      SELECT store_id, coalesce(sum(total_price),0) AS gmv_mes
      FROM public.orders
      WHERE status='entregue'
        AND created_at >= date_trunc('month', now())
      GROUP BY store_id
    )
    SELECT sp.store_id, s.name, sp.monthly_fee, gmv.gmv_mes,
           sp.next_billing_date
    FROM public.store_plans sp
    JOIN public.stores s ON s.id = sp.store_id
    LEFT JOIN gmv ON gmv.store_id = sp.store_id
    WHERE sp.is_active = true AND sp.plan_type='autonomy'
      AND coalesce(gmv.gmv_mes,0) >= 2500
    ORDER BY gmv.gmv_mes DESC;`);

  // VIP vitalícia — não deve gerar cobrança
  out["8_vip_lifetime"] = await q(`
    SELECT sp.store_id, s.name, sp.plan_type, sp.monthly_fee,
           coalesce(sp.essencial_lifetime_free,false) AS essencial_vip,
           coalesce(sp.autonomy_lifetime_free,false)  AS autonomy_vip
    FROM public.store_plans sp
    JOIN public.stores s ON s.id = sp.store_id
    WHERE sp.is_active=true
      AND (coalesce(sp.essencial_lifetime_free,false) OR coalesce(sp.autonomy_lifetime_free,false));`);

  // Crons de cobrança
  out["9_billing_crons"] = await q(`
    SELECT jobname, schedule, active
    FROM cron.job
    WHERE jobname ILIKE '%billing%' OR jobname ILIKE '%plan%' OR jobname ILIKE '%mensalidade%' OR jobname ILIKE '%charge%'
    ORDER BY jobname;`);

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});