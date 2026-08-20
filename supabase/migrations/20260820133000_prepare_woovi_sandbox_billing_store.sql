-- Reserva uma loja de teste já existente para homologação de mensalidade Woovi Sandbox.
-- Não altera lojas reais e não cria cobrança ou transação financeira.

DO $$
DECLARE
  v_store_id constant uuid := '86e2532c-0a38-4e3a-878b-8aa61ca28f6c';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.stores
    WHERE id = v_store_id
      AND is_test = true
  ) THEN
    RAISE EXCEPTION 'Loja de homologação não existe ou não está marcada como teste';
  END IF;

  UPDATE public.stores
  SET name = 'ItaSuper Woovi Sandbox Billing - NAO UTILIZAR',
      status = 'ativo',
      billing_blocked_at = NULL,
      billing_block_reason = NULL
  WHERE id = v_store_id
    AND is_test = true;

  IF NOT EXISTS (
    SELECT 1
    FROM public.store_plans
    WHERE store_id = v_store_id
      AND is_active = true
  ) THEN
    INSERT INTO public.store_plans (
      store_id,
      plan_type,
      monthly_fee,
      commission_rate,
      is_active,
      trial_ends_at,
      next_billing_date,
      last_billing_attempt_at,
      pdv_commission_pending
    ) VALUES (
      v_store_id,
      'fixed'::public.store_plan_type,
      3.99,
      0,
      true,
      now() - interval '1 day',
      now() - interval '1 day',
      NULL,
      0
    );
  END IF;
END
$$;
