-- WhatsApp Fase 1 (P0) — rodar no Supabase EXTERNO qkjhguziuchqsbxzruea
-- Índices de busca + bucket determinístico por minuto para anti-rajada.

CREATE INDEX IF NOT EXISTS whatsapp_send_log_store_phone_sent_idx
  ON public.whatsapp_send_log (store_id, phone, sent_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_send_log_store_kind_sent_idx
  ON public.whatsapp_send_log (store_id, kind, sent_at DESC);

-- Bucket por minuto (Postgres não aceita now() em WHERE de índice parcial).
-- Dentro do mesmo minuto, só sobrevive 1 registro por (store_id, phone, kind).
ALTER TABLE public.whatsapp_send_log
  ADD COLUMN IF NOT EXISTS sent_bucket_min timestamptz
  GENERATED ALWAYS AS (date_trunc('minute', sent_at)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_send_log_dedupe_bucket_uniq
  ON public.whatsapp_send_log (store_id, phone, kind, sent_bucket_min);
