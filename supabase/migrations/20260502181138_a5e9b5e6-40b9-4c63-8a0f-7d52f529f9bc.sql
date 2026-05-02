-- Adiciona a coluna commission_rate na tabela orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.orders.commission_rate IS 'Taxa de comissão (em porcentagem) aplicada a este pedido no momento da criação.';