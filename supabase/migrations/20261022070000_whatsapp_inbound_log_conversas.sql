-- Conversas do WhatsApp no painel: leitura do registro de mensagens
-- (whatsapp_inbound_log) pelo dono da loja e pelo suporte.
-- As colunas message/push_name/direction guardam o texto da conversa
-- (direction: 'in' = cliente -> loja, 'out' = loja -> cliente).
ALTER TABLE whatsapp_inbound_log ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE whatsapp_inbound_log ADD COLUMN IF NOT EXISTS push_name text;
ALTER TABLE whatsapp_inbound_log ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'in';

DROP POLICY IF EXISTS lojista_own_inbound ON whatsapp_inbound_log;
CREATE POLICY lojista_own_inbound ON whatsapp_inbound_log
  FOR SELECT USING (store_id IN (SELECT stores.id FROM stores WHERE stores.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS suporte_all_inbound ON whatsapp_inbound_log;
CREATE POLICY suporte_all_inbound ON whatsapp_inbound_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = (SELECT auth.uid()) AND (profiles.role)::text = ANY (ARRAY['suporte'::text, 'lojista_matriz'::text])));
