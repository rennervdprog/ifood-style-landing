-- Fix trigger: verifica colunas order_source/pdv_session_id (não apenas metadata)
-- Bug: PDV usa colunas diretas, trigger verificava metadata -> baixa duplicada

CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_order_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  item record;
  v_ok boolean;
  v_is_pdv boolean := false;
BEGIN
  -- Detecta PDV: colunas diretas OU metadata (compatibilidade)
  v_is_pdv := (NEW.pdv_session_id IS NOT NULL)
           OR (NEW.order_source = 'pdv')
           OR (NEW.metadata->>'pdv_session_id' IS NOT NULL)
           OR (NEW.metadata->>'source' = 'pdv');

  IF NOT v_is_pdv
     AND NEW.status IN ('pendente', 'confirmado', 'preparando')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pendente', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'em_transito', 'entregue', 'finalizado')) THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      SELECT public.stock_decrement_sale(item.product_id, item.quantity, NEW.id) INTO v_ok;
    END LOOP;
  END IF;
  RETURN NEW;
END; $fn$;
