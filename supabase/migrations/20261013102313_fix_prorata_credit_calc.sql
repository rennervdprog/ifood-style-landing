-- Fix: calculate_prorata_credit usava EXTRACT(DAY FROM interval), que retorna
-- apenas o componente "dias" do intervalo (ex.: 12 em vez de 42 ao cruzar
-- fronteira de mês). Troca por diferença de datas, que retorna o total de dias.
-- (Auditoria PDV 2026-10-13, item 1.3)

CREATE OR REPLACE FUNCTION public.calculate_prorata_credit(_store_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _plan record;
  _days_in_cycle integer := 30;
  _days_used integer;
  _daily_rate numeric;
  _credit numeric;
BEGIN
  SELECT * INTO _plan FROM store_plans
  WHERE store_id = _store_id AND is_active = true LIMIT 1;

  IF NOT FOUND OR _plan.monthly_fee <= 0 THEN
    RETURN 0;
  END IF;

  -- Total de dias corridos desde a última cobrança (ou início), limitado ao ciclo.
  -- (now()::date - data::date) retorna o número total de dias, ao contrário de
  -- EXTRACT(DAY FROM interval), que retorna só o componente dias.
  _days_used := LEAST(
    (now()::date - COALESCE(_plan.last_billed_at, _plan.started_at)::date),
    _days_in_cycle
  );

  _daily_rate := _plan.monthly_fee / _days_in_cycle;
  _credit := GREATEST(0, ROUND((_days_in_cycle - _days_used) * _daily_rate, 2));

  RETURN _credit;
END;
$$;
