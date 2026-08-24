-- Reduz a pressão contínua de Disk I/O de logs internos do pg_cron e pg_net.
-- Não altera pedidos, pagamentos, lojas, entregadores ou a janela canônica de 13 minutos.
-- A limpeza é propositalmente limitada a lotes diários para evitar uma operação pesada
-- em uma instância cujo orçamento de Disk I/O já apresentou alerta.

DO $cleanup_schedule$
BEGIN
  PERFORM cron.unschedule('itasuper-prune-internal-operational-logs');
EXCEPTION
  WHEN OTHERS THEN
  -- A agenda pode não existir ainda. A nova agenda abaixo é a fonte de verdade.
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
    )
    DELETE FROM net._http_response responses
    USING response_candidates candidates
    WHERE responses.id = candidates.id;
  $cleanup_job$
);
