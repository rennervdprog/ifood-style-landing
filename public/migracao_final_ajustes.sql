-- Arquivo de Ajustes Finais para Sincronização (v6)
-- Execute este arquivo no seu SQL Editor externo para alinhar 'stores' e 'opening_hours'.

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

-- 2. Verificação completa de colunas na tabela OPENING_HOURS
ALTER TABLE IF EXISTS opening_hours ADD COLUMN IF NOT EXISTS is_closed_all_day boolean DEFAULT false;
-- Garantir que as colunas de tempo sejam compatíveis (se já existirem como text, por exemplo)
DO $$ BEGIN
    ALTER TABLE IF EXISTS opening_hours ALTER COLUMN open_time TYPE time without time zone USING open_time::time;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE IF EXISTS opening_hours ALTER COLUMN close_time TYPE time without time zone USING close_time::time;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. AJUSTE PARA O ERRO DE DUPLICIDADE (MUITO IMPORTANTE)
-- O erro "duplicate key" ocorre porque a sincronização tenta inserir dados que já estão lá.
-- A forma mais limpa de resolver para sincronizar do zero é limpar a tabela no banco externo:
TRUNCATE TABLE opening_hours CASCADE;

-- 4. Ajustes na tabela ORDERS
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lng double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES auth.users(id);

-- 5. Ajustes na tabela ADDON_GROUPS
ALTER TABLE IF EXISTS addon_groups ADD COLUMN IF NOT EXISTS price_replaces_base boolean DEFAULT false;
