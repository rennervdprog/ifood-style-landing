-- Adicionar colunas para rastrear status de ativação do Asaas
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS asaas_activation_status JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS asaas_documents_sent BOOLEAN DEFAULT FALSE;

-- Comentário para documentação
COMMENT ON COLUMN public.stores.asaas_activation_status IS 'Status detalhado da ativação da subconta no Asaas (KYC)';
COMMENT ON COLUMN public.stores.asaas_documents_sent IS 'Indica se o lojista já enviou os documentos básicos via sistema';