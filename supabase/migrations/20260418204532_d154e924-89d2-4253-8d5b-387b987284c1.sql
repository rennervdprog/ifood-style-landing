DROP POLICY IF EXISTS "Scoped realtime channel access" ON realtime.messages;

CREATE POLICY "Scoped realtime channel access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Canais públicos (broadcast aberto, sem dados sensíveis)
  realtime.topic() LIKE 'public:%'
  OR realtime.topic() LIKE 'stores:%'
  OR realtime.topic() LIKE 'products:%'
  OR realtime.topic() LIKE 'banners:%'
  OR realtime.topic() LIKE 'app_links:%'
  OR realtime.topic() LIKE 'menu_sections:%'
  OR realtime.topic() LIKE 'opening_hours:%'
  -- Canais escopados ao próprio usuário com prefixo seguro
  OR realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
  OR realtime.topic() LIKE ('order:' || auth.uid()::text || ':%')
  OR realtime.topic() LIKE ('driver:' || auth.uid()::text || ':%')
  OR realtime.topic() LIKE ('store:' || auth.uid()::text || ':%')
  -- Postgres changes (subscriptions a tabelas) — RLS da tabela já protege
  OR realtime.topic() LIKE 'realtime:%'
  -- Admins veem tudo
  OR public.has_role(auth.uid(), 'admin'::app_role)
);