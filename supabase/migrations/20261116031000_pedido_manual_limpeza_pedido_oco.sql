-- Limpeza de pedido oco do pedido manual/PDV (achado da prova da trava de
-- estoque, 15/11/2026).
--
-- O diálogo do pedido manual (PdvDeliveryManualDialog.tsx) e o fallback do
-- PDV (usePdvCheckout.ts) desfazem o pedido quando o insert dos itens falha
-- ("nunca deixar um pedido oco na cozinha"). Mas o DELETE nunca funcionou
-- para esses pedidos: a única política DELETE de orders
-- ("Users can delete own empty orders") exige client_id = auth.uid(), e
-- pedidos PDV/manual nascem com client_id NULL — o DELETE é negado em
-- silêncio e o pedido oco fica como "preparando" na tela de Pedidos.
--
-- A trava de estoque (migration 20261116030000) tornou o caminho de falha
-- corriqueiro (todo bloqueio deixava um pedido oco), expondo o problema.
-- Esta política permite ao DONO DA LOJA apagar pedidos vazios criados pela
-- própria loja (pdv/manual, sem cliente, sem itens) — espelhando a
-- expressão de posse da política de INSERT "Store owners can create PDV or
-- manual orders" e a condição "vazio" da política de DELETE existente.
-- Pedido com itens, pedido de cliente e pedido de outra loja seguem
-- inalterados: nenhum deles passa neste USING.

DROP POLICY IF EXISTS "Store owners can delete own empty PDV or manual orders" ON public.orders;
CREATE POLICY "Store owners can delete own empty PDV or manual orders"
  ON public.orders FOR DELETE TO authenticated
  USING (
    client_id IS NULL
    AND order_source IN ('pdv', 'manual')
    AND store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_items.order_id = orders.id)
  );

COMMENT ON POLICY "Store owners can delete own empty PDV or manual orders" ON public.orders IS
  'Permite ao dono apagar pedido oco criado pela loja (pdv/manual, sem cliente, sem itens): a limpeza do diálogo do pedido manual dependia disso e era negada em silêncio (client_id NULL).';
