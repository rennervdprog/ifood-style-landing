-- 1. Add subaccount API key column (walletId already exists)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS asaas_subaccount_api_key text;

COMMENT ON COLUMN public.stores.asaas_subaccount_api_key IS 'Encrypted API key for the store Asaas subaccount (used for split & status checks)';
COMMENT ON COLUMN public.stores.asaas_wallet_id IS 'Asaas walletId used in payment splits to send funds to store subaccount';

-- 2. Function: calculate platform split amount for a given order
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
  _fee_config jsonb;
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

  -- Get global fee config
  SELECT value INTO _fee_config
  FROM public.admin_settings WHERE key = 'delivery_fee_config' LIMIT 1;

  -- Default plan = commission_only 6%
  IF _plan IS NULL THEN
    _plan.plan_type := 'commission_only';
    _plan.commission_rate := 6;
  END IF;

  IF _plan.plan_type = 'fixed' THEN
    -- Fixed plan: R$1 PIX op fee + R$2 platform delivery split (if own delivery)
    IF _payment_method = 'pix' THEN
      _pix_op_fee := COALESCE(
        _plan.pix_operational_fee_override,
        (_fee_config->>'pix_operational_fee')::numeric,
        1
      );
    END IF;

    IF _delivery_mode = 'own' AND COALESCE(_delivery_fee, 0) > 0 THEN
      _platform_delivery_split := COALESCE(
        _plan.platform_delivery_split_override,
        (_fee_config->>'platform_split')::numeric,
        2
      );
    END IF;

    _platform_total := _pix_op_fee + _platform_delivery_split;
  ELSE
    -- Commission plans (commission_only / hybrid): % over subtotal
    _commission_amount := ROUND(COALESCE(_subtotal, 0) * (COALESCE(_plan.commission_rate, 6) / 100.0), 2);
    _platform_total := _commission_amount;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_asaas_split_for_order(uuid, numeric, numeric, text) TO authenticated, service_role;