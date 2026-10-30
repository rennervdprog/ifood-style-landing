-- RPC: lojas com cupons ativos (para seção "Lojas com Cupom" no app/web)
CREATE OR REPLACE FUNCTION public.get_stores_with_coupons(p_limit integer DEFAULT 20)
RETURNS TABLE (
  store_id uuid,
  store_name text,
  store_logo_url text,
  coupon_code text,
  discount_type text,
  discount_value numeric,
  coupon_description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (s.id)
    s.id AS store_id,
    s.name AS store_name,
    s.image_url AS store_logo_url,
    c.code AS coupon_code,
    c.discount_type,
    c.discount_value,
    c.description AS coupon_description
  FROM public.stores s
  INNER JOIN public.coupons c ON c.store_id = s.id
  WHERE c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
    AND s.status = 'ativo'
  ORDER BY s.id, c.discount_value DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_stores_with_coupons(integer) TO authenticated, anon;
