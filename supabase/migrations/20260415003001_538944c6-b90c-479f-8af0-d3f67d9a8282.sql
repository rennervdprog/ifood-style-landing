-- Allow anyone (including anonymous visitors) to read active stores via stores_public view
CREATE POLICY "Anyone can read active stores"
ON public.stores
FOR SELECT
TO public
USING (status = 'ativo');