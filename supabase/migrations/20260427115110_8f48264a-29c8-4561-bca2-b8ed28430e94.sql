-- Criar função para updated_at se não existir
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de sessões de caixa
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE,
    opened_by UUID NOT NULL REFERENCES auth.users(id),
    closed_by UUID REFERENCES auth.users(id),
    opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(10,2),
    expected_balance NUMERIC(10,2),
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações de caixa
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    category TEXT NOT NULL CHECK (category IN ('sale', 'cash_in', 'cash_out', 'expense')),
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    payment_method TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lojistas podem ver seus próprios caixas') THEN
        CREATE POLICY "Lojistas podem ver seus próprios caixas" ON public.cash_registers FOR SELECT USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = cash_registers.store_id AND stores.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lojistas podem abrir caixas') THEN
        CREATE POLICY "Lojistas podem abrir caixas" ON public.cash_registers FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = cash_registers.store_id AND stores.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lojistas podem atualizar seus caixas') THEN
        CREATE POLICY "Lojistas podem atualizar seus caixas" ON public.cash_registers FOR UPDATE USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = cash_registers.store_id AND stores.owner_id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lojistas podem ver transações de seus caixas') THEN
        CREATE POLICY "Lojistas podem ver transações de seus caixas" ON public.cash_transactions FOR SELECT USING (EXISTS (SELECT 1 FROM public.cash_registers JOIN public.stores ON stores.id = cash_registers.store_id WHERE cash_registers.id = cash_transactions.cash_register_id AND stores.owner_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lojistas podem inserir transações') THEN
        CREATE POLICY "Lojistas podem inserir transações" ON public.cash_transactions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.cash_registers JOIN public.stores ON stores.id = cash_registers.store_id WHERE cash_registers.id = cash_transactions.cash_register_id AND stores.owner_id = auth.uid()));
    END IF;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS update_cash_registers_updated_at ON public.cash_registers;
CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
