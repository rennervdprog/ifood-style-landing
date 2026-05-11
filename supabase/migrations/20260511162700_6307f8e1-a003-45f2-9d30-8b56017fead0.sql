
CREATE TABLE public.fraud_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  store_id uuid,
  store_name text,
  store_city text,
  client_lat double precision,
  client_lng double precision,
  store_lat double precision,
  store_lng double precision,
  distance_km numeric,
  delivery_city text,
  reason text NOT NULL,
  blocked boolean NOT NULL DEFAULT true,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_fraud_attempts_user ON public.fraud_attempts(user_id, created_at DESC);
CREATE INDEX idx_fraud_attempts_store ON public.fraud_attempts(store_id, created_at DESC);

ALTER TABLE public.fraud_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can log fraud attempts"
  ON public.fraud_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins can read fraud attempts"
  ON public.fraud_attempts FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));
