-- Registro versionado do contrato de endereço de entrega em public.orders.
-- Este DDL foi aplicado anteriormente pela edge function one-shot
-- `oneshot-order-address-contract`, agora REMOVIDA por conter token
-- administrativo externo e executar SQL arbitrário sem checagem de papel.
-- A partir daqui, qualquer alteração de schema passa por migration versionada.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_cep text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_state text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_cep_format') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_cep_format
      CHECK (delivery_cep IS NULL OR delivery_cep ~ '^[0-9]{8}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_state_format') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_state_format
      CHECK (delivery_state IS NULL OR delivery_state ~ '^[A-Z]{2}$') NOT VALID;
  END IF;
END $$;

GRANT SELECT (delivery_cep, delivery_city, delivery_state),
      INSERT (delivery_cep, delivery_city, delivery_state)
  ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
