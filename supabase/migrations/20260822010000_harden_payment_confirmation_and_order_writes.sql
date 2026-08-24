-- P0: elimina confirmação simulada de pagamento e escrita direta ampla em pedidos.
-- Mantém cada transição crítica no servidor, com autorização, lock de linha e
-- matriz explícita de estados permitidos.

BEGIN;

-- A função legada nunca deve ficar exposta via PostgREST/GraphQL. A liquidação
-- financeira permanece exclusivamente sob os fluxos canônicos de webhook/servidor.
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Remove políticas que davam UPDATE sem restrição de coluna ou de transição.
DROP POLICY IF EXISTS "Store owners can update store orders" ON public.orders;
DROP POLICY IF EXISTS "Store drivers can update linked store orders" ON public.orders;
DROP POLICY IF EXISTS "unit_manager_orders_update" ON public.orders;
DROP POLICY IF EXISTS "Clients can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can hide own completed orders" ON public.orders;

-- Verifica se o solicitante administra a loja do pedido sem confiar em dados
-- enviados pelo cliente.
CREATE OR REPLACE FUNCTION public.store_transition_order_status(
  _order_id uuid,
  _target_status public.order_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_authorized boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = _order.store_id
      AND s.owner_id = _uid
  )
  OR public.is_platform_admin(_uid)
  OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para atualizar este pedido.';
  END IF;

  -- A loja só pode avançar a produção. Pedido de entrega pronto é iniciado e
  -- concluído exclusivamente pelo entregador/cliente. Retirada pode finalizar
  -- quando já estiver pronta.
  IF NOT (
    (_order.status = 'pendente' AND _target_status = 'preparando')
    OR (_order.status = 'preparando' AND _target_status = 'pronto_para_entrega')
    OR (
      _order.status = 'pronto_para_entrega'
      AND _target_status = 'finalizado'
      AND _order.neighborhood = 'RETIRADA'
    )
  ) THEN
    RAISE EXCEPTION 'Transição de pedido não permitida.';
  END IF;

  UPDATE public.orders
  SET status = _target_status
  WHERE id = _order.id;
END;
$$;

-- Liga um cliente já existente a uma venda presencial/PDV; não concede acesso
-- a status, valores, motorista, pagamento ou demais campos do pedido.
CREATE OR REPLACE FUNCTION public.store_link_order_client(
  _order_id uuid,
  _client_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_authorized boolean := false;
BEGIN
  IF _uid IS NULL OR _client_id IS NULL THEN
    RAISE EXCEPTION 'Dados de sessão ou cliente inválidos.';
  END IF;

  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _order.store_id AND s.owner_id = _uid
  )
  OR public.is_platform_admin(_uid)
  OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para atualizar este pedido.';
  END IF;

  IF COALESCE(_order.order_source, '') NOT IN ('pdv', 'manual', 'balcao') THEN
    RAISE EXCEPTION 'Cliente só pode ser vinculado a pedidos presenciais.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _client_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  UPDATE public.orders
  SET client_id = _client_id
  WHERE id = _order.id;
END;
$$;

-- Atualiza apenas os dados de contato necessários ao pós-venda do PDV.
CREATE OR REPLACE FUNCTION public.store_set_order_customer_contact(
  _order_id uuid,
  _customer_name text DEFAULT NULL,
  _customer_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_authorized boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF NULLIF(btrim(COALESCE(_customer_name, '')), '') IS NULL
     AND NULLIF(btrim(COALESCE(_customer_phone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um dado de contato.';
  END IF;

  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _order.store_id AND s.owner_id = _uid
  )
  OR public.is_platform_admin(_uid)
  OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para atualizar este pedido.';
  END IF;

  IF COALESCE(_order.order_source, '') NOT IN ('pdv', 'manual', 'balcao') THEN
    RAISE EXCEPTION 'Dados de contato só podem ser alterados em pedidos presenciais.';
  END IF;

  UPDATE public.orders
  SET customer_name = NULLIF(btrim(_customer_name), ''),
      customer_phone = NULLIF(btrim(_customer_phone), '')
  WHERE id = _order.id;
END;
$$;

-- Claim e liberação atômicos da impressão de pedido, sem UPDATE direto.
CREATE OR REPLACE FUNCTION public.store_claim_order_print(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_authorized boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _order.store_id AND s.owner_id = _uid
  )
  OR public.is_platform_admin(_uid)
  OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para imprimir este pedido.';
  END IF;

  IF _order.printed_at IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET printed_at = now()
  WHERE id = _order.id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.store_clear_order_print_claim(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_authorized boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _order.store_id AND s.owner_id = _uid
  )
  OR public.is_platform_admin(_uid)
  OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para imprimir este pedido.';
  END IF;

  UPDATE public.orders
  SET printed_at = NULL
  WHERE id = _order.id;
END;
$$;

-- O cliente pode apenas ocultar/restaurar sua visualização de um pedido já
-- concluído. Nenhum outro campo do pedido fica gravável diretamente.
CREATE OR REPLACE FUNCTION public.client_set_order_visibility(
  _order_id uuid,
  _visible boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND OR _order.client_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.status NOT IN ('entregue', 'finalizado', 'cancelado') THEN
    RAISE EXCEPTION 'Somente pedidos concluídos podem ser ocultados.';
  END IF;

  UPDATE public.orders
  SET visible_to_client = _visible
  WHERE id = _order.id;
END;
$$;

-- Oculta ou restaura todos os pedidos concluídos do próprio cliente de uma vez,
-- preservando o comportamento de limpeza de histórico sem UPDATE aberto.
CREATE OR REPLACE FUNCTION public.client_set_completed_orders_visibility(_visible boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _updated_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  UPDATE public.orders
  SET visible_to_client = _visible
  WHERE client_id = _uid
    AND status IN ('entregue', 'finalizado', 'cancelado');

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count;
END;
$$;

-- Funções expostas intencionalmente: removem o grant público implícito e
-- concedem somente ao papel autenticado que passa pelas checagens acima.
REVOKE ALL ON FUNCTION public.store_transition_order_status(uuid, public.order_status)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.store_link_order_client(uuid, uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.store_set_order_customer_contact(uuid, text, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.store_claim_order_print(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.store_clear_order_print_claim(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.client_set_order_visibility(uuid, boolean)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.client_set_completed_orders_visibility(boolean)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.store_transition_order_status(uuid, public.order_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_link_order_client(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_set_order_customer_contact(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_claim_order_print(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_clear_order_print_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_set_order_visibility(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_set_completed_orders_visibility(boolean) TO authenticated;

COMMIT;
