
-- Habilitar RLS na tabela realtime.messages (caso já não esteja)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem para idempotência
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Only admins can publish broadcasts" ON realtime.messages;

-- Política de leitura/inscrição: apenas usuários autenticados podem se inscrever
-- A autorização real dos dados é feita pelas RLS das tabelas de origem
-- (orders, order_messages, driver_locations, user_active_devices)
CREATE POLICY "Authenticated users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Política de escrita: apenas admins podem fazer broadcast direto
-- Mudanças via Postgres Changes não passam por aqui
CREATE POLICY "Only admins can publish broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));
