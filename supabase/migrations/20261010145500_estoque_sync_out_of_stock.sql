-- Fix: stock_adjust sincroniza flag out_of_stock com a vitrine
-- (antes só o stock_decrement_sale fazia isso)

CREATE OR REPLACE FUNCTION public.stock_adjust(_product_id uuid, _quantity numeric, _type text, _reason text DEFAULT NULL)
RETURNS public.product_stock LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_store_id uuid; v_row public.product_stock; v_new_qty numeric;
BEGIN
  IF _type NOT IN ('in','out','adjust','loss') THEN RAISE EXCEPTION 'Tipo inválido: %', _type; END IF;
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  SELECT store_id INTO v_store_id FROM public.products WHERE id = _product_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  INSERT INTO public.product_stock (product_id, store_id, quantity, track_stock)
  VALUES (_product_id, v_store_id, 0, true) ON CONFLICT (product_id) DO UPDATE SET track_stock = true RETURNING * INTO v_row;
  v_new_qty := CASE WHEN _type = 'in' THEN v_row.quantity + _quantity WHEN _type = 'adjust' THEN _quantity ELSE GREATEST(0, v_row.quantity - _quantity) END;
  UPDATE public.product_stock SET quantity = v_new_qty, updated_at = now(), track_stock = true WHERE product_id = _product_id RETURNING * INTO v_row;
  INSERT INTO public.product_stock_movements (product_id, store_id, type, quantity, balance_after, reason, created_by)
  VALUES (_product_id, v_store_id, _type, _quantity, v_new_qty, _reason, auth.uid());
  -- Sincroniza flag out_of_stock com a vitrine
  IF v_new_qty <= 0 THEN
    UPDATE public.products SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb WHERE id = _product_id;
  ELSE
    UPDATE public.products SET metadata = COALESCE(metadata, '{}'::jsonb) - 'out_of_stock' WHERE id = _product_id AND (metadata->>'out_of_stock') IS NOT NULL;
  END IF;
  RETURN v_row;
END; $function$;

-- Corrige produtos já zerados mas sem a flag
UPDATE public.products p
SET metadata = COALESCE(p.metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
FROM public.product_stock ps
WHERE ps.product_id = p.id AND ps.track_stock = true AND ps.quantity <= 0
  AND (p.metadata->>'out_of_stock') IS DISTINCT FROM 'true';
