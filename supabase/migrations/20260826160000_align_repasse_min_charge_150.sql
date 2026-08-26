-- Alinha a configuração administrativa ao mínimo canônico de cobrança semanal.
-- A função auto-charge-physical-fees usa REPASSE_POLICY.MIN_AUTO_CHARGE_BRL = 150.
-- Não cria cobrança nem altera saldos; apenas evita que o painel mantenha o fallback antigo de R$ 5.

UPDATE public.admin_settings
SET value = '150'::jsonb,
    updated_at = now()
WHERE key = 'min_charge_amount';
