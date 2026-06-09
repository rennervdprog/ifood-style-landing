// One-shot: aplica REVOKE/GRANT no Supabase EXTERNO via Management API.
const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

const SQL = `
-- B1: remove escrita/trigger/truncate do anon em TODAS as tabelas public,
-- mantém apenas SELECT (RLS continua bloqueando dados sensíveis).
-- Garante grants corretos para authenticated/service_role.
DO $$
DECLARE
  r record;
  sensitive text[] := ARRAY[
    'user_roles','profiles','store_secrets','financial_transactions',
    'withdrawal_requests','store_balances','driver_balances','driver_earnings',
    'store_driver_earnings','fcm_tokens','onesignal_players','user_active_devices',
    'archived_accounts','fraud_attempts','asaas_webhook_events',
    'asaas_transfer_review_queue','admin_logs','compliance_alerts','payout_history',
    'partner_payouts','platform_partners','moderators','moderator_earnings',
    'moderator_referrals','wallet_transactions','user_wallet','refund_requests',
    'saved_addresses','terms_acceptance','cash_registers','cash_transactions',
    'pdv_sessions','pdv_movements','emergency_fund','plan_change_requests',
    'store_plans','store_drivers','drivers','coupon_uses','order_messages',
    'order_ratings','loyalty_points','geocode_cache','admin_settings'
  ];
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF r.tablename = ANY(sensitive) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.tablename);
    ELSE
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', r.tablename);
    END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
END $$;

-- B2: força o monthly-billing a tentar de novo nos planos vencidos
UPDATE public.store_plans
SET last_billing_attempt_at = NULL
WHERE is_active = true
  AND monthly_fee > 0
  AND (next_billing_date IS NULL OR next_billing_date <= now())
  AND (trial_ends_at IS NULL OR trial_ends_at <= now());
`;

Deno.serve(async () => {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    },
  );
  const text = await r.text();

  // B2: dispara monthly-billing no projeto EXTERNO usando a service key.
  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const EXT_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const billingRes = await fetch(`${EXT_URL}/functions/v1/monthly-billing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EXT_KEY}`,
      apikey: EXT_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ force: true }),
  });
  const billingText = await billingRes.text();

  return new Response(
    JSON.stringify({
      sql: { status: r.status, body: text },
      billing: { status: billingRes.status, body: billingText },
    }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});