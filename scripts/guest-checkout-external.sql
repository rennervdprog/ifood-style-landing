-- ============================================================================
-- Guest Checkout (piloto Itatinga)
-- Executar UMA vez no Supabase EXTERNO (qkjhguziuchqsbxzruea)
-- via SQL Editor. Idempotente.
-- ============================================================================

-- 1) Tabela de mapeamento telefone -> user_id (auth.users sintético)
CREATE TABLE IF NOT EXISTS public.guest_customers (
  phone        text PRIMARY KEY,             -- somente dígitos, E.164 sem '+'
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text,
  city_slug    text,                         -- ex.: 'itatinga'
  last_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  consent_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_customers_user_id
  ON public.guest_customers(user_id);

CREATE INDEX IF NOT EXISTS idx_guest_customers_city
  ON public.guest_customers(city_slug);

-- Sem GRANT para anon/authenticated — acesso somente via edge functions
-- (service_role bypassa RLS mesmo com policies bloqueando tudo).
ALTER TABLE public.guest_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_customers_no_access" ON public.guest_customers;
CREATE POLICY "guest_customers_no_access"
  ON public.guest_customers FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

GRANT ALL ON public.guest_customers TO service_role;

-- 2) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_guest_customers_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_guest_customers_touch ON public.guest_customers;
CREATE TRIGGER trg_guest_customers_touch
  BEFORE UPDATE ON public.guest_customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_guest_customers_touch();

-- 3) Coluna opcional em stores: liga/desliga guest checkout por loja
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS guest_checkout_enabled boolean NOT NULL DEFAULT false;

-- 4) Habilitar automaticamente para todas as lojas de Itatinga
UPDATE public.stores
   SET guest_checkout_enabled = true
 WHERE lower(coalesce(address_city, '')) = 'itatinga'
   AND guest_checkout_enabled = false;

-- 5) Marcar pedidos guest (para relatórios) — coluna opcional
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_is_guest
  ON public.orders(is_guest) WHERE is_guest = true;

-- ============================================================================
-- FIM. Nenhuma mudança em RLS de orders/saved_addresses:
-- edge functions usam service_role para inserir em nome do usuário sintético.
-- ============================================================================