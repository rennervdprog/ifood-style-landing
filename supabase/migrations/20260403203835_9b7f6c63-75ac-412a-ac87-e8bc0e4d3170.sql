-- Drop the old simple overloads that cause PIX orders to be treated as cash
-- These old functions don't create earnings, don't update balances, and always set status to 'entregue'

-- Drop old driver_finish_delivery(uuid) - the simple version without PIN
DROP FUNCTION IF EXISTS public.driver_finish_delivery(uuid);

-- Drop old driver_confirm_store_return(uuid) - the simple version without settlement code
DROP FUNCTION IF EXISTS public.driver_confirm_store_return(uuid);