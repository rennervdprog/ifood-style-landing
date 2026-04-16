
-- Moderators table
CREATE TABLE public.moderators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  plan_fee_percent NUMERIC NOT NULL DEFAULT 40,
  delivery_split NUMERIC NOT NULL DEFAULT 1.00,
  commission_split_percent NUMERIC NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderators"
  ON public.moderators FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view own record"
  ON public.moderators FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Moderator referrals (which stores were referred by which moderator)
CREATE TABLE public.moderator_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moderator_id UUID NOT NULL REFERENCES public.moderators(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

ALTER TABLE public.moderator_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage referrals"
  ON public.moderator_referrals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view own referrals"
  ON public.moderator_referrals FOR SELECT
  TO authenticated
  USING (moderator_id IN (SELECT id FROM public.moderators WHERE user_id = auth.uid()));

-- Moderator earnings log
CREATE TABLE public.moderator_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moderator_id UUID NOT NULL REFERENCES public.moderators(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  earning_type TEXT NOT NULL CHECK (earning_type IN ('plan_fee', 'delivery_split', 'commission_split')),
  amount NUMERIC NOT NULL DEFAULT 0,
  period TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage earnings"
  ON public.moderator_earnings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view own earnings"
  ON public.moderator_earnings FOR SELECT
  TO authenticated
  USING (moderator_id IN (SELECT id FROM public.moderators WHERE user_id = auth.uid()));

-- Function to accrue moderator commission on order finalization
CREATE OR REPLACE FUNCTION public.accrue_moderator_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mod_ref RECORD;
  _mod RECORD;
  _plan RECORD;
  _delivery_mode TEXT;
  _commission_rate NUMERIC;
  _mod_commission_amount NUMERIC;
  _mod_delivery_amount NUMERIC;
BEGIN
  -- Only on transition TO finalizado
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- Check if this store was referred by a moderator
  SELECT mr.moderator_id INTO _mod_ref
  FROM public.moderator_referrals mr
  WHERE mr.store_id = NEW.store_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get moderator config
  SELECT * INTO _mod FROM public.moderators WHERE id = _mod_ref.moderator_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get store plan
  SELECT * INTO _plan FROM public.store_plans WHERE store_id = NEW.store_id AND is_active = true LIMIT 1;

  -- Get commission rate for this store
  _commission_rate := public.get_store_commission_rate(NEW.store_id);

  -- Commission split: moderator gets their split % from the store's commission on each order
  IF _commission_rate > 0 AND _mod.commission_split_percent > 0 THEN
    _mod_commission_amount := ROUND(NEW.subtotal * (_mod.commission_split_percent / 100.0), 2);
    IF _mod_commission_amount > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'commission_split', _mod_commission_amount);
    END IF;
  END IF;

  -- Delivery split for platform delivery
  SELECT delivery_mode INTO _delivery_mode FROM public.stores WHERE id = NEW.store_id;
  IF _delivery_mode = 'platform' AND COALESCE(NEW.delivery_fee, 0) > 0 AND _mod.delivery_split > 0 THEN
    INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
    VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'delivery_split', _mod.delivery_split);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accrue_moderator_earnings
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.accrue_moderator_earnings();

-- Function to accrue moderator plan fee earnings (called during monthly billing)
CREATE OR REPLACE FUNCTION public.accrue_moderator_plan_fee(_store_id UUID, _monthly_fee NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _mod_ref RECORD;
  _mod RECORD;
  _amount NUMERIC;
BEGIN
  SELECT mr.moderator_id INTO _mod_ref
  FROM public.moderator_referrals mr
  WHERE mr.store_id = _store_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO _mod FROM public.moderators WHERE id = _mod_ref.moderator_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  _amount := ROUND(_monthly_fee * (_mod.plan_fee_percent / 100.0), 2);
  IF _amount > 0 THEN
    INSERT INTO public.moderator_earnings (moderator_id, store_id, earning_type, amount, period)
    VALUES (_mod_ref.moderator_id, _store_id, 'plan_fee', _amount, to_char(now(), 'YYYY-MM'));
  END IF;
END;
$$;

-- Updated_at trigger for moderators
CREATE TRIGGER update_moderators_updated_at
  BEFORE UPDATE ON public.moderators
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_financial_transactions_updated_at();
