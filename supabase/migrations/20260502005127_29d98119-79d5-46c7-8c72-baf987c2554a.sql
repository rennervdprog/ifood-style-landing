ALTER TABLE public.store_plans
ADD COLUMN IF NOT EXISTS last_billing_attempt_at timestamptz;