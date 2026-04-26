-- Arquivo de Ajustes Finais para Sincronização (v3)
-- Execute este arquivo no seu SQL Editor externo para alinhar o esquema 100%.

-- 1. Tabela Stores
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS categories text[];
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_enabled boolean DEFAULT true;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_subscribed boolean DEFAULT false;

-- 2. Tabela Orders
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lng double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES auth.users(id);

-- 3. Tabela Addon Groups
ALTER TABLE IF EXISTS addon_groups ADD COLUMN IF NOT EXISTS price_replaces_base boolean DEFAULT false;

-- 4. Tabela Opening Hours
-- Algumas vezes o tipo da coluna pode variar, garantindo que seja compatível
ALTER TABLE IF EXISTS opening_hours ALTER COLUMN open_time TYPE text;
ALTER TABLE IF EXISTS opening_hours ALTER COLUMN close_time TYPE text;

-- 5. Tabelas de Suporte (Caso não existam)
CREATE TABLE IF NOT EXISTS banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text,
    subtitle text,
    image_url text,
    link_type text,
    link_value text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    min_order_value numeric DEFAULT 0,
    max_uses integer,
    used_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    first_order_only boolean DEFAULT false,
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 6. Garantir que as chaves estrangeiras de orders permitam a sincronização
-- Se order_items falhar por fkey, pode ser que o ID da order ainda não tenha sido processado no banco externo.
-- A sincronização do Lovable tenta enviar em ordem, mas garantir que as tabelas existam ajuda.

-- 7. Limpeza preventiva (OPCIONAL)
-- Se você quiser garantir que não haja erros de "duplicate key", descomente as linhas abaixo:
-- TRUNCATE opening_hours CASCADE;
-- TRUNCATE orders CASCADE;
