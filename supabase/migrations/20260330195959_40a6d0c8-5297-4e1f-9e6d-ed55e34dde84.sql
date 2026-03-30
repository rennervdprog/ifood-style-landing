
-- Add app_fee column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS app_fee numeric NOT NULL DEFAULT 0;

-- Security definer function to check if user is the platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'vinivias13@gmail.com'
  )
$$;

-- Admin can read ALL orders
CREATE POLICY "Platform admin can read all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Admin can read ALL order items
CREATE POLICY "Platform admin can read all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Admin can read ALL stores
CREATE POLICY "Platform admin can read all stores"
ON public.stores
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Admin can read ALL drivers
CREATE POLICY "Platform admin can read all drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));
