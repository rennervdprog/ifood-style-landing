ALTER TABLE public.orders ADD COLUMN visible_to_client boolean NOT NULL DEFAULT true;

-- Allow clients to update visible_to_client on their own completed/cancelled orders
CREATE POLICY "Clients can hide own completed orders"
ON public.orders FOR UPDATE
TO authenticated
USING (client_id = auth.uid() AND status IN ('entregue', 'finalizado', 'cancelado'))
WITH CHECK (client_id = auth.uid() AND status IN ('entregue', 'finalizado', 'cancelado'));