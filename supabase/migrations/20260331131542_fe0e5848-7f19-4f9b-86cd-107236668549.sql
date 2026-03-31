
-- Allow clients to update their own orders (for cancelling unpaid orders)
CREATE POLICY "Clients can update own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (client_id = auth.uid() AND status = 'aguardando_pagamento')
WITH CHECK (client_id = auth.uid() AND status = 'cancelado');
