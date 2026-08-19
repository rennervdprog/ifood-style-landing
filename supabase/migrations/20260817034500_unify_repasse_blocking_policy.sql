-- Política única de inadimplência de repasse:
-- cobrança semanal a partir de R$ 150, bloqueio em R$ 500 ou 30 dias sem pagamento.
-- O registro do motivo impede que um pagamento reative bloqueios administrativos.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS billing_blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_block_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_billing_blocked_at
  ON public.stores (billing_blocked_at)
  WHERE billing_blocked_at IS NOT NULL;
