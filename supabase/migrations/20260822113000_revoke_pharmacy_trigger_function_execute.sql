-- Funções de trigger não devem ser invocáveis pela API RPC.
-- O trigger continua executando internamente com SECURITY DEFINER.

REVOKE ALL ON FUNCTION public.block_restricted_pharmacy_order_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_restricted_pharmacy_order_item() FROM anon;
REVOKE ALL ON FUNCTION public.block_restricted_pharmacy_order_item() FROM authenticated;
REVOKE ALL ON FUNCTION public.block_restricted_pharmacy_order_item() FROM service_role;
