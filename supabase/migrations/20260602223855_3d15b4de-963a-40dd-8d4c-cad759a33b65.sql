
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('geocode', 'route')),
  lat double precision,
  lng double precision,
  route_km double precision,
  route_minutes double precision,
  source text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_key ON public.geocode_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_geocode_cache_expires ON public.geocode_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geocode_cache TO service_role;

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access geocode_cache"
ON public.geocode_cache
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
