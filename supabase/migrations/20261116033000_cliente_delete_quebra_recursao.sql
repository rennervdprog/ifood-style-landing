-- Quebra da recursão da política de DELETE do cliente (mesma causa da
-- migration anterior, 15/11/2026).
--
-- A prova ao vivo como lojista demo (PostgREST) continuou devolvendo
-- 42P17 mesmo depois da migration 20261116032000: o Postgres expande
-- TODAS as políticas DELETE permissivas aplicáveis, e a política antiga
-- do cliente ("Users can delete own empty orders") tem o mesmo NOT EXISTS
-- sobre order_items que recursa (order_items SELECT volta a orders).
-- Ou seja: nenhum DELETE de orders por usuário autenticado funcionava —
-- nem o do cliente, nem a limpeza do diálogo do pedido manual.
--
-- A política é reescrita com o MESMO sentido (dono do pedido + sem
-- itens), só trocando o NOT EXISTS pelo helper SECURITY DEFINER
-- order_has_no_items, no idioma já usado pelo projeto. Nenhuma outra
-- política de orders foi tocada.

DROP POLICY IF EXISTS "Users can delete own empty orders" ON public.orders;
CREATE POLICY "Users can delete own empty orders"
  ON public.orders FOR DELETE TO authenticated
  USING (
    client_id = auth.uid()
    AND public.order_has_no_items(orders.id)
  );

COMMENT ON POLICY "Users can delete own empty orders" ON public.orders IS
  'Cliente apaga o próprio pedido vazio. Checagem de vazio via helper SECURITY DEFINER para não recursar (42P17) — o NOT EXISTS inline quebrava todo DELETE de orders.';
