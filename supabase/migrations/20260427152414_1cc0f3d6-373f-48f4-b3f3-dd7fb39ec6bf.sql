-- Adiciona as colunas necessárias na tabela stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS delivery_fee_type TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS delivery_base_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_base NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_per_km NUMERIC DEFAULT 0;

-- Garante que o RLS está habilitado
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Cria ou atualiza as políticas de RLS usando 'owner_id'
DO $$ 
BEGIN
    -- Remove política antiga se existir com nome diferente ou para evitar conflitos
    DROP POLICY IF EXISTS "Lojistas podem atualizar suas próprias lojas" ON public.stores;
    
    CREATE POLICY "Lojistas podem atualizar suas próprias lojas" 
    ON public.stores 
    FOR UPDATE 
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stores' AND policyname = 'Qualquer pessoa pode visualizar lojas'
    ) THEN
        CREATE POLICY "Qualquer pessoa pode visualizar lojas" 
        ON public.stores 
        FOR SELECT 
        USING (true);
    END IF;
END $$;

-- Recarrega o cache do PostgREST para reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload schema';