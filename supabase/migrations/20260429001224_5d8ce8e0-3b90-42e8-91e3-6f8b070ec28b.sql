CREATE OR REPLACE FUNCTION public.get_asaas_split_for_order(
  _store_id uuid,
  _subtotal numeric,
  _delivery_fee numeric,
  _payment_method text DEFAULT 'pix'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan record;
  _delivery_mode text;
  _pix_op_fee numeric := 0;
  _platform_delivery_split numeric := 0;
  _commission_amount numeric := 0;
  _platform_total numeric := 0;
  _wallet_id text;
BEGIN
  -- Get active plan
  SELECT plan_type, commission_rate, pix_operational_fee_override, platform_delivery_split_override
    INTO _plan
  FROM public.store_plans
  WHERE store_id = _store_id AND is_active = true
  LIMIT 1;

  -- Get store delivery mode + wallet
  SELECT delivery_mode, asaas_wallet_id INTO _delivery_mode, _wallet_id
  FROM public.stores WHERE id = _store_id;

  -- Default plan = commission_only 6%
  IF _plan IS NULL THEN
    _plan.plan_type := 'commission_only';
    _plan.commission_rate := 6;
  END IF;

  -- 1. PIX Operational Fee (Only for FIXED plan)
  -- Per user request: R$ 1,99 for fixed plan
  IF _plan.plan_type = 'fixed' AND _payment_method = 'pix' THEN
    _pix_op_fee := COALESCE(_plan.pix_operational_fee_override, 1.99);
  END IF;

  -- 2. Commission Amount (For non-fixed plans)
  -- Commission plans pay % over subtotal
  IF _plan.plan_type != 'fixed' THEN
    _commission_amount := ROUND(COALESCE(_subtotal, 0) * (COALESCE(_plan.commission_rate, 6) / 100.0), 2);
  END IF;

  -- 3. Platform Delivery Split (R$ 2.00 for ALL plans if own delivery)
  -- Per user request: R$ 2,00 added on top of merchant fee
  IF _delivery_mode = 'own' AND COALESCE(_delivery_fee, 0) > 0 THEN
    _platform_delivery_split := COALESCE(_plan.platform_delivery_split_override, 2.00);
  END IF;

  -- Total platform share
  _platform_total := _pix_op_fee + _commission_amount + _platform_delivery_split;

  -- Round to 2 decimals
  _platform_total := ROUND(_platform_total, 2);

  RETURN jsonb_build_object(
    'platform_amount', _platform_total,
    'store_wallet_id', _wallet_id,
    'plan_type', _plan.plan_type,
    'pix_op_fee', _pix_op_fee,
    'platform_delivery_split', _platform_delivery_split,
    'commission_amount', _commission_amount,
    'has_split', (_wallet_id IS NOT NULL AND _platform_total > 0)
  );
END;
$$;
