-- =========================================
-- 1) RESTRINGIR realtime.messages POR TÓPICO
-- =========================================
-- Antes: qualquer authenticated podia escutar QUALQUER canal.
-- Depois: só escuta canais cujo tópico contenha o próprio user_id,
-- ou canais públicos prefixados (public:, store:, order:OWN).
-- Mantemos broadcast geral para canais "public:*" para não quebrar
-- realtime de produtos/lojas.

DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Allow authenticated to read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can read messages" ON realtime.messages;

CREATE POLICY "Scoped realtime channel access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Canais públicos (lojas, produtos, etc.)
  realtime.topic() LIKE 'public:%'
  OR realtime.topic() LIKE 'stores:%'
  OR realtime.topic() LIKE 'products:%'
  OR realtime.topic() LIKE 'banners:%'
  OR realtime.topic() LIKE 'app_links:%'
  -- Canais que contenham o próprio user_id no nome
  OR realtime.topic() LIKE '%' || auth.uid()::text || '%'
  -- Admins veem tudo
  OR public.has_role(auth.uid(), 'admin'::app_role)
  -- Postgres changes (subscriptions a tabelas) — controlado por RLS da tabela
  OR realtime.topic() LIKE 'realtime:%'
);

-- =========================================
-- 2) user_active_devices: adicionar políticas faltantes
-- =========================================
-- Já existe SELECT própria. Adicionar INSERT/UPDATE/DELETE escopadas.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_active_devices' AND policyname='Users can insert own device'
  ) THEN
    CREATE POLICY "Users can insert own device"
    ON public.user_active_devices
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_active_devices' AND policyname='Users can update own device'
  ) THEN
    CREATE POLICY "Users can update own device"
    ON public.user_active_devices
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_active_devices' AND policyname='Users can delete own device'
  ) THEN
    CREATE POLICY "Users can delete own device"
    ON public.user_active_devices
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- =========================================
-- 3) page_views: permitir INSERT escopado
-- =========================================
-- A função record_page_view() já é SECURITY DEFINER e funciona,
-- mas adicionamos política explícita para writes diretos seguros.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='page_views' AND policyname='Anyone can record page view'
  ) THEN
    CREATE POLICY "Anyone can record page view"
    ON public.page_views
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      -- Se autenticado, user_id deve ser o próprio (ou null para visitor anônimo)
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL))
    );
  END IF;
END $$;