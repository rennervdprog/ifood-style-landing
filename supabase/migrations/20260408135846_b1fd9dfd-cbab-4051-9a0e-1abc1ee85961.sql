
-- Table to track user acceptance of terms of use and privacy policy
CREATE TABLE public.terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL DEFAULT '1.0',
  privacy_version text NOT NULL DEFAULT '1.0',
  ip_address text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_terms_acceptance_user ON public.terms_acceptance(user_id);

-- Enable RLS
ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptance records
CREATE POLICY "Users can read own terms acceptance"
  ON public.terms_acceptance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own acceptance
CREATE POLICY "Users can insert own terms acceptance"
  ON public.terms_acceptance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin can read all
CREATE POLICY "Admin can read all terms acceptance"
  ON public.terms_acceptance FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Add terms_accepted column to profiles for quick check
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
