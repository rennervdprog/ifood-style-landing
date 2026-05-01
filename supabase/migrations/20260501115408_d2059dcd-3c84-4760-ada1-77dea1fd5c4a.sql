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
  _config_value jsonb;
  _default_platform_delivery_split numeric := 2.00;
  _default_pix_op_fee numeric := 1.99;
BEGIN
  -- 0. Load default config from admin_settings
  SELECT value INTO _config_value
  FROM public.admin_settings
  WHERE key = 'delivery_fee_config'
  LIMIT 1;

  IF _config_value IS NOT NULL THEN
    _default_platform_delivery_split := COALESCE((_config_value->>'platform_split')::numeric, 2.00);
    _default_pix_op_fee := COALESCE((_config_value->>'pix_operational_fee')::numeric, 1.99);
  END IF;

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

  -- 1. PIX Operational Fee (For FIXED and SUPPORTER plans)
  IF (_plan.plan_type = 'fixed' OR _plan.plan_type = 'supporter') AND _payment_method = 'pix' THEN
    _pix_op_fee := COALESCE(_plan.pix_operational_fee_override, _default_pix_op_fee);
  END IF;

  -- 2. Commission Amount (For non-fixed/non-supporter plans)
  -- Hybrid and commission plans pay % over subtotal
  IF _plan.plan_type != 'fixed' AND _plan.plan_type != 'supporter' THEN
    _commission_amount := ROUND(COALESCE(_subtotal, 0) * (COALESCE(_plan.commission_rate, 6) / 100.0), 2);
  END IF;

  -- 3. Platform Delivery Split (Applied to ALL plans if delivery fee > 0)
  IF COALESCE(_delivery_fee, 0) > 0 THEN
    _platform_delivery_split := COALESCE(_plan.platform_delivery_split_override, _default_platform_delivery_split);
  END IF;

  -- Total platform share
  _platform_total := ROUND(_pix_op_fee + _commission_amount + _platform_delivery_split, 2);

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