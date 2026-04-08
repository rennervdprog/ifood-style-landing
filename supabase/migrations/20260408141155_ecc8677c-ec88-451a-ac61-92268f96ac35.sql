
-- Table to archive account data when users delete their accounts
-- Retains data per legal requirements (LGPD, CTN Art.173)
CREATE TABLE public.archived_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  full_name text,
  email text,
  document text,
  phone text,
  whatsapp_number text,
  role text,
  city text,
  neighborhood text,
  pix_key text,
  pix_type text,
  cep text,
  street text,
  address_number text,
  terms_accepted_at timestamptz,
  account_created_at timestamptz,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deletion_reason text DEFAULT 'user_request',
  -- Retention: 5 years for fiscal data (CTN Art.173)
  retain_until timestamptz NOT NULL DEFAULT (now() + interval '5 years'),
  order_count integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Only platform admin can access archived accounts
ALTER TABLE public.archived_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read archived accounts"
  ON public.archived_accounts FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admin can insert archived accounts"
  ON public.archived_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Add deleted_at to profiles for soft-delete tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
