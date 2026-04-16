
CREATE OR REPLACE FUNCTION public.accrue_moderator_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mod_ref RECORD;
  _mod RECORD;
  _delivery_mode TEXT;
  _commission_rate NUMERIC;
  _mod_commission_amount NUMERIC;
  _plan_type TEXT;
BEGIN
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;

  SELECT mr.moderator_id INTO _mod_ref
  FROM public.moderator_referrals mr
  WHERE mr.store_id = NEW.store_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _mod FROM public.moderators WHERE id = _mod_ref.moderator_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT sp.plan_type INTO _plan_type
  FROM public.store_plans sp
  WHERE sp.store_id = NEW.store_id AND sp.is_active = true
  LIMIT 1;

  _plan_type := COALESCE(_plan_type, 'commission_only');

  _commission_rate := public.get_store_commission_rate(NEW.store_id);

  -- Commission split: only for hybrid and commission_only plans
  IF _commission_rate > 0 AND _mod.commission_split_percent > 0 THEN
    _mod_commission_amount := ROUND(NEW.subtotal * (_mod.commission_split_percent / 100.0), 2);
    IF _mod_commission_amount > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'commission_split', _mod_commission_amount);
    END IF;
  END IF;

  -- Delivery split: ONLY for fixed (Essencial) plan
  IF _plan_type = 'fixed' THEN
    SELECT delivery_mode INTO _delivery_mode FROM public.stores WHERE id = NEW.store_id;
    IF _delivery_mode = 'platform' AND COALESCE(NEW.delivery_fee, 0) > 0 AND _mod.delivery_split > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'delivery_split', _mod.delivery_split);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
