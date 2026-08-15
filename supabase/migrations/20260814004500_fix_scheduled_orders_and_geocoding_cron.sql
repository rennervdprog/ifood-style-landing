-- Corrige pedidos agendados: a tabela orders não possui updated_at.
CREATE OR REPLACE FUNCTION public.release_scheduled_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer := 0;
BEGIN
  WITH moved AS (
    UPDATE public.orders
       SET status = 'pendente'
     WHERE status = 'scheduled'
       AND release_at IS NOT NULL
       AND release_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO released_count FROM moved;

  RETURN released_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_scheduled_orders() TO service_role;

-- Remove os agendamentos antigos: um não é necessário e o outro expõe
-- credenciais estáticas ao chamar uma função que não estava implantada.
DO $$
BEGIN
  PERFORM cron.unschedule(87);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule(88);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('backfill-coords-every-5-minutes');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Agenda lotes pequenos. A chave de serviço é lida no momento da execução
-- pelo Vault, sem ficar gravada na definição do cron.
SELECT cron.schedule(
  'backfill-coords-every-5-minutes',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_url'
      ) || '/functions/v1/backfill-coords?limit=20&target=both',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
