-- Atualizar RLS de orders: motoboy da plataforma só vê pedidos de lojas em modo "platform"
DROP POLICY IF EXISTS "Drivers can see ready orders" ON public.orders;

CREATE POLICY "Drivers can see ready orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_driver(auth.uid()) AND (
    (
      status = 'pronto_para_entrega'::order_status
      AND driver_id IS NULL
      AND store_id IN (
        SELECT s.id
        FROM stores s
        WHERE COALESCE(s.address_city, 'itatinga'::text) = (
                SELECT COALESCE(d.city, 'itatinga'::text)
                FROM drivers d
                WHERE d.user_id = auth.uid()
              )
          AND COALESCE(s.delivery_mode, 'platform') = 'platform'
      )
    )
    OR driver_id = auth.uid()
  )
);