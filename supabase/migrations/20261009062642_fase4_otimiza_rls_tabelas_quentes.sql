-- Migration: Fase 4 — otimiza RLS nas tabelas quentes
-- Troca auth.uid() por (select auth.uid()) para avaliação única por query
-- (InitPlan) em vez de reavaliação por linha. Semântica idêntica.

-- orders.Drivers can see ready orders (SELECT): 3 substituições
DROP POLICY IF EXISTS "Drivers can see ready orders" ON public.orders;
CREATE POLICY "Drivers can see ready orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_driver((select auth.uid())) AND (
    (
      status = 'pronto_para_entrega'::order_status
      AND driver_id IS NULL
      AND store_id IN (
        SELECT s.id
        FROM stores s
        WHERE COALESCE(s.address_city, 'itatinga'::text) = (
                SELECT COALESCE(d.city, 'itatinga'::text)
                FROM drivers d
                WHERE d.user_id = (select auth.uid())
              )
          AND COALESCE(s.delivery_mode, 'platform') = 'platform'
      )
    )
    OR driver_id = (select auth.uid())
  )
);

-- orders.Store drivers can see linked store orders (SELECT): 4 substituições
DROP POLICY IF EXISTS "Store drivers can see linked store orders" ON public.orders;
CREATE POLICY "Store drivers can see linked store orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_drivers sd
    WHERE sd.driver_user_id = (select auth.uid())
      AND sd.store_id = orders.store_id
  )
  AND (
    -- Already accepted by me
    orders.driver_id = (select auth.uid())
    -- Or assigned specifically to me
    OR orders.assigned_driver_id = (select auth.uid())
    -- Or open to all (no assignment) and still unclaimed
    OR (orders.assigned_driver_id IS NULL AND orders.driver_id IS NULL)
    -- Or fully accepted state needs to remain visible to me
    OR orders.driver_id IS NOT NULL AND orders.driver_id = (select auth.uid())
  )
);

-- pdv_movements.Store owner manages own pdv movements (ALL): 4 substituições
DROP POLICY IF EXISTS "Store owner manages own pdv movements" ON public.pdv_movements;
CREATE POLICY "Store owner manages own pdv movements"
ON public.pdv_movements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_movements.store_id
      AND s.owner_id = (select auth.uid())
  )
  OR public.has_role((select auth.uid()), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_movements.store_id
      AND s.owner_id = (select auth.uid())
  )
  OR public.has_role((select auth.uid()), 'admin')
);

-- pdv_sessions.Store owner manages own pdv sessions (ALL): 4 substituições
DROP POLICY IF EXISTS "Store owner manages own pdv sessions" ON public.pdv_sessions;
CREATE POLICY "Store owner manages own pdv sessions"
ON public.pdv_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_sessions.store_id
      AND s.owner_id = (select auth.uid())
  )
  OR public.has_role((select auth.uid()), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_sessions.store_id
      AND s.owner_id = (select auth.uid())
  )
  OR public.has_role((select auth.uid()), 'admin')
);

-- driver_locations.Store owners can read driver location for their orders (SELECT): 1 substituições
DROP POLICY IF EXISTS "Store owners can read driver location for their orders" ON public.driver_locations;
CREATE POLICY "Store owners can read driver location for their orders"
ON public.driver_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON o.store_id = s.id
    WHERE o.id = driver_locations.order_id
      AND s.owner_id = (select auth.uid())
  )
);

-- driver_locations.Drivers can read own location (SELECT): 1 substituições
DROP POLICY IF EXISTS "Drivers can read own location" ON public.driver_locations;
CREATE POLICY "Drivers can read own location"
ON public.driver_locations FOR SELECT
TO authenticated
USING ((select auth.uid()) = driver_user_id);

-- order_items.Store drivers can read linked order items (SELECT): 1 substituições
DROP POLICY IF EXISTS "Store drivers can read linked order items" ON public.order_items;
CREATE POLICY "Store drivers can read linked order items"
ON public.order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.store_drivers sd ON sd.store_id = o.store_id
    WHERE o.id = order_items.order_id
      AND sd.driver_user_id = (select auth.uid())
  )
);

-- order_items.Store owners can read store order items (SELECT): 1 substituições
DROP POLICY IF EXISTS "Store owners can read store order items" ON public.order_items;
CREATE POLICY "Store owners can read store order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.stores s ON o.store_id = s.id
  WHERE o.id = order_items.order_id AND s.owner_id = (select auth.uid())
));

-- orders.Store owners can read store orders (SELECT): 1 substituições
DROP POLICY IF EXISTS "Store owners can read store orders" ON public.orders;
CREATE POLICY "Store owners can read store orders"
ON public.orders
FOR SELECT
TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = (select auth.uid())));
