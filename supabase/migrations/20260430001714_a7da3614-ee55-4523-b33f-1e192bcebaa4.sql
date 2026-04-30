
-- 1) Revoke EXECUTE from public/anon/authenticated on ALL SECURITY DEFINER functions in public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;

-- 2) Re-grant EXECUTE to authenticated for whitelisted RPCs called from the client
GRANT EXECUTE ON FUNCTION public.admin_approve_partner(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_duplicate_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_test_store(text, store_category) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_cancellation_policy(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_plan_change(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prorata_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_device_active(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_confirm_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_accept_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_confirm_earning_received(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_confirm_store_return(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_finish_delivery(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_validate_collection(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_contacts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_view_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_as_lojista(text, text, text, store_category, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_as_motoboy(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_as_motoboy(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_login(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_plan_change(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_motoboy_profiles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_assign_order_driver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_mark_all_driver_earnings_paid(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_mark_driver_earning_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_coupon(uuid, uuid, uuid) TO authenticated;

-- 3) Public-facing RPCs (no auth required)
GRANT EXECUTE ON FUNCTION public.record_page_view(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_supporter_plans() TO anon, authenticated;

-- 4) Default privileges for any future SECURITY DEFINER function in public:
-- New functions will not be executable by anon/authenticated unless explicitly granted.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
