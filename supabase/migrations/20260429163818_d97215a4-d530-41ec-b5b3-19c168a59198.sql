
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS asaas_auto_withdraw_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS asaas_pix_key text,
  ADD COLUMN IF NOT EXISTS asaas_pix_key_type text,
  ADD COLUMN IF NOT EXISTS asaas_min_withdraw_amount numeric(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS asaas_last_withdraw_at timestamp with time zone;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
