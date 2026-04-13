
-- Add lat/lng to orders for precise client delivery location
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_lat double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_lng double precision;

-- Add lat/lng to stores for precise store location
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS longitude double precision;
