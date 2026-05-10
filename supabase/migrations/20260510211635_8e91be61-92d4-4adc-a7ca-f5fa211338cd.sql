-- Coluna usada pelo monthly-billing como cooldown anti-duplicidade (já referenciada no código)
ALTER TABLE public.store_plans
  ADD COLUMN IF NOT EXISTS last_billing_attempt_at timestamptz;

-- Índice para o webhook localizar transações pelo Asaas paymentId
CREATE INDEX IF NOT EXISTS idx_financial_tx_mp_payment_id
  ON public.financial_transactions (mercado_pago_payment_id)
  WHERE mercado_pago_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_tx_reference_code
  ON public.financial_transactions (reference_code);