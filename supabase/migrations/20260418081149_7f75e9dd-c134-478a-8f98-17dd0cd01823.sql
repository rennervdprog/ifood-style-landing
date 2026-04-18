
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_stores_is_test ON public.stores(is_test) WHERE is_test = true;

UPDATE public.stores SET is_test = true
WHERE id IN ('66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5');

UPDATE public.store_balances
SET comissao_pendente = 0, pending_commission = 0, repasse_pendente = 0, updated_at = now()
WHERE store_id IN (SELECT id FROM public.stores WHERE is_test = true);

UPDATE public.financial_transactions
SET status = 'cancelled', updated_at = now()
WHERE store_id IN (SELECT id FROM public.stores WHERE is_test = true)
  AND status = 'pending';

UPDATE public.moderator_earnings
SET is_paid = true, paid_at = now()
WHERE store_id IN (SELECT id FROM public.stores WHERE is_test = true) AND is_paid = false;

CREATE OR REPLACE FUNCTION public.is_test_store(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_test FROM public.stores WHERE id = _store_id), false);
$$;

CREATE OR REPLACE FUNCTION public.accrue_fixed_plan_split()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _platform_split numeric;
  _delivery_mode text;
  _is_physical boolean;
  _is_test boolean;
BEGIN
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;
  SELECT is_test, delivery_mode INTO _is_test, _delivery_mode
  FROM public.stores WHERE id = NEW.store_id;
  IF COALESCE(_is_test, false) THEN RETURN NEW; END IF;
  _is_physical := COALESCE(NEW.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  IF NOT _is_physical THEN RETURN NEW; END IF;
  IF COALESCE(NEW.delivery_fee, 0) <= 0 THEN RETURN NEW; END IF;
  IF _delivery_mode != 'own' THEN RETURN NEW; END IF;
  _platform_split := public.get_fixed_plan_platform_split(NEW.store_id);
  IF _platform_split <= 0 THEN RETURN NEW; END IF;
  INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (NEW.store_id, 0, 0, _platform_split, now())
  ON CONFLICT (store_id) DO UPDATE SET
    repasse_pendente = store_balances.repasse_pendente + _platform_split,
    updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accrue_moderator_earnings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _mod_ref RECORD;
  _mod RECORD;
  _delivery_mode TEXT;
  _commission_rate NUMERIC;
  _mod_commission_amount NUMERIC;
  _plan_type TEXT;
  _is_test boolean;
BEGIN
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
  SELECT is_test INTO _is_test FROM public.stores WHERE id = NEW.store_id;
  IF COALESCE(_is_test, false) THEN RETURN NEW; END IF;
  SELECT mr.moderator_id INTO _mod_ref FROM public.moderator_referrals mr WHERE mr.store_id = NEW.store_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO _mod FROM public.moderators WHERE id = _mod_ref.moderator_id AND is_active = true;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT sp.plan_type INTO _plan_type FROM public.store_plans sp
  WHERE sp.store_id = NEW.store_id AND sp.is_active = true LIMIT 1;
  _plan_type := COALESCE(_plan_type, 'commission_only');
  _commission_rate := public.get_store_commission_rate(NEW.store_id);
  IF _commission_rate > 0 AND _mod.commission_split_percent > 0 THEN
    _mod_commission_amount := ROUND(NEW.subtotal * (_mod.commission_split_percent / 100.0), 2);
    IF _mod_commission_amount > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'commission_split', _mod_commission_amount);
    END IF;
  END IF;
  IF _plan_type = 'fixed' THEN
    SELECT delivery_mode INTO _delivery_mode FROM public.stores WHERE id = NEW.store_id;
    IF _delivery_mode = 'platform' AND COALESCE(NEW.delivery_fee, 0) > 0 AND _mod.delivery_split > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'delivery_split', _mod.delivery_split);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
