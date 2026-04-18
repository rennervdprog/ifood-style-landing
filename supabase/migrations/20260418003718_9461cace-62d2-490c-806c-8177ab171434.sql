
-- Function: notify all platform admins via push when a new lojista/motoboy registers
CREATE OR REPLACE FUNCTION public.notify_admins_new_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_ids uuid[];
  v_role text;
  v_label text;
  v_url text;
  v_service_key text;
BEGIN
  -- Only fire for pending lojista/motoboy
  IF NEW.is_approved IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;
  IF NEW.role::text NOT IN ('lojista', 'motoboy') THEN
    RETURN NEW;
  END IF;

  v_role := NEW.role::text;
  v_label := CASE WHEN v_role = 'lojista' THEN 'lojista' ELSE 'entregador' END;

  -- Collect admin user_ids
  SELECT array_agg(user_id) INTO v_admin_ids
  FROM public.user_roles
  WHERE role = 'admin';

  IF v_admin_ids IS NULL OR array_length(v_admin_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get supabase URL and service role key from vault (fallback to settings)
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  v_url := 'https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/send-push';

  IF v_service_key IS NULL THEN
    -- Cannot call without service key; skip silently (toast still works via realtime)
    RETURN NEW;
  END IF;

  -- Fire async HTTP request via pg_net
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(v_admin_ids),
      'title', '🔔 Novo ' || v_label || ' aguardando aprovação',
      'body', COALESCE(NEW.full_name, 'Novo cadastro') || ' acabou de se cadastrar.',
      'data', jsonb_build_object('link', '/admin', 'tab', 'approvals')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_approval ON public.profiles;
CREATE TRIGGER trg_notify_admins_new_approval
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_approval();

-- Schedule weekly platform report every Monday at 09:00 UTC (06:00 BRT)
DO $$
DECLARE
  v_service_key text;
  v_existing int;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL THEN
    RAISE NOTICE 'service_role_key vault secret missing; weekly-platform-report cron not scheduled';
    RETURN;
  END IF;

  -- Remove previous schedule if exists
  SELECT count(*) INTO v_existing FROM cron.job WHERE jobname = 'weekly-platform-report';
  IF v_existing > 0 THEN
    PERFORM cron.unschedule('weekly-platform-report');
  END IF;

  PERFORM cron.schedule(
    'weekly-platform-report',
    '0 9 * * 1',
    format($cron$
      SELECT net.http_post(
        url := 'https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/weekly-platform-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $cron$, v_service_key)
  );
END $$;
