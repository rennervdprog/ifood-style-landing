CREATE OR REPLACE FUNCTION public.is_store_blocked_by_balance(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(repasse_pendente, 0) + COALESCE(comissao_pendente, 0) >= 500
  FROM public.store_balances
  WHERE store_id = _store_id
$$;