-- Ficha técnica Fase 2: baixa automática de ingredientes na venda
-- Quando um produto tem ficha técnica (product_recipes), a venda desconta
-- os ingredientes proporcionalmente em vez do próprio produto.

-- 1. Unidade no estoque (para conversão g<->kg, ml<->L)
ALTER TABLE public.product_stock
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'un';

-- 2. Conversor de unidades
CREATE OR REPLACE FUNCTION public.convert_stock_unit(_qty numeric, _from text, _to text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF _from IS NULL OR _to IS NULL OR _from = _to THEN RETURN _qty; END IF;
  -- peso
  IF _from = 'g' AND _to = 'kg' THEN RETURN _qty / 1000; END IF;
  IF _from = 'kg' AND _to = 'g' THEN RETURN _qty * 1000; END IF;
  -- volume
  IF _from = 'ml' AND _to = 'L' THEN RETURN _qty / 1000; END IF;
  IF _from = 'L' AND _to = 'ml' THEN RETURN _qty * 1000; END IF;
  -- unidades incompatíveis: não converte (não quebra a venda)
  RETURN _qty;
END;
$function$;

-- 3. stock_decrement_sale com suporte a ficha técnica
CREATE OR REPLACE FUNCTION public.stock_decrement_sale(
  _product_id uuid,
  _quantity numeric,
  _order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.product_stock;
  v_new_qty numeric;
  v_has_recipe boolean;
  v_recipe record;
  v_ing public.product_stock;
  v_decrement numeric;
  v_ing_new_qty numeric;
BEGIN
  -- Ficha técnica tem precedência: baixa os ingredientes, não o produto
  SELECT EXISTS (
    SELECT 1 FROM public.product_recipes WHERE product_id = _product_id
  ) INTO v_has_recipe;

  IF v_has_recipe THEN
    FOR v_recipe IN
      SELECT ingredient_product_id, quantity, unit
      FROM public.product_recipes
      WHERE product_id = _product_id
    LOOP
      SELECT * INTO v_ing FROM public.product_stock
        WHERE product_id = v_recipe.ingredient_product_id;
      -- Ingrediente sem controle de estoque: pula, não bloqueia a venda
      IF v_ing IS NULL OR NOT v_ing.track_stock THEN CONTINUE; END IF;

      v_decrement := public.convert_stock_unit(
        v_recipe.quantity * _quantity, v_recipe.unit, v_ing.unit);
      -- Nunca negativo (respeita o CHECK) e nunca bloqueia a venda
      v_ing_new_qty := GREATEST(0, v_ing.quantity - v_decrement);

      UPDATE public.product_stock
         SET quantity = v_ing_new_qty, updated_at = now()
       WHERE product_id = v_recipe.ingredient_product_id;

      INSERT INTO public.product_stock_movements
        (product_id, store_id, type, quantity, balance_after, order_id, created_by)
      VALUES
        (v_recipe.ingredient_product_id, v_ing.store_id, 'sale',
         v_decrement, v_ing_new_qty, _order_id, auth.uid());

      -- Marca ingrediente como esgotado quando zera
      IF v_ing_new_qty <= 0 THEN
        UPDATE public.products
           SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
         WHERE id = v_recipe.ingredient_product_id;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- Sem ficha técnica: comportamento original (baixa o próprio produto)
  SELECT * INTO v_row FROM public.product_stock WHERE product_id = _product_id;
  -- Produto sem controle de estoque: permite a venda
  IF v_row IS NULL OR NOT v_row.track_stock THEN RETURN true; END IF;

  IF v_row.quantity < _quantity THEN RETURN false; END IF;

  v_new_qty := v_row.quantity - _quantity;
  UPDATE public.product_stock
     SET quantity = v_ing_new_qty, updated_at = now()
   WHERE product_id = _product_id;

  INSERT INTO public.product_stock_movements
    (product_id, store_id, type, quantity, balance_after, order_id, created_by)
  VALUES
    (_product_id, v_row.store_id, 'sale', _quantity, v_new_qty, _order_id, auth.uid());

  -- Marca esgotado no metadata quando zera
  IF v_new_qty <= 0 THEN
    UPDATE public.products
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
     WHERE id = _product_id;
  END IF;

  RETURN true;
END;
$function$;
