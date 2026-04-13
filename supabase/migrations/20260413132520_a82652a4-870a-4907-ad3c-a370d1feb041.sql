
-- Driver GPS location tracking
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_driver_locations_driver ON public.driver_locations (driver_user_id);
CREATE INDEX idx_driver_locations_order ON public.driver_locations (order_id);
CREATE INDEX idx_driver_locations_updated ON public.driver_locations (updated_at DESC);

-- Only keep latest location per driver (upsert pattern uses this)
CREATE UNIQUE INDEX idx_driver_locations_unique_driver ON public.driver_locations (driver_user_id);

-- Enable RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Driver can upsert their own location
CREATE POLICY "Drivers can insert own location"
ON public.driver_locations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = driver_user_id);

CREATE POLICY "Drivers can update own location"
ON public.driver_locations FOR UPDATE
TO authenticated
USING (auth.uid() = driver_user_id);

-- Driver can read own location
CREATE POLICY "Drivers can read own location"
ON public.driver_locations FOR SELECT
TO authenticated
USING (auth.uid() = driver_user_id);

-- Admin can read all
CREATE POLICY "Admins can read all locations"
ON public.driver_locations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Store owners can read locations for orders in their stores
CREATE POLICY "Store owners can read driver location for their orders"
ON public.driver_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON o.store_id = s.id
    WHERE o.id = driver_locations.order_id
      AND s.owner_id = auth.uid()
  )
);

-- Clients can read location for their active orders
CREATE POLICY "Clients can read driver location for their orders"
ON public.driver_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = driver_locations.order_id
      AND o.client_id = auth.uid()
      AND o.status IN ('em_transito', 'saiu_entrega')
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
