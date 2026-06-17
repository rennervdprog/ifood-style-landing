
REVOKE EXECUTE ON FUNCTION public.decrement_pdv_commission_pending(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_pdv_commission_pending(uuid, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_store_balance_nonneg() FROM PUBLIC, anon, authenticated;
