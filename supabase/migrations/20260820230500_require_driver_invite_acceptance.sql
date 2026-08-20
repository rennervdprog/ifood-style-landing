-- Todo novo vínculo criado por uma loja deve começar como convite pendente.
-- Vínculos já aceitos permanecem inalterados. O entregador aceita ou recusa no app.

BEGIN;

ALTER TABLE public.store_drivers
  ALTER COLUMN status SET DEFAULT 'pending'::public.store_driver_status;

-- A política anterior validava apenas a titularidade da loja e permitia ao lojista
-- enviar status=accepted diretamente. Restringimos novos inserts de lojista a pending.
DROP POLICY IF EXISTS "Store owners can insert own store drivers" ON public.store_drivers;

CREATE POLICY "Store owners can invite drivers to own store"
ON public.store_drivers
FOR INSERT
TO authenticated
WITH CHECK (
  is_store_owner((SELECT auth.uid()), store_id)
  AND status = 'pending'::public.store_driver_status
);

COMMIT;
