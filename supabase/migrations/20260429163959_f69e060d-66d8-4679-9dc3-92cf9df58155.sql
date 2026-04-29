
SELECT cron.schedule(
  'auto-withdraw-asaas-daily',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/auto-withdraw-subaccounts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdHpycWp2cW9vamxyaHFueHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTU5MTksImV4cCI6MjA5MDQ3MTkxOX0.CGxwer8G6zfGkZ7tY6X5roUzm7yD-EM1YKZ_3moGB44"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
