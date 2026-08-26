-- Corrige o gatilho do Essencial para R$ 5.000 acumulados em janela de 60 dias.
-- Planos não-fixed preservam a regra legada de dois meses para evitar
-- alteração involuntária de lojas antigas ou de outros produtos.

CREATE OR REPLACE FUNCTION public.check_plan_upgrade(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _plan RECORD;
  _last_2_months text[];
  _months_above integer := 0;
  _m text;
  _rev numeric;
  _gmv_60d numeric := 0;
  _window_start timestamptz;
  _window_days integer;
BEGIN
  SELECT * INTO _plan
  FROM public.store_plans
  WHERE store_id = _store_id
    AND is_active = true
    AND revenue_threshold IS NOT NULL
    AND upgraded_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'none', 'reason', 'no_threshold_configured');
  END IF;

  -- Regra oficial do Essencial: vendas elegíveis acumuladas em janela de 60 dias.
  -- A janela é móvel, em linha com o fluxo público que informa "últimos 60 dias".
  IF _plan.plan_type = 'fixed' THEN
    _window_days := 60;
    _window_start := GREATEST(
      COALESCE(_plan.started_at, _plan.created_at, now() - interval '60 days'),
      now() - interval '60 days'
    );

    SELECT COALESCE(SUM(o.subtotal), 0)
      INTO _gmv_60d
    FROM public.orders o
    WHERE o.store_id = _store_id
      AND o.status IN ('finalizado', 'entregue')
      AND o.created_at >= _window_start
      AND o.created_at <= now();

    UPDATE public.store_plans
    SET months_above_threshold = CASE WHEN _gmv_60d >= _plan.revenue_threshold THEN 1 ELSE 0 END
    WHERE id = _plan.id;

    IF _gmv_60d < _plan.revenue_threshold THEN
      RETURN jsonb_build_object(
        'action', 'monitoring',
        'gmv', _gmv_60d,
        'threshold', _plan.revenue_threshold,
        'window_days', _window_days,
        'months_above', 0,
        'months_needed', 1
      );
    END IF;

    IF _plan.upgrade_monthly_fee IS NULL THEN
      RETURN jsonb_build_object(
        'action', 'none',
        'reason', 'no_upgrade_fee_configured',
        'gmv', _gmv_60d,
        'threshold', _plan.revenue_threshold,
        'window_days', _window_days
      );
    END IF;

    UPDATE public.store_plans
    SET monthly_fee = _plan.upgrade_monthly_fee,
        upgraded_at = now(),
        months_above_threshold = 1
    WHERE id = _plan.id;

    RETURN jsonb_build_object(
      'action', 'upgraded',
      'old_fee', _plan.monthly_fee,
      'new_fee', _plan.upgrade_monthly_fee,
      'gmv', _gmv_60d,
      'threshold', _plan.revenue_threshold,
      'window_days', _window_days,
      'months_above', 1,
      'months_needed', 1
    );
  END IF;

  -- Compatibilidade: Autonomia e demais planos dinâmicos legados permanecem
  -- na regra anterior até haver decisão comercial específica para eles.
  _last_2_months := ARRAY[
    to_char(now() - interval '1 month', 'YYYY-MM'),
    to_char(now() - interval '2 months', 'YYYY-MM')
  ];

  FOREACH _m IN ARRAY _last_2_months LOOP
    SELECT COALESCE(total_revenue, 0) INTO _rev
    FROM public.store_monthly_revenue
    WHERE store_id = _store_id AND year_month = _m;

    IF COALESCE(_rev, 0) >= _plan.revenue_threshold THEN
      _months_above := _months_above + 1;
    END IF;
  END LOOP;

  UPDATE public.store_plans
  SET months_above_threshold = _months_above
  WHERE id = _plan.id;

  IF _months_above >= COALESCE(_plan.upgrade_trigger_months, 2) THEN
    IF _plan.upgrade_monthly_fee IS NULL THEN
      RETURN jsonb_build_object(
        'action', 'none',
        'reason', 'no_upgrade_fee_configured',
        'months_above', _months_above,
        'months_needed', COALESCE(_plan.upgrade_trigger_months, 2),
        'threshold', _plan.revenue_threshold
      );
    END IF;

    UPDATE public.store_plans
    SET monthly_fee = _plan.upgrade_monthly_fee,
        upgraded_at = now(),
        months_above_threshold = _months_above
    WHERE id = _plan.id;

    RETURN jsonb_build_object(
      'action', 'upgraded',
      'old_fee', _plan.monthly_fee,
      'new_fee', _plan.upgrade_monthly_fee,
      'months_above', _months_above,
      'months_needed', COALESCE(_plan.upgrade_trigger_months, 2),
      'threshold', _plan.revenue_threshold
    );
  END IF;

  RETURN jsonb_build_object(
    'action', 'monitoring',
    'months_above', _months_above,
    'months_needed', COALESCE(_plan.upgrade_trigger_months, 2),
    'threshold', _plan.revenue_threshold
  );
END;
$function$;
