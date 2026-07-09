// Fase 1 do hardening — só mudanças seguras que NÃO quebram a UI:
// (a) revoga SELECT de colunas sensíveis para anon/authenticated (segredos, tokens, contatos).
// (b) revoga writes de anon em tabelas que não precisam de escrita pública.
// Nada de rewrite de policies USING true e nada de mexer em fraud_attempts/signup_attempts (podem depender de anon).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const SQL = `
-- =========================================================
-- (a) COLUMN-LEVEL REVOKE — esconde segredos do PostgREST anon/authenticated
-- PostgREST honra grants por coluna; select=* passa a retornar só o que tem grant.
-- =========================================================

-- stores: chave da subconta Asaas nunca deve sair pelo cliente
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' AND column_name='asaas_subaccount_api_key') THEN
    REVOKE SELECT (asaas_subaccount_api_key) ON public.stores FROM anon, authenticated;
  END IF;
END $$;

-- store_whatsapp_config: evolution api key e phone_number
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='store_whatsapp_config') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='store_whatsapp_config' AND column_name='evolution_api_key') THEN
      REVOKE SELECT (evolution_api_key) ON public.store_whatsapp_config FROM anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='store_whatsapp_config' AND column_name='phone_number') THEN
      REVOKE SELECT (phone_number) ON public.store_whatsapp_config FROM anon;
    END IF;
  END IF;
END $$;

-- profile_contacts (email/phone): revoga de anon apenas; authenticated mantém p/ RLS filtrar por dono
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profile_contacts') THEN
    REVOKE SELECT ON public.profile_contacts FROM anon;
  END IF;
END $$;

-- guest_customers: phone só via service_role/edge function
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='guest_customers') THEN
    REVOKE SELECT ON public.guest_customers FROM anon;
  END IF;
END $$;

-- user_fcm_tokens: token nunca deveria vazar
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_fcm_tokens') THEN
    REVOKE SELECT ON public.user_fcm_tokens FROM anon;
  END IF;
END $$;

-- restaurants (legado): phone
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='restaurants' AND column_name='phone') THEN
    REVOKE SELECT (phone) ON public.restaurants FROM anon;
  END IF;
END $$;

-- whatsapp_messages / whatsapp_sessions: leitura só service_role
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_messages') THEN
    REVOKE SELECT ON public.whatsapp_messages FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_sessions') THEN
    REVOKE SELECT ON public.whatsapp_sessions FROM anon;
  END IF;
END $$;

-- =========================================================
-- (b) REVOGAR writes de anon em tabelas de dados internos.
-- Só toca em tabelas onde a UI NÃO faz insert anônimo.
-- Preserva writes em: fraud_attempts, signup_attempts, guest_customers, page_views, geocode_cache, debug_store_logs, order_ratings (podem ser públicos).
-- =========================================================

-- lista conservadora de tabelas onde anon claramente não precisa escrever
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'stores','store_whatsapp_config','store_addons','store_balances','store_secrets',
    'restaurants','profile_contacts','profiles','user_fcm_tokens','user_roles',
    'whatsapp_messages','whatsapp_sessions','whatsapp_inbound_log','whatsapp_send_log',
    'asaas_subaccounts_registry','asaas_webhook_events','asaas_transfer_review_queue',
    'admin_settings','admin_logs','compliance_alerts','emergency_fund',
    'financial_transactions','moderator_earnings','partner_payouts','payout_history',
    'plan_change_requests','plan_templates','platform_partners','withdrawal_requests'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon;', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(JSON.stringify({ status: r.status, body: await r.text() }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});