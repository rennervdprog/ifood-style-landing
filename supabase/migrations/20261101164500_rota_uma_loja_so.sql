-- Uma rota = uma loja só.
-- driver_accept_orders_batch aceitava um lote com pedidos de lojas
-- diferentes (o app mistura as ofertas de todas as lojas do motoboy e o
-- "aceitar todos" sem filtro mandava tudo de uma vez). A conferência era
-- pedido a pedido — e o motoboy vinculado a 2 lojas passava em todos.
-- Agora o lote inteiro é recusado se tiver mais de uma loja.
CREATE OR REPLACE FUNCTION public.driver_accept_orders_batch(_order_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order record;
  _requested_count integer;
  _locked_count integer := 0;
  _active_count integer;
  _stores_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida. Entre novamente para aceitar pedidos.';
  END IF;

  IF COALESCE(array_length(_order_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um pedido para a rota.';
  END IF;

  SELECT count(*) INTO _requested_count
  FROM (SELECT DISTINCT unnest(_order_ids) AS id) AS requested;

  IF _requested_count <> array_length(_order_ids, 1) THEN
    RAISE EXCEPTION 'A rota contém pedidos duplicados.';
  END IF;

  IF _requested_count > 10 THEN
    RAISE EXCEPTION 'Selecione no máximo 10 pedidos por rota.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text, 0));

  SELECT count(*) INTO _active_count
  FROM public.orders
  WHERE driver_id = _uid
    AND status IN ('pronto_para_entrega', 'saiu_entrega', 'em_transito');

  IF _active_count > 0 THEN
    RAISE EXCEPTION 'Finalize a rota atual antes de aceitar novos pedidos.';
  END IF;

  SELECT count(DISTINCT store_id) INTO _stores_count
  FROM public.orders
  WHERE id = ANY(_order_ids);

  IF _stores_count > 1 THEN
    RAISE EXCEPTION 'Uma rota é de uma loja só. Aceite os pedidos de uma loja por vez.';
  END IF;

  FOR _order IN
    SELECT id, store_id, status, driver_id, assigned_driver_id
    FROM public.orders
    WHERE id = ANY(_order_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    _locked_count := _locked_count + 1;

    IF _order.status <> 'pronto_para_entrega' THEN
      RAISE EXCEPTION 'O pedido % não está disponível para entrega.', _order.id;
    END IF;

    IF _order.driver_id IS NOT NULL THEN
      RAISE EXCEPTION 'O pedido % já foi aceito por outro motoboy.', _order.id;
    END IF;

    IF _order.assigned_driver_id IS NOT NULL AND _order.assigned_driver_id <> _uid THEN
      RAISE EXCEPTION 'O pedido % foi designado para outro motoboy.', _order.id;
    END IF;

    IF NOT public.is_driver(_uid) AND NOT public.is_store_driver(_uid, _order.store_id) THEN
      RAISE EXCEPTION 'Você não é um entregador autorizado para o pedido %.', _order.id;
    END IF;
  END LOOP;

  IF _locked_count <> _requested_count THEN
    RAISE EXCEPTION 'Um ou mais pedidos selecionados não foram encontrados.';
  END IF;

  UPDATE public.orders
  SET driver_id = _uid
  WHERE id = ANY(_order_ids)
    AND status = 'pronto_para_entrega'
    AND driver_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível reservar a rota. Atualize a lista e tente novamente.';
  END IF;
END;
$function$;
