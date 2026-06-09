// One-shot: aplica REVOKE/GRANT no Supabase EXTERNO via Management API.
const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

const SQL = `
-- B1: remove escrita/trigger/truncate do anon em TODAS as tabelas public,
-- mantém apenas SELECT (RLS continua bloqueando dados sensíveis).
-- Garante grants corretos para authenticated/service_role.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', r.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
END $$;

-- Tabelas sensíveis: remove até SELECT do anon (só authenticated/service_role).
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.store_secrets FROM anon;
REVOKE ALL ON public.financial_transactions FROM anon;
REVOKE ALL ON public.withdrawal_requests FROM anon;
REVOKE ALL ON public.store_balances FROM anon;
REVOKE ALL ON public.driver_balances FROM anon;
REVOKE ALL ON public.driver_earnings FROM anon;
REVOKE ALL ON public.store_driver_earnings FROM anon;
REVOKE ALL ON public.fcm_tokens FROM anon;
REVOKE ALL ON public.onesignal_players FROM anon;
REVOKE ALL ON public.user_active_devices FROM anon;
REVOKE ALL ON public.archived_accounts FROM anon;
REVOKE ALL ON public.fraud_attempts FROM anon;
REVOKE ALL ON public.asaas_webhook_events FROM anon;
REVOKE ALL ON public.asaas_transfer_review_queue FROM anon;
REVOKE ALL ON public.admin_logs FROM anon;
REVOKE ALL ON public.compliance_alerts FROM anon;
REVOKE ALL ON public.payout_history FROM anon;
REVOKE ALL ON public.partner_payouts FROM anon;
REVOKE ALL ON public.platform_partners FROM anon;
REVOKE ALL ON public.moderators FROM anon;
REVOKE ALL ON public.moderator_earnings FROM anon;
REVOKE ALL ON public.moderator_referrals FROM anon;
REVOKE ALL ON public.wallet_transactions FROM anon;
REVOKE ALL ON public.user_wallet FROM anon;
REVOKE ALL ON public.refund_requests FROM anon;
REVOKE ALL ON public.saved_addresses FROM anon;
REVOKE ALL ON public.terms_acceptance FROM anon;
REVOKE ALL ON public.cash_registers FROM anon;
REVOKE ALL ON public.cash_transactions FROM anon;
REVOKE ALL ON public.pdv_sessions FROM anon;
REVOKE ALL ON public.pdv_movements FROM anon;
REVOKE ALL ON public.emergency_fund FROM anon;
REVOKE ALL ON public.plan_change_requests FROM anon;
REVOKE ALL ON public.store_plans FROM anon;

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
  return new Response(
    JSON.stringify({ status: r.status, body: text }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});