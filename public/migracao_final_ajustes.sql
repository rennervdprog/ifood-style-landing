-- Arquivo de Ajustes Finais para Sincronização (v2)
-- Execute este arquivo no seu SQL Editor para corrigir as colunas faltantes.

-- 1. Tabela Stores (Adicionando 'categories')
ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS categories text[];

-- 2. Tabela Orders (Adicionando 'client_lat' e 'client_lng')
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS client_lng double precision;

-- 3. Limpeza para evitar erros de duplicidade (Opcional, mas recomendado se quiser sincronizar do zero)
-- DELETE FROM opening_hours;
-- DELETE FROM order_items;
-- DELETE FROM order_messages;
-- DELETE FROM orders;
