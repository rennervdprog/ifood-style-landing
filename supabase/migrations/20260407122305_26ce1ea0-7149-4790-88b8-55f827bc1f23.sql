
-- 1) Trigger to validate and recalculate order prices server-side on INSERT
-- This prevents client-side price manipulation
CREATE OR REPLACE FUNCTION public.validate_order_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _calculated_subtotal numeric := 0;
  _item record;
  _app_fee numeric;
  _store_delivery_mode text;
  _store_own_fee numeric;
BEGIN
  -- Recalculate subtotal from actual product prices in order_items
  -- NOTE: order_items are inserted AFTER the order, so we validate on UPDATE too
  -- For INSERT, we trust the subtotal temporarily but lock the app_fee at 15%
  
  -- Always enforce app_fee = 15% of subtotal (never trust client)
  _app_fee := ROUND(COALESCE(NEW.subtotal, 0) * 0.15, 2);
  NEW.app_fee := _app_fee;

  -- Ensure delivery_fee is non-negative
  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;

  -- Recalculate total_price = subtotal + delivery_fee (coupon discounts handled separately)
  -- total_price must be >= 0
  NEW.total_price := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_prices ON public.orders;
CREATE TRIGGER trg_validate_order_prices
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_prices();

-- 2) Trigger to re-validate after order_items are inserted (verify subtotal matches actual items)
CREATE OR REPLACE FUNCTION public.verify_order_subtotal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _real_subtotal numeric;
  _order_record record;
BEGIN
  -- Calculate the real subtotal from order_items
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO _real_subtotal
  FROM public.order_items
  WHERE order_id = NEW.order_id;

  -- Get current order
  SELECT * INTO _order_record FROM public.orders WHERE id = NEW.order_id;

  -- If the client-submitted subtotal differs from real, correct it
  IF _order_record IS NOT NULL AND ABS(_real_subtotal - _order_record.subtotal) > 0.01 THEN
    UPDATE public.orders
    SET subtotal = _real_subtotal,
        app_fee = ROUND(_real_subtotal * 0.15, 2),
        total_price = GREATEST(0, _real_subtotal + COALESCE(_order_record.delivery_fee, 0))
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_order_subtotal ON public.order_items;
CREATE TRIGGER trg_verify_order_subtotal
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_order_subtotal();

-- 3) Atomic coupon usage RPC to prevent race conditions
CREATE OR REPLACE FUNCTION public.use_coupon(_coupon_id uuid, _user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _coupon record;
BEGIN
  -- Lock the coupon row to prevent race conditions
  SELECT * INTO _coupon
  FROM public.coupons
  WHERE id = _coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado.';
  END IF;

  IF NOT _coupon.is_active THEN
    RAISE EXCEPTION 'Cupom inativo.';
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.used_count >= _coupon.max_uses THEN
    RAISE EXCEPTION 'Cupom esgotado.';
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Cupom expirado.';
  END IF;

  -- Check if user already used this coupon
  IF EXISTS (SELECT 1 FROM public.coupon_uses WHERE coupon_id = _coupon_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Você já utilizou este cupom.';
  END IF;

  -- Atomically increment used_count and insert usage record
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_id;
  INSERT INTO public.coupon_uses (coupon_id, user_id, order_id) VALUES (_coupon_id, _user_id, _order_id);

  RETURN true;
END;
$$;
