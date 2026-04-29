-- Add columns required for payout idempotency and native-split detection
-- These were referenced in edge functions but missing in the orders table.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_payout_id text,
  ADD COLUMN IF NOT EXISTS store_payout_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_payout_error text,
  ADD COLUMN IF NOT EXISTS asaas_split_native boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asaas_payment_id text;

CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment_id ON public.orders (asaas_payment_id);

-- Idempotency table for webhook events (prevents double-processing on retries)
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text NOT NULL,
  event text NOT NULL,
  external_reference text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb,
  CONSTRAINT asaas_webhook_events_payment_event_unique UNIQUE (payment_id, event)
);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read webhook events" ON public.asaas_webhook_events;
CREATE POLICY "Admin can read webhook events"
ON public.asaas_webhook_events
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

-- Manual review queue for suspicious Asaas TRANSFER authorizations
CREATE TABLE IF NOT EXISTS public.asaas_transfer_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id text,
  value numeric,
  description text,
  reason text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_transfer_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage transfer review queue" ON public.asaas_transfer_review_queue;
CREATE POLICY "Admin can manage transfer review queue"
ON public.asaas_transfer_review_queue
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));