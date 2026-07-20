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

// Funções que precisam de sessão logada (revogar só de anon)
const AUTH_ONLY = [
  "_apply_plan_change(uuid, store_plan_type, numeric, numeric, boolean, numeric, boolean, boolean, boolean)",
  "accrue_moderator_plan_fee(uuid, numeric)",
  "apparel_apply_credit(uuid, uuid, numeric)",
  "apparel_return_item(uuid, numeric, text)",
  "apparel_set_store_type(uuid, text)",
  "apply_wallet_discount(uuid, uuid, numeric)",
  "calculate_prorata_credit(uuid)",
  "check_plan_upgrade(uuid)",
  "clear_physical_payment_balance(uuid, text, numeric, numeric)",
  "driver_finish_delivery_offline(uuid, text, timestamp with time zone, text)",
  "get_pdv_session_summary(uuid)",
  "get_pdv_stats(uuid, integer)",
  "get_store_report(uuid, date, date)",
  "get_store_financial_summary(uuid)",
  "list_platform_wa_log(text, text, uuid, timestamp with time zone, timestamp with time zone, integer, integer)",
  "pdv_cancel_tab(uuid, text)",
  "pdv_finalize_sale(jsonb)",
  "pdv_remove_tab_item(uuid)",
  "platform_wa_stats()",
  "process_whatsapp_message(uuid, text, text)",
  "request_withdrawal_atomic(uuid, numeric, text, text)",
  "update_store_monthly_revenue(uuid, text)",
  "use_coupon(uuid, uuid, uuid)",
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

  // 2) REVOGA anon de funções que exigem sessão
  const ao: string[] = [];
  for (const f of AUTH_ONLY) {
    ao.push(`REVOKE EXECUTE ON FUNCTION public.${f} FROM anon;`);
  }
  results.auth_only = await sql(ao.join("\n"));

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