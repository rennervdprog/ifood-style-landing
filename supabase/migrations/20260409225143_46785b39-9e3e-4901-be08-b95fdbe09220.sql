
-- Re-add browsing policy for authenticated users (safe because client code uses stores_public view)
CREATE POLICY "Authenticated can browse active stores"
ON public.stores
FOR SELECT
TO authenticated
USING (status IN ('ativo'::store_status, 'bloqueado'::store_status));
