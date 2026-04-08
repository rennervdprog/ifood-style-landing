-- Allow anonymous/public users to read active stores
CREATE POLICY "Public can read active stores"
  ON public.stores
  FOR SELECT
  TO public
  USING (status = 'ativo');