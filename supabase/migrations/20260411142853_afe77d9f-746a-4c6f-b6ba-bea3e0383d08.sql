
-- Table to link drivers to specific stores (own delivery drivers)
CREATE TABLE public.store_drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (store_id, driver_user_id)
);

-- Enable RLS
ALTER TABLE public.store_drivers ENABLE ROW LEVEL SECURITY;

-- Store owners can read their own store drivers
CREATE POLICY "Store owners can read own store drivers"
ON public.store_drivers FOR SELECT
TO authenticated
USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()));

-- Store owners can add drivers to their store
CREATE POLICY "Store owners can insert own store drivers"
ON public.store_drivers FOR INSERT
TO authenticated
WITH CHECK (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()));

-- Store owners can remove drivers from their store
CREATE POLICY "Store owners can delete own store drivers"
ON public.store_drivers FOR DELETE
TO authenticated
USING (store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()));

-- Drivers can read their own links
CREATE POLICY "Drivers can read own store links"
ON public.store_drivers FOR SELECT
TO authenticated
USING (driver_user_id = auth.uid());

-- Platform admin full access
CREATE POLICY "Admin full access store drivers"
ON public.store_drivers FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Helper function to check if user is a store driver
CREATE OR REPLACE FUNCTION public.is_store_driver(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE driver_user_id = _user_id
      AND store_id = _store_id
  )
$$;

-- Update drivers RLS: store drivers can see ready orders for their linked stores
-- Add a new SELECT policy for store-linked drivers
CREATE POLICY "Store drivers can see linked store orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_drivers sd
    WHERE sd.driver_user_id = auth.uid()
      AND sd.store_id = orders.store_id
  )
);

-- Allow store drivers to update orders (for status changes like saiu_entrega)
CREATE POLICY "Store drivers can update linked store orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_drivers sd
    WHERE sd.driver_user_id = auth.uid()
      AND sd.store_id = orders.store_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.store_drivers sd
    WHERE sd.driver_user_id = auth.uid()
      AND sd.store_id = orders.store_id
  )
);
