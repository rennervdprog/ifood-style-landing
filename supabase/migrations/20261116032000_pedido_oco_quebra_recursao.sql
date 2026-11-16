-- Quebra da recursão da política de DELETE de pedido oco (achado da prova
-- ao vivo, 15/11/2026).
--
-- A política criada na migration 20261116031000 usava NOT EXISTS sobre
-- order_items dentro do USING. Avaliar esse USING exige ler order_items
-- sob RLS, e as políticas SELECT de order_items voltam a orders — o
-- Postgres detecta a recursão e devolve 42P17 ("infinite recursion
-- detected in policy for relation orders"), ou seja, o DELETE continuava
-- falhando (agora com erro 500 em vez de silêncio).
--
-- Correção no idioma já usado pelas políticas do projeto
-- (is_platform_admin, is_unit_manager, is_driver): a checagem de "vazio"
-- vira função SECURITY DEFINER, que lê order_items sem reentrar nas
-- políticas. A política passa a chamar o helper. A perna de posse
-- (stores) segue inline — ela já era provada não-recursiva pela política
-- de INSERT, que usa o mesmo subselect e funciona.
--
-- NOTA: a política antiga "Users can delete own empty orders" (cliente)
-- tem o mesmo NOT EXISTS recursivo e deve falhar do mesmo jeito. Não foi
-- tocada aqui (fora do escopo do pedido manual); fica registrada como
-- achado para decisão à parte.

CREATE OR REPLACE FUNCTION public.order_has_no_items(_order_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions', 'pg_temp'
  STABLE
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = _order_id
  );
$function$;

REVOKE ALL ON FUNCTION public.order_has_no_items(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_has_no_items(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.order_has_no_items(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.order_has_no_items(uuid) IS
  'True quando o pedido não tem itens. SECURITY DEFINER para a política de DELETE de pedido oco não reentrar nas políticas de order_items (42P17).';

DROP POLICY IF EXISTS "Store owners can delete own empty PDV or manual orders" ON public.orders;
CREATE POLICY "Store owners can delete own empty PDV or manual orders"
  ON public.orders FOR DELETE TO authenticated
  USING (
    client_id IS NULL
    AND order_source IN ('pdv', 'manual')
    AND store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
    AND public.order_has_no_items(orders.id)
  );

COMMENT ON POLICY "Store owners can delete own empty PDV or manual orders" ON public.orders IS
  'Permite ao dono apagar pedido oco criado pela loja (pdv/manual, sem cliente, sem itens): a limpeza do diálogo do pedido manual dependia disso e era negada em silêncio (client_id NULL). Checagem de vazio via helper SECURITY DEFINER para não recursar (42P17).';
