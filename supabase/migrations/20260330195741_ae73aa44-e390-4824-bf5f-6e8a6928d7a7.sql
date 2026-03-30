
-- Create drivers table to track verified delivery drivers
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own record
CREATE POLICY "Drivers can read own record"
ON public.drivers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Security definer function to check if user is a driver
CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Drop the overly permissive driver policies
DROP POLICY IF EXISTS "Drivers can see ready orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can accept or finish orders" ON public.orders;

-- Recreate with driver role check
CREATE POLICY "Drivers can see ready orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.is_driver(auth.uid()) AND (
    status = 'pronto_para_entrega'
    OR driver_id = auth.uid()
  )
);

CREATE POLICY "Drivers can accept or finish orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  public.is_driver(auth.uid()) AND (
    (status = 'pronto_para_entrega' AND driver_id IS NULL)
    OR (driver_id = auth.uid() AND status = 'em_transito')
  )
)
WITH CHECK (
  public.is_driver(auth.uid()) AND driver_id = auth.uid()
);
