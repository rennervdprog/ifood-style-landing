-- Limite diário de envios de WhatsApp configurável pelo lojista (2026-10-24)
--
-- O teto diário da Evolution é uma escada por idade do número
-- (60/120/200/300/300 — ver dailyLimitForAge em
-- supabase/functions/evolution-send-message/index.ts). O lojista pode
-- AUMENTAR o teto pela tela de Configurações de WhatsApp; o valor fica
-- aqui e a function usa o maior entre o teto da idade e o override,
-- travado em 500. NULL (padrão) = vale só o teto da idade.
--
-- Idempotente (IF NOT EXISTS / guarda por nome da constraint): pode rodar
-- em banco novo ou no banco atual sem alterar dados.

ALTER TABLE public.store_whatsapp_config
  ADD COLUMN IF NOT EXISTS daily_limit_override integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_whatsapp_config_daily_limit_override_check'
  ) THEN
    ALTER TABLE public.store_whatsapp_config
      ADD CONSTRAINT store_whatsapp_config_daily_limit_override_check
      CHECK (daily_limit_override IS NULL OR (daily_limit_override > 0 AND daily_limit_override <= 500));
  END IF;
END $$;
