-- Arquivo de Ajustes Finais para Sincronização
-- Execute este arquivo para garantir que todas as colunas e tabelas necessárias existam.

-- 1. Tabela Stores (Adicionando colunas que podem estar faltando)
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_enabled boolean DEFAULT true;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_subscribed boolean DEFAULT false;

-- 2. Tabela Addon Groups
ALTER TABLE IF EXISTS addon_groups ADD COLUMN IF NOT EXISTS price_replaces_base boolean DEFAULT false;

-- 3. Tabela Orders
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES auth.users(id);

-- 4. Tabela Drivers (Verificando estrutura para sincronização)
CREATE TABLE IF NOT EXISTS drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    vehicle_info text,
    is_available boolean DEFAULT false,
    is_online boolean DEFAULT false,
    current_lat numeric,
    current_lng numeric,
    city text,
    last_location_update timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 5. Tabelas Financeiras (Caso não existam)
CREATE TABLE IF NOT EXISTS driver_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    total_earned numeric DEFAULT 0,
    pending_amount numeric DEFAULT 0,
    paid_amount numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    balance numeric DEFAULT 0,
    pending_balance numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_earnings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    transaction_kind financial_transaction_type,
    reference_code text,
    amount numeric NOT NULL,
    status financial_transaction_status DEFAULT 'pending',
    provider text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. Tabela Coupons
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
