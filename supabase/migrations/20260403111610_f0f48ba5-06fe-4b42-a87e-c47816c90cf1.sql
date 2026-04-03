
-- Generic sync trigger function for any table
CREATE OR REPLACE FUNCTION public.notify_record_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text;
  _service_key text;
  _table_name text;
  _record jsonb;
BEGIN
  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_record_sync: missing supabase URL or service key';
    RETURN COALESCE(NEW, OLD);
  END IF;

  _table_name := TG_TABLE_NAME;
  _record := to_jsonb(COALESCE(NEW, OLD));

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/sync-to-external',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'action', 'sync_record',
      'data', jsonb_build_object(
        'table', _table_name,
        'record', _record
      )
    )::jsonb
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_record_sync (%) error: %', _table_name, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Trigger on order_messages
CREATE TRIGGER sync_order_messages_to_external
AFTER INSERT OR UPDATE ON public.order_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();

-- Trigger on financial_transactions
CREATE TRIGGER sync_financial_transactions_to_external
AFTER INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();

-- Trigger on store_balances
CREATE TRIGGER sync_store_balances_to_external
AFTER INSERT OR UPDATE ON public.store_balances
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();

-- Trigger on drivers
CREATE TRIGGER sync_drivers_to_external
AFTER INSERT OR UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();

-- Trigger on driver_balances
CREATE TRIGGER sync_driver_balances_to_external
AFTER INSERT OR UPDATE ON public.driver_balances
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();

-- Trigger on driver_earnings
CREATE TRIGGER sync_driver_earnings_to_external
AFTER INSERT OR UPDATE ON public.driver_earnings
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();

-- Trigger on order_items
CREATE TRIGGER sync_order_items_to_external
AFTER INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();
