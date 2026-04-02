
-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_value numeric NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  first_order_only boolean NOT NULL DEFAULT false,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Admin can manage all coupons" ON public.coupons FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "Store owners can manage own coupons" ON public.coupons FOR ALL TO authenticated USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())) WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Coupon usage tracking
CREATE TABLE public.coupon_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own coupon uses" ON public.coupon_uses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can read all coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));

-- Order messages (chat)
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order participants can read messages" ON public.order_messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.client_id = auth.uid() OR o.store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()) OR is_platform_admin(auth.uid()))
  )
);

CREATE POLICY "Order participants can send messages" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
    AND (o.client_id = auth.uid() OR o.store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()))
  )
);

-- Enable realtime for order_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
