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

const SQL = `
-- Configuração do bot por loja
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_config (
  store_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  trigger_keywords text[] NOT NULL DEFAULT ARRAY['oi','olá','ola','cardápio','cardapio','menu','pedido','quero pedir','boa noite','bom dia','boa tarde'],
  welcome_message text,
  offline_message text,
  escape_keywords text[] NOT NULL DEFAULT ARRAY['atendente','humano','pessoa','falar','ajuda'],
  accepted_payment_methods text[] NOT NULL DEFAULT ARRAY['pix','cash','card'],
  use_store_hours boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_bot_config TO authenticated;
GRANT ALL ON public.whatsapp_bot_config TO service_role;

ALTER TABLE public.whatsapp_bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wbc_owner_all ON public.whatsapp_bot_config;
CREATE POLICY wbc_owner_all ON public.whatsapp_bot_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = whatsapp_bot_config.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = whatsapp_bot_config.store_id AND s.user_id = auth.uid()));

-- Sessões ativas do bot (uma por telefone/loja)
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  phone text NOT NULL,
  current_step text NOT NULL DEFAULT 'welcome',
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  CONSTRAINT whatsapp_bot_sessions_uniq UNIQUE (store_id, phone)
);

CREATE INDEX IF NOT EXISTS whatsapp_bot_sessions_expires_idx
  ON public.whatsapp_bot_sessions (expires_at);

GRANT SELECT ON public.whatsapp_bot_sessions TO authenticated;
GRANT ALL ON public.whatsapp_bot_sessions TO service_role;

ALTER TABLE public.whatsapp_bot_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wbs_owner_read ON public.whatsapp_bot_sessions;
CREATE POLICY wbs_owner_read ON public.whatsapp_bot_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = whatsapp_bot_sessions.store_id AND s.user_id = auth.uid()));
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out = await run(SQL);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});