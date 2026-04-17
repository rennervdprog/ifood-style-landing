-- Function: when order status changes, fire Z-API message via edge function (server-side, no client involvement)
CREATE OR REPLACE FUNCTION public.notify_order_status_zapi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _zapi_enabled boolean;
  _client_phone text;
  _store_name text;
  _short_id text;
  _msg text;
  _to_phone text;
BEGIN
  -- Only fire on actual status change
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only for statuses we want to notify the client about
  IF NEW.status NOT IN ('preparando','pronto_para_entrega','saiu_entrega','em_transito','entregue','finalizado','cancelado') THEN
    RETURN NEW;
  END IF;

  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);
  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_order_status_zapi: missing settings';
    RETURN NEW;
  END IF;

  -- Check Z-API enabled for this store
  SELECT zapi_enabled INTO _zapi_enabled
  FROM public.store_secrets
  WHERE store_id = NEW.store_id;

  IF NOT COALESCE(_zapi_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Get client whatsapp/phone
  SELECT COALESCE(p.whatsapp_number, p.phone) INTO _client_phone
  FROM public.profiles p
  WHERE p.user_id = NEW.client_id;

  IF _client_phone IS NULL OR length(regexp_replace(_client_phone, '\D', '', 'g')) < 10 THEN
    RETURN NEW;
  END IF;

  -- Store name + short id for the message
  SELECT name INTO _store_name FROM public.stores WHERE id = NEW.store_id;
  _short_id := upper(substr(NEW.id::text, 1, 8));

  _msg := CASE NEW.status
    WHEN 'preparando' THEN '✅ ' || COALESCE(_store_name, 'Loja') || ': seu pedido #' || _short_id || ' foi aceito e está sendo preparado! 👨‍🍳'
    WHEN 'pronto_para_entrega' THEN '📦 ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' pronto! Aguardando entregador.'
    WHEN 'saiu_entrega' THEN '🛵 ' || COALESCE(_store_name, 'Loja') || ': seu pedido #' || _short_id || ' saiu para entrega!'
    WHEN 'em_transito' THEN '🛵 ' || COALESCE(_store_name, 'Loja') || ': entregador a caminho com o pedido #' || _short_id || '!'
    WHEN 'entregue' THEN '✅ ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' entregue! Bom apetite! 🍽️'
    WHEN 'finalizado' THEN '🏁 ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' finalizado. Obrigado pela preferência!'
    WHEN 'cancelado' THEN '❌ ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' foi cancelado.'
    ELSE NULL
  END;

  IF _msg IS NULL THEN RETURN NEW; END IF;

  _to_phone := regexp_replace(_client_phone, '\D', '', 'g');

  -- Fire-and-forget call to send-zapi internal endpoint via edge function
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/zapi-send-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'store_id', NEW.store_id,
      'phone', _to_phone,
      'message', _msg
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_order_status_zapi error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger on orders table
DROP TRIGGER IF EXISTS trg_notify_order_status_zapi ON public.orders;
CREATE TRIGGER trg_notify_order_status_zapi
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_zapi();