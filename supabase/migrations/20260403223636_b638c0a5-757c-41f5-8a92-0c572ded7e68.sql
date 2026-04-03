
-- ══════ BANNERS TABLE ══════
CREATE TABLE public.banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_type text NOT NULL DEFAULT 'none',
  link_value text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active banners" ON public.banners
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Platform admin can manage banners" ON public.banners
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Store owners can manage own banners" ON public.banners
  FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ══════ LOYALTY POINTS TABLE ══════
CREATE TABLE public.loyalty_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  last_order_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own loyalty" ON public.loyalty_points
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Store owners can read store loyalty" ON public.loyalty_points
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Platform admin can read all loyalty" ON public.loyalty_points
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ══════ ADD scheduled_for TO ORDERS ══════
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone;

-- ══════ LOYALTY CONFIG IN ADMIN_SETTINGS ══════
INSERT INTO public.admin_settings (key, value) 
VALUES ('loyalty_config', '{"points_per_order": 1, "reward_threshold": 10, "reward_discount_percent": 10}')
ON CONFLICT (key) DO NOTHING;

-- ══════ FIRST ORDER COUPON CONFIG ══════
INSERT INTO public.admin_settings (key, value)
VALUES ('first_order_coupon', '{"enabled": true, "discount_type": "percentage", "discount_value": 10, "code": "PRIMEIRA10"}')
ON CONFLICT (key) DO NOTHING;
