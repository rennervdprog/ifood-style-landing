CREATE POLICY "Anyone can read active stores"
ON public.stores
FOR SELECT
TO public
USING (status IN ('ativo', 'bloqueado'));