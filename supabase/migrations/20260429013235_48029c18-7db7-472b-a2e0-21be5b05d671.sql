-- Corrigindo handle_order_cash_transaction
ALTER FUNCTION public.handle_order_cash_transaction() SET search_path = public;

-- Corrigindo get_order_client_name
ALTER FUNCTION public.get_order_client_name(uuid) SET search_path = public;

-- Corrigindo handle_order_payment_metadata
ALTER FUNCTION public.handle_order_payment_metadata() SET search_path = public;

-- Corrigindo is_platform_admin
ALTER FUNCTION public.is_platform_admin(uuid) SET search_path = public;