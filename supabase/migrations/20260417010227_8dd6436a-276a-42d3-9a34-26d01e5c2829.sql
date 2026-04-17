-- ════════════════════════════════════════════════════════════════
-- Store-owned driver earnings system
-- - Store owner sets own_delivery_fee per delivery
-- - Driver receives (own_delivery_fee - platform_cut) per finalized order
-- - Store owner pays driver manually and marks as paid in the panel
-- ════════════════════════════════════════════════════════════════

-- Platform cut taken from the store's own delivery fee per order (default R$2)
INSERT INTO public.admin_settings (key, value)
VALUES ('store_driver_platform_cut', '{"amount": 2}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.store_driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  fee_total numeric NOT NULL DEFAULT 0,           -- value the store charges the customer
  platform_cut numeric NOT NULL DEFAULT 0,        -- what the platform retains (e.g. R$2)
  driver_amount numeric NOT NULL DEFAULT 0,       -- net amount the driver receives
  status text NOT NULL DEFAULT 'pendente',        -- 'pendente' | 'pago'
  paid_at timestamptz,
  paid_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_store_driver_earnings_driver
  ON public.store_driver_earnings(driver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_store_driver_earnings_store
  ON public.store_driver_earnings(store_id, status);

ALTER TABLE public.store_driver_earnings ENABLE ROW LEVEL SECURITY;

-- Drivers can see their own earnings
CREATE POLICY "Drivers see own store earnings"
ON public.store_driver_earnings
FOR SELECT TO authenticated
USING (driver_user_id = auth.uid());

-- Store owners can see/manage earnings for their store
CREATE POLICY "Store owners see store driver earnings"
ON public.store_driver_earnings
FOR SELECT TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners update store driver earnings"
ON public.store_driver_earnings
FOR UPDATE TO authenticated
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Platform admin full access
CREATE POLICY "Admin manage store driver earnings"
ON public.store_driver_earnings
FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Trigger function: create earning record when order is delivered by a store-linked driver
CREATE OR REPLACE FUNCTION public.create_store_driver_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_store_driver boolean;
  v_fee numeric;
  v_cut numeric;
BEGIN
  -- Only fire on transition into 'entregue' or 'finalizado'
  IF NEW.status NOT IN ('entregue', 'finalizado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Driver must be a store-linked driver for this store
  SELECT EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE store_id = NEW.store_id AND driver_user_id = NEW.driver_id
  ) INTO v_is_store_driver;

  IF NOT v_is_store_driver THEN
    RETURN NEW;
  END IF;

  -- Read store's own_delivery_fee
  SELECT COALESCE(own_delivery_fee, 0) INTO v_fee
  FROM public.stores WHERE id = NEW.store_id;

  -- Read platform cut from admin_settings
  SELECT COALESCE((value->>'amount')::numeric, 2)
  INTO v_cut
  FROM public.admin_settings
  WHERE key = 'store_driver_platform_cut';

  v_cut := COALESCE(v_cut, 2);

  IF v_fee <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.store_driver_earnings (
    store_id, driver_user_id, order_id, fee_total, platform_cut, driver_amount, status
  ) VALUES (
    NEW.store_id,
    NEW.driver_id,
    NEW.id,
    v_fee,
    LEAST(v_cut, v_fee),
    GREATEST(v_fee - v_cut, 0),
    'pendente'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_store_driver_earning ON public.orders;
CREATE TRIGGER trg_create_store_driver_earning
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_store_driver_earning();

-- RPC for store owner to mark earning as paid
CREATE OR REPLACE FUNCTION public.mark_store_driver_earning_paid(_earning_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_store_id uuid;
BEGIN
  SELECT s.owner_id, e.store_id INTO v_owner, v_store_id
  FROM public.store_driver_earnings e
  JOIN public.stores s ON s.id = e.store_id
  WHERE e.id = _earning_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Earning not found';
  END IF;

  IF v_owner <> auth.uid() AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.store_driver_earnings
  SET status = 'pago',
      paid_at = now(),
      paid_by = auth.uid(),
      notes = COALESCE(_notes, notes)
  WHERE id = _earning_id;
END;
$$;

-- Bulk pay all pending earnings for a driver
CREATE OR REPLACE FUNCTION public.mark_all_store_driver_earnings_paid(_driver_user_id uuid, _store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner FROM public.stores WHERE id = _store_id;

  IF v_owner <> auth.uid() AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.store_driver_earnings
  SET status = 'pago', paid_at = now(), paid_by = auth.uid()
  WHERE driver_user_id = _driver_user_id
    AND store_id = _store_id
    AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;