-- Migração API oficial do WhatsApp — prontidão (versionamento A7)
-- Versiona no repo o que já existe no banco (criado antes via SQL manual):
-- a coluna de canal da loja, a config oficial por loja e as tabelas do bot
-- guiado. Tudo idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS) — pode
-- rodar em banco novo ou no banco atual sem alterar dados.

-- 1) Canal ativo da loja: 'evolution' (padrão) | 'official'
ALTER TABLE public.store_whatsapp_config
  ADD COLUMN IF NOT EXISTS whatsapp_mode text NOT NULL DEFAULT 'evolution';

-- 2) Configuração da API oficial (Meta Cloud API) por loja
CREATE TABLE IF NOT EXISTS public.store_whatsapp_official_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  waba_id text,
  phone_number_id text,
  display_phone text,
  template_accepted text,
  template_out text,
  template_cancelled text,
  template_lang text NOT NULL DEFAULT 'pt_BR',
  status text NOT NULL DEFAULT 'pending',
  onboarded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT store_whatsapp_official_config_pkey PRIMARY KEY (id),
  CONSTRAINT store_whatsapp_official_config_store_id_key UNIQUE (store_id)
);
ALTER TABLE public.store_whatsapp_official_config ENABLE ROW LEVEL SECURITY;
-- Sem policies de propósito: acesso somente via service role (edge
-- functions), exatamente como está no banco.

-- 3) Bot guiado de pedidos: configuração por loja
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_config (
  store_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  trigger_keywords text[] NOT NULL DEFAULT ARRAY['oi','olá','ola','cardapio','cardápio','menu','pedido','pedir','quero','boa tarde','bom dia','boa noite','eai','e ai','fala','opa']::text[],
  welcome_message text,
  offline_message text,
  escape_keywords text[] NOT NULL DEFAULT ARRAY['atendente','humano','sair','cancelar','falar com alguem','falar com alguém']::text[],
  accepted_payment_methods text[] NOT NULL DEFAULT ARRAY['pix','cash','card']::text[],
  use_store_hours boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_bot_config_pkey PRIMARY KEY (store_id)
);
ALTER TABLE public.whatsapp_bot_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wbc_owner_all ON public.whatsapp_bot_config;
CREATE POLICY wbc_owner_all ON public.whatsapp_bot_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = whatsapp_bot_config.store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores s WHERE s.id = whatsapp_bot_config.store_id AND s.owner_id = auth.uid()));

-- 4) Bot guiado de pedidos: sessão por número (uma conversa por loja+número)
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  phone text NOT NULL,
  current_step text NOT NULL DEFAULT 'welcome',
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:15:00'::interval),
  CONSTRAINT whatsapp_bot_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_bot_sessions_store_id_phone_key UNIQUE (store_id, phone)
);
ALTER TABLE public.whatsapp_bot_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wbs_owner_read ON public.whatsapp_bot_sessions;
CREATE POLICY wbs_owner_read ON public.whatsapp_bot_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM stores s WHERE s.id = whatsapp_bot_sessions.store_id AND s.owner_id = auth.uid()));
