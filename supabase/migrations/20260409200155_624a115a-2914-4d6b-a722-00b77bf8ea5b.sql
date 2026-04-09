
-- Loyalty configuration per store
CREATE TABLE IF NOT EXISTS public.loyalty_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  points_per_real numeric NOT NULL DEFAULT 1,
  min_points_redeem integer NOT NULL DEFAULT 50,
  discount_per_point numeric NOT NULL DEFAULT 0.10,
  max_discount_percent numeric NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read loyalty config" ON public.loyalty_config FOR SELECT USING (true);
CREATE POLICY "Store owners can manage own config" ON public.loyalty_config FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Admin can manage all config" ON public.loyalty_config FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Function to award loyalty points when order is finalized
CREATE OR REPLACE FUNCTION public.award_loyalty_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _config record;
  _points integer;
BEGIN
  IF NEW.status = 'finalizado' AND OLD.status IS DISTINCT FROM 'finalizado' THEN
    SELECT * INTO _config FROM public.loyalty_config
    WHERE store_id = NEW.store_id AND is_enabled = true;
    
    IF FOUND THEN
      _points := GREATEST(1, floor(NEW.subtotal * _config.points_per_real));
      
      INSERT INTO public.loyalty_points (user_id, store_id, points, total_orders, last_order_at)
      VALUES (NEW.client_id, NEW.store_id, _points, 1, now())
      ON CONFLICT (user_id, store_id) DO UPDATE SET
        points = loyalty_points.points + _points,
        total_orders = loyalty_points.total_orders + 1,
        last_order_at = now(),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add unique constraint on loyalty_points if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_points_user_store_unique'
  ) THEN
    ALTER TABLE public.loyalty_points ADD CONSTRAINT loyalty_points_user_store_unique UNIQUE (user_id, store_id);
  END IF;
END$$;

-- Create trigger
DROP TRIGGER IF EXISTS award_loyalty_on_order_finalized ON public.orders;
CREATE TRIGGER award_loyalty_on_order_finalized
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.award_loyalty_points();
