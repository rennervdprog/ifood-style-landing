const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sql = `
    -- 1) FIXED não-VIP → subir para R$ 89,90 e agendar próxima cobrança para hoje+30d
    UPDATE public.store_plans
       SET monthly_fee = 89.90,
           next_billing_date = (now() + interval '30 days'),
           updated_at = now()
     WHERE is_active = true
       AND plan_type = 'fixed'
       AND coalesce(essencial_lifetime_free, false) = false;

    -- 2) FIXED VIP vitalícia → força R$ 0 e limpa next_billing_date (nunca cobra)
    UPDATE public.store_plans
       SET monthly_fee = 0,
           next_billing_date = NULL,
           updated_at = now()
     WHERE is_active = true
       AND plan_type = 'fixed'
       AND coalesce(essencial_lifetime_free, false) = true;

    -- 3) PDV Only sem next_billing_date → agenda para hoje+30d a partir da ativação
    UPDATE public.store_plans
       SET next_billing_date = coalesce(pdv_only_activated_at, started_at, created_at) + interval '30 days',
           updated_at = now()
     WHERE is_active = true
       AND plan_type = 'pdv_only'
       AND next_billing_date IS NULL;

    -- 4) Se a data calculada acima ficou no passado, empurra para hoje+7d (dá grace)
    UPDATE public.store_plans
       SET next_billing_date = (now() + interval '7 days')
     WHERE is_active = true
       AND plan_type IN ('pdv_only','fixed')
       AND next_billing_date IS NOT NULL
       AND next_billing_date < now()
       AND coalesce(essencial_lifetime_free,false) = false;

    -- 5) DEFAULT permanente: novos store_plans nascem com next_billing_date = now()+30d
    ALTER TABLE public.store_plans
      ALTER COLUMN next_billing_date SET DEFAULT (now() + interval '30 days');

    -- Snapshot pós-fix
    SELECT plan_type,
           count(*) AS lojas,
           sum(monthly_fee) AS mrr_total,
           count(*) FILTER (WHERE next_billing_date IS NULL) AS sem_next,
           count(*) FILTER (WHERE next_billing_date < now()) AS vencidas
      FROM public.store_plans
     WHERE is_active = true
     GROUP BY plan_type
     ORDER BY plan_type;
  `;

  const r = await q(sql);
  return new Response(JSON.stringify(r, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});