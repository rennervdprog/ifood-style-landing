-- Adicionar colunas de entrega na tabela stores se não existirem
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS delivery_fee_type TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS delivery_base_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_base NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_per_km NUMERIC DEFAULT 0;

-- Forçar atualização do cache do esquema (importante para evitar erro de coluna não encontrada)
NOTIFY pgrst, 'reload schema';