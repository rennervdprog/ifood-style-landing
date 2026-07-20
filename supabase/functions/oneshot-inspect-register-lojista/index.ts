const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  // Audit all public RPCs — flag misconfigurations
  out.rpcs = await run(`
    SELECT p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END as sec,
           COALESCE((SELECT string_agg(c, ',') FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'), '') as search_path,
           l.lanname as lang,
           r.rolname as owner,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as svc,
           p.provolatile as vol
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang
    JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='public' AND l.lanname IN ('plpgsql','sql')
      AND p.proname NOT LIKE 'pgrst_%'
    ORDER BY p.proname;`);
  // Anon-callable RPCs sem checagem de auth.uid()/has_role/is_platform_admin — risco real
  out.risky_anon = await run(`
    SELECT p.proname as name, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.prosrc NOT ILIKE '%auth.uid()%'
      AND p.prosrc NOT ILIKE '%is_platform_admin%'
      AND p.prosrc NOT ILIKE '%has_role%'
      AND p.prosrc NOT ILIKE '%is_store_owner%'
      AND p.prosrc NOT ILIKE '%is_driver%'
      AND p.proname NOT LIKE 'tg_%'
      AND p.proname NOT IN ('set_order_number','update_store_rating','notify_record_sync','notify_order_sync','handle_new_user','handle_order_cash_transaction','handle_repasse_expiry','insert_order_status_chat_message','touch_ticket_on_message','award_loyalty_points','accrue_fixed_plan_split','accrue_moderator_earnings','accrue_pdv_fixed_fee','accumulate_pdv_commission','alert_negative_store_balance','apply_order_empties_debit','auto_finalize_stale_orders','create_store_driver_earning','enforce_free_delivery_threshold','enforce_store_balance_lock','ensure_lojista_has_store','expire_pending_pix_orders','force_auto_approve','force_store_auto_approve','generate_delivery_pin','guard_matriz_flag','legal_documents_enforce_single_current','notify_admins_new_approval','notify_order_status_zapi','prevent_driver_protected_fields_update','prevent_role_self_change','prevent_writes_on_matriz','release_scheduled_orders','sync_repasse_paid','cleanup_old_page_views','cleanup_refused_pix_proofs')
    ORDER BY p.proname;`);
  out.secret_fns = await run(`SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('get_service_role_key','get_supabase_url','get_backend_url');`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});