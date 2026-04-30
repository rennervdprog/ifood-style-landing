-- Revoke execute from authenticated and anon for internal trigger and system functions
-- These functions are either triggers or meant to be called by background processes/edge functions using service_role.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_zapi() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.auto_finalize_stale_orders() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.accrue_moderator_plan_fee(uuid, numeric) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.accrue_moderator_earnings() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.accrue_fixed_plan_split() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_cash_transaction() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.create_store_driver_earning() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_order_sync() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_record_sync() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_driver_protected_fields_update() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_change() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_payment_metadata() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.insert_order_status_chat_message() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.award_loyalty_points() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.check_supporter_plan_limit() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.verify_order_subtotal() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.validate_order_prices() FROM authenticated, anon;
