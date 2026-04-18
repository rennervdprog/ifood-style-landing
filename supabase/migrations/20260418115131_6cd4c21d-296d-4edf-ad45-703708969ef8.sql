CREATE OR REPLACE FUNCTION public.get_fixed_plan_platform_split(_store_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _plan RECORD;
  _config_value jsonb;
  _platform_split numeric;
BEGIN
  -- Check if store has a fixed plan and load override
  SELECT sp.plan_type, sp.platform_delivery_split_override INTO _plan
  FROM public.store_plans sp
  WHERE sp.store_id = _store_id AND sp.is_active = true
  LIMIT 1;

  IF _plan.plan_type IS NULL OR _plan.plan_type != 'fixed' THEN
    RETURN 0;
  END IF;

  -- VIP override takes precedence (including 0)
  IF _plan.platform_delivery_split_override IS NOT NULL THEN
    RETURN _plan.platform_delivery_split_override;
  END IF;

  -- Read platform_split from admin_settings delivery_fee_config
  SELECT value INTO _config_value
  FROM public.admin_settings
  WHERE key = 'delivery_fee_config'
  LIMIT 1;

  IF _config_value IS NOT NULL AND _config_value ? 'platform_split' THEN
    _platform_split := (_config_value->>'platform_split')::numeric;
    RETURN COALESCE(_platform_split, 2);
  END IF;

  RETURN 2;
END;
$function$;