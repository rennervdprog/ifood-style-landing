-- Arquivo de Ajustes Finais para Sincronização (v4)
-- Execute este arquivo no seu SQL Editor externo para corrigir colunas faltantes de stores e orders.

-- 1. Ajustes na tabela stores
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS categories text[];
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_enabled boolean DEFAULT true;
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS app_subscribed boolean DEFAULT false;

-- 2. Ajustes na tabela orders
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lng double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES auth.users(id);

-- 3. Ajustes na tabela addon_groups
ALTER TABLE IF EXISTS addon_groups ADD COLUMN IF NOT EXISTS price_replaces_base boolean DEFAULT false;
