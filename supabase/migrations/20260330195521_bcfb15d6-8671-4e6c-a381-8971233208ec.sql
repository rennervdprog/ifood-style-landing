
-- Add driver_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drivers can see orders ready for delivery or their own accepted orders
CREATE POLICY "Drivers can see ready orders"
ON public.orders
FOR SELECT
TO authenticated
USING (status = 'pronto_para_entrega' OR driver_id = auth.uid());

-- Drivers can accept orders with no driver, or finish their own
CREATE POLICY "Drivers can accept or finish orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (status = 'pronto_para_entrega' AND driver_id IS NULL)
  OR (driver_id = auth.uid() AND status = 'em_transito')
)
WITH CHECK (
  driver_id = auth.uid()
);
