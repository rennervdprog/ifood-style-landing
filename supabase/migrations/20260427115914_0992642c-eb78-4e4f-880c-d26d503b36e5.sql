-- Update cash_registers policies to include platform admins
DROP POLICY IF EXISTS "Lojistas podem ver seus próprios caixas" ON public.cash_registers;
CREATE POLICY "Lojistas e admins podem ver caixas" 
ON public.cash_registers FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM stores WHERE stores.id = cash_registers.store_id AND stores.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
);

DROP POLICY IF EXISTS "Lojistas podem abrir caixas" ON public.cash_registers;
CREATE POLICY "Lojistas e admins podem abrir caixas" 
ON public.cash_registers FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM stores WHERE stores.id = cash_registers.store_id AND stores.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
);

DROP POLICY IF EXISTS "Lojistas podem atualizar seus caixas" ON public.cash_registers;
CREATE POLICY "Lojistas e admins podem atualizar caixas" 
ON public.cash_registers FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM stores WHERE stores.id = cash_registers.store_id AND stores.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
);

-- Update cash_transactions policies to include platform admins
DROP POLICY IF EXISTS "Lojistas podem ver transações de seus caixas" ON public.cash_transactions;
CREATE POLICY "Lojistas e admins podem ver transações" 
ON public.cash_transactions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM cash_registers 
    JOIN stores ON stores.id = cash_registers.store_id 
    WHERE cash_registers.id = cash_transactions.cash_register_id AND (stores.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
  )
);

DROP POLICY IF EXISTS "Lojistas podem inserir transações" ON public.cash_transactions;
CREATE POLICY "Lojistas e admins podem inserir transações" 
ON public.cash_transactions FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cash_registers 
    JOIN stores ON stores.id = cash_registers.store_id 
    WHERE cash_registers.id = cash_transactions.cash_register_id AND (stores.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
  )
);
