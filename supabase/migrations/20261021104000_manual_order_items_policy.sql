-- Pedido Delivery Manual do PDV nascia SEM ITENS (achado em teste ao vivo, 2026-10-21):
-- as policies de INSERT em order_items cobriam apenas o cliente dono do pedido
-- (orders.client_id = auth.uid()) e o dono da loja com order_source='pdv'.
-- Pedidos 'manual' (client_id NULL) não se encaixavam em nenhuma — o insert era
-- recusado em silêncio e o pedido ficava oco (9 pedidos reais atingidos em jun/jul).
-- Esta policy espelha a do PDV para order_source='manual'.
CREATE POLICY "Store owners can insert manual order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.id = order_items.order_id
      AND s.owner_id = (SELECT auth.uid())
      AND o.order_source = 'manual'
  ));
