DROP FUNCTION IF EXISTS public.store_transition_order_status(uuid, order_status);
CREATE OR REPLACE FUNCTION public.store_transition_order_status(_order_id uuid, _target_status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order public.orders%ROWTYPE;
  _is_authorized boolean := false;
  _t text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  -- "confirmado" = compatibilidade com clientes antigos
  _t := CASE WHEN _target_status = 'confirmado' THEN 'preparando' ELSE _target_status END;
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _order.store_id AND s.owner_id = _uid)
    OR public.is_platform_admin(_uid) OR public.is_unit_manager(_uid, _order.store_id)
  INTO _is_authorized;
  IF NOT _is_authorized THEN RAISE EXCEPTION 'Você não tem permissão para atualizar este pedido.'; END IF;
  IF NOT (
    (_order.status = 'pendente' AND _t = 'preparando')
    OR (_order.status = 'preparando' AND _t = 'pronto_para_entrega')
    OR (_order.status = 'pronto_para_entrega' AND _t = 'finalizado' AND _order.neighborhood = 'RETIRADA')
  ) THEN RAISE EXCEPTION 'Transição de pedido não permitida.'; END IF;
  UPDATE public.orders SET status = _t::order_status WHERE id = _order.id;
END;
$function$;
REVOKE ALL ON FUNCTION public.store_transition_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_transition_order_status(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
-- Corrige valores inexistentes no enum order_status ('confirmado', 'pronto') que quebravam o aceite
CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_order_confirm()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  v_ok boolean;
  v_is_pdv boolean := false;
BEGIN
  v_is_pdv := (NEW.pdv_session_id IS NOT NULL)
           OR (NEW.order_source = 'pdv')
           OR (NEW.metadata->>'pdv_session_id' IS NOT NULL)
           OR (NEW.metadata->>'source' = 'pdv');

  IF NOT v_is_pdv
     AND NEW.status::text IN ('pendente', 'preparando')
     AND (OLD.status IS NULL OR OLD.status::text NOT IN ('pendente', 'preparando', 'pronto_para_entrega', 'saiu_entrega', 'em_transito', 'entregue', 'finalizado')) THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      SELECT public.stock_decrement_sale(item.product_id, item.quantity, NEW.id) INTO v_ok;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;
