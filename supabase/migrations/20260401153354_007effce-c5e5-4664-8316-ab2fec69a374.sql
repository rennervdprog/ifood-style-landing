
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function that sends order data to sync-to-external edge function
CREATE OR REPLACE FUNCTION public.notify_order_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_order_sync: missing supabase URL or service key settings';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/sync-to-external',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'action', 'sync_order',
      'data', jsonb_build_object(
        'order', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'store_id', NEW.store_id,
          'status', NEW.status,
          'subtotal', NEW.subtotal,
          'delivery_fee', NEW.delivery_fee,
          'total_price', NEW.total_price,
          'app_fee', NEW.app_fee,
          'payment_method', NEW.payment_method,
          'neighborhood', NEW.neighborhood,
          'address_details', NEW.address_details,
          'delivery_pin', NEW.delivery_pin,
          'collection_code', NEW.collection_code,
          'settlement_code', NEW.settlement_code,
          'driver_id', NEW.driver_id,
          'needs_change', NEW.needs_change,
          'change_for', NEW.change_for,
          'collection_validated', NEW.collection_validated,
          'return_to_store_confirmed', NEW.return_to_store_confirmed,
          'visible_to_client', NEW.visible_to_client,
          'confirmed_at', NEW.confirmed_at,
          'created_at', NEW.created_at
        )
      )
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_order_sync error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT and UPDATE on orders
DROP TRIGGER IF EXISTS trg_sync_order_to_external ON public.orders;
CREATE TRIGGER trg_sync_order_to_external
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_sync();
