const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
async function sql(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}

// Funções que nunca deveriam ser chamadas por anon nem authenticated (só service_role via edge)
const SERVICE_ONLY = [
  "get_service_role_key()",
  "get_supabase_url()",
  "get_backend_url()",
];

// Nomes de funções cuja EXECUTE deve ser revogada de anon (todas as overloads)
const AUTH_ONLY_NAMES = [
  "_apply_plan_change","accrue_moderator_plan_fee","apparel_apply_credit","apparel_return_item",
  "apparel_set_store_type","apply_wallet_discount","calculate_prorata_credit","check_plan_upgrade",
  "clear_physical_payment_balance","driver_finish_delivery_offline","get_pdv_session_summary",
  "get_pdv_stats","get_store_report","get_store_financial_summary","list_platform_wa_log",
  "pdv_cancel_tab","pdv_finalize_sale","pdv_remove_tab_item","platform_wa_stats",
  "process_whatsapp_message","request_withdrawal_atomic","update_store_monthly_revenue","use_coupon",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const results: Record<string, unknown> = {};

  // 1) REVOGA anon + authenticated de funções sensíveis a secrets
  const svc: string[] = [];
  for (const f of SERVICE_ONLY) {
    svc.push(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC, anon, authenticated;`);
    svc.push(`GRANT EXECUTE ON FUNCTION public.${f} TO service_role;`);
  }
  results.service_only = await sql(svc.join("\n"));

  // 2) REVOGA anon de todas as overloads dessas funções
  const list = AUTH_ONLY_NAMES.map(n => `'${n}'`).join(',');
  results.auth_only = await sql(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
               FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public' AND p.proname IN (${list})
      LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
      END LOOP;
    END $$;`);

  // 3) Confirma novos privilégios
  results.verify = await sql(`
    SELECT p.proname,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'get_service_role_key','get_supabase_url','get_backend_url',
      'pdv_finalize_sale','request_withdrawal_atomic','process_whatsapp_message',
      '_apply_plan_change','clear_physical_payment_balance'
    ) ORDER BY p.proname;`);

  return new Response(JSON.stringify(results, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});