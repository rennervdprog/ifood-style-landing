
-- Create withdrawal_requests table for driver payout requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id uuid NOT NULL,
  amount numeric NOT NULL,
  pix_key text NOT NULL,
  pix_type text NOT NULL DEFAULT 'cpf',
  status text NOT NULL DEFAULT 'solicitado',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  admin_notes text
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own requests
CREATE POLICY "Drivers can read own withdrawal requests" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid());

-- Drivers can insert their own requests
CREATE POLICY "Drivers can create withdrawal requests" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (driver_user_id = auth.uid());

-- Admin can read all
CREATE POLICY "Admin can read all withdrawal requests" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Admin can update (mark as paid)
CREATE POLICY "Admin can update withdrawal requests" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
