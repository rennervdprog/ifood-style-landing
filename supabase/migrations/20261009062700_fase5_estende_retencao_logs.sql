-- Fase 5 — estende a retenção do cron de limpeza operacional.
-- Além de cron.job_run_details e net._http_response (já cobertos),
-- agora também limpa:
--   - asaas_webhook_events processados há mais de 60 dias (1 linha/webhook, cresce sem limite)
--   - geocode_cache expirado (expires_at < now(); TTL de 90 dias existe mas nada deletava)
-- Limpeza em lotes diários pequenos, sem impacto em pedidos/pagamentos/lojas.
-- Não toca em financial_transactions, order_messages nem page_views (decisão de negócio pendente).

DO $cleanup_schedule$
BEGIN
  PERFORM cron.unschedule('itasuper-prune-internal-operational-logs');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$cleanup_schedule$;

SELECT cron.schedule(
  'itasuper-prune-internal-operational-logs',
  '17 3 * * *',
  $cleanup_job$
    WITH cron_candidates AS (
      SELECT runid
        FROM cron.job_run_details
       WHERE start_time < now() - interval '14 days'
       ORDER BY start_time
       LIMIT 10000
    ),
    deleted_cron_logs AS (
      DELETE FROM cron.job_run_details logs
      USING cron_candidates candidates
      WHERE logs.runid = candidates.runid
      RETURNING logs.runid
    ),
    response_candidates AS (
      SELECT id
        FROM net._http_response
       WHERE created < now() - interval '7 days'
       ORDER BY created
       LIMIT 5000
    ),
    deleted_responses AS (
      DELETE FROM net._http_response responses
      USING response_candidates candidates
      WHERE responses.id = candidates.id
      RETURNING responses.id
    ),
    webhook_candidates AS (
      SELECT id
        FROM public.asaas_webhook_events
       WHERE processed_at < now() - interval '60 days'
       ORDER BY processed_at
       LIMIT 5000
    ),
    deleted_webhooks AS (
      DELETE FROM public.asaas_webhook_events events
      USING webhook_candidates candidates
      WHERE events.id = candidates.id
      RETURNING events.id
    ),
    geocode_candidates AS (
      SELECT id
        FROM public.geocode_cache
       WHERE expires_at < now()
       ORDER BY expires_at
       LIMIT 5000
    )
    DELETE FROM public.geocode_cache cache
    USING geocode_candidates candidates
    WHERE cache.id = candidates.id;
  $cleanup_job$
);
