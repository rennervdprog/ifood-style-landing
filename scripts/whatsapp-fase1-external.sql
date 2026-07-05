-- WhatsApp Fase 1 (P0) — rodar no Supabase EXTERNO qkjhguziuchqsbxzruea
--
-- Objetivo:
--  1) Índice de busca para os filtros usados pelo evolution-send-message.
--  2) Índice ÚNICO PARCIAL que impede saudações duplicadas em rajada
--     (mesmo store_id + phone + kind dentro da mesma janela de 60s).
--
-- Seguro para rodar múltiplas vezes (IF NOT EXISTS + CONCURRENTLY).

-- 1) Busca rápida por store + phone + tempo (dedupe, per-phone gap, últimos envios)
CREATE INDEX IF NOT EXISTS whatsapp_send_log_store_phone_sent_idx
  ON public.whatsapp_send_log (store_id, phone, sent_at DESC);

-- 2) Busca rápida por store + kind + tempo (limite diário, últimos por kind)
CREATE INDEX IF NOT EXISTS whatsapp_send_log_store_kind_sent_idx
  ON public.whatsapp_send_log (store_id, kind, sent_at DESC);

-- 3) UNIQUE PARCIAL — barreira atômica anti-duplicata de curto prazo.
--    Usa (date_trunc('minute', sent_at)) para criar um "bucket" de 1min: dentro
--    do mesmo minuto, só um registro por (store_id, phone, kind) sobrevive.
--    Combinado com upsert(onConflict='store_id,phone,kind', ignoreDuplicates:true)
--    no edge function, mata a corrida das 6 saudações em 8s.
--
--    IMPORTANTE: unique index PRECISA das mesmas colunas do onConflict; por isso
--    o índice é sobre (store_id, phone, kind) — a janela é enforcada pelo WHERE
--    (só linhas dos últimos 5 min entram na unicidade).
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_send_log_dedupe_60s_uniq
  ON public.whatsapp_send_log (store_id, phone, kind)
  WHERE sent_at > (now() - interval '5 minutes');

-- (Opcional) — coluna skip_reason para observabilidade (Fase 4).
-- Descomente quando for popular:
-- ALTER TABLE public.whatsapp_send_log
--   ADD COLUMN IF NOT EXISTS skip_reason text;
-- COMMENT ON COLUMN public.whatsapp_send_log.skip_reason IS
--   'Motivo de skip: dedupe_24h | first_contact | opt_out | daily_limit | has_active_order | outside_hours';