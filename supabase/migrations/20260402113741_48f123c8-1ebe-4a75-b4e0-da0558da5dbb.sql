
-- Admin settings table (key-value store for platform config)
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only platform admin can read/write
CREATE POLICY "Admin can read settings" ON public.admin_settings
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admin can insert settings" ON public.admin_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admin can update settings" ON public.admin_settings
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admin can delete settings" ON public.admin_settings
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

-- Payout history table to track manual payments
CREATE TABLE public.payout_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'store' or 'driver'
  entity_id text NOT NULL, -- store_id or driver_user_id
  entity_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payout_type text NOT NULL DEFAULT 'manual', -- 'manual' or 'auto'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_user_id uuid NOT NULL
);

ALTER TABLE public.payout_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payout history" ON public.payout_history
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Insert default payout modes
INSERT INTO public.admin_settings (key, value) VALUES
  ('payout_modes', '{"store_payout": "manual", "driver_payout": "manual", "admin_commission": "manual"}'::jsonb);
