-- Trigger: baixa estoque quando pedido delivery é confirmado
-- (PDV já trata no frontend, evita baixa duplicada)

CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_order_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  item record;
  v_ok boolean;
  v_is_pdv boolean := false;
BEGIN
  BEGIN
    v_is_pdv := (NEW.metadata->>'pdv_session_id' IS NOT NULL)
             OR (NEW.metadata->>'source' = 'pdv');
  EXCEPTION WHEN undefined_column THEN
    v_is_pdv := false;
  END;

  IF NOT v_is_pdv
     AND NEW.status IN ('pendente', 'confirmado', 'preparando')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pendente', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'em_transito', 'entregue', 'finalizado')) THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      SELECT public.stock_decrement_sale(item.product_id, item.quantity, NEW.id) INTO v_ok;
    END LOOP;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_order_confirm_decrement_stock ON public.orders;
CREATE TRIGGER trg_order_confirm_decrement_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_decrement_stock_on_order_confirm();
