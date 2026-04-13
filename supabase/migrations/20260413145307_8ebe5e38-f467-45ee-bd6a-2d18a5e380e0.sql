
-- Add app addon fields to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS app_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_subscribed boolean NOT NULL DEFAULT false;

-- Add app addon fee to store_plans
ALTER TABLE public.store_plans
  ADD COLUMN IF NOT EXISTS app_addon_fee numeric NOT NULL DEFAULT 0;

-- Add store_id to fcm_tokens for store-scoped push
ALTER TABLE public.fcm_tokens
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- Index for store-scoped push queries
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_store_id ON public.fcm_tokens(store_id) WHERE store_id IS NOT NULL;

-- Allow admin to read fcm_tokens for push sending
CREATE POLICY "Admin can read all fcm tokens"
  ON public.fcm_tokens FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Store owners can read tokens scoped to their store (for push)
CREATE POLICY "Store owners can read store fcm tokens"
  ON public.fcm_tokens FOR SELECT
  TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
