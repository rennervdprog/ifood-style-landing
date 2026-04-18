-- 1. Adiciona modo de pagamento ao vínculo loja↔motoboy
ALTER TABLE public.store_drivers
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'fim_do_dia'
    CHECK (payment_mode IN ('instantaneo', 'fim_do_dia'));

-- 2. Adiciona campos de confirmação bilateral em store_driver_earnings
ALTER TABLE public.store_driver_earnings
  ADD COLUMN IF NOT EXISTS store_marked_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'fim_do_dia';

-- 3. Permite o status intermediário aguardando_confirmacao
-- (status já é text livre — não precisa alterar enum)

-- 4. Função: lojista marca como pago (vai para aguardando_confirmacao)
CREATE OR REPLACE FUNCTION public.store_mark_driver_earning_paid(
  _earning_id uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_owner uuid;
BEGIN
  SELECT sde.store_id, s.owner_id
    INTO v_store_id, v_owner
    FROM store_driver_earnings sde
    JOIN stores s ON s.id = sde.store_id
   WHERE sde.id = _earning_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE store_driver_earnings
     SET status = 'aguardando_confirmacao',
         store_marked_paid_at = now()
   WHERE id = _earning_id
     AND status = 'pendente';
END;
$$;

-- 5. Função: motoboy confirma recebimento → vira 'pago'
CREATE OR REPLACE FUNCTION public.driver_confirm_earning_received(
  _earning_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid;
BEGIN
  SELECT driver_user_id INTO v_driver
    FROM store_driver_earnings
   WHERE id = _earning_id;

  IF v_driver IS NULL OR v_driver <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE store_driver_earnings
     SET status = 'pago',
         driver_confirmed_at = now(),
         paid_at = COALESCE(paid_at, now())
   WHERE id = _earning_id
     AND status = 'aguardando_confirmacao';
END;
$$;

-- 6. Função em massa para lojista (marca todas pendentes do motoboy)
CREATE OR REPLACE FUNCTION public.store_mark_all_driver_earnings_paid(
  _driver_user_id uuid,
  _store_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner FROM stores WHERE id = _store_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE store_driver_earnings
     SET status = 'aguardando_confirmacao',
         store_marked_paid_at = now()
   WHERE store_id = _store_id
     AND driver_user_id = _driver_user_id
     AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 7. RLS: motoboy pode atualizar seus próprios earnings (apenas confirmar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_driver_earnings'
      AND policyname = 'Drivers can confirm own earnings'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "Drivers can confirm own earnings"
      ON public.store_driver_earnings
      FOR UPDATE
      TO authenticated
      USING (driver_user_id = auth.uid())
      WITH CHECK (driver_user_id = auth.uid())
    $POLICY$;
  END IF;
END $$;