-- Arquivo de Ajustes Finais para Sincronização (v5)
-- Execute este arquivo no seu SQL Editor externo para garantir que todas as colunas de 'stores' existam.

-- 1. Verificação completa de colunas na tabela STORES
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS force_closed boolean DEFAULT false;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_street text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_complement text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_neighborhood text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_reference text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_city text DEFAULT 'Itatinga';
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_state text DEFAULT 'SP';
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address_cep text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS delivery_mode text DEFAULT 'own';
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS own_delivery_fee numeric DEFAULT 0;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS asaas_account_id text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS asaas_wallet_id text;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 6;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_enabled boolean DEFAULT false;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_subscribed boolean DEFAULT false;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';

-- 2. Ajustes na tabela ORDERS (latitude/longitude e outros)
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lng double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES auth.users(id);

-- 3. Ajustes na tabela ADDON_GROUPS
ALTER TABLE IF EXISTS addon_groups ADD COLUMN IF NOT EXISTS price_replaces_base boolean DEFAULT false;
