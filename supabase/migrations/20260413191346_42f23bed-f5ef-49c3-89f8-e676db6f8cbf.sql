
-- Fix the current driver location to point to the active order
UPDATE driver_locations 
SET order_id = '3dc19319-94b3-41d6-8132-4f65a70d6b53', updated_at = now() 
WHERE driver_user_id = '901e44d6-fc0e-487b-af03-f6460a2d60fa';

-- Add a broader RLS policy: clients can read driver location when driver is assigned to their active order
DROP POLICY IF EXISTS "Clients can read driver location for their orders" ON driver_locations;

CREATE POLICY "Clients can read driver location for their orders"
ON driver_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.driver_id = driver_locations.driver_user_id
      AND o.client_id = auth.uid()
      AND o.status IN ('em_transito', 'saiu_entrega')
  )
);
