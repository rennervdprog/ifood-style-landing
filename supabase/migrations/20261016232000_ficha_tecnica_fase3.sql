-- Ficha técnica Fase 3: alerta de ingredientes zerados/baixo após a venda
-- Retorna os ingredientes (dos produtos vendidos) que atingiram zero ou mínimo.

CREATE OR REPLACE FUNCTION public.get_recipe_stock_alerts(_product_ids uuid[])
RETURNS TABLE (
  ingredient_id uuid,
  ingredient_name text,
  quantity numeric,
  unit text,
  min_quantity numeric,
  is_zero boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.name,
    s.quantity,
    s.unit,
    s.min_quantity,
    (s.quantity <= 0) AS is_zero
  FROM public.product_recipes pr
  JOIN public.product_stock s ON s.product_id = pr.ingredient_product_id
  JOIN public.products p ON p.id = pr.ingredient_product_id
  WHERE pr.product_id = ANY(_product_ids)
    AND s.track_stock = true
    AND (s.quantity <= 0 OR s.quantity <= s.min_quantity);
END;
$function$;
