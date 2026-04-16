
-- Table for platform partners (you + your partner)
CREATE TABLE public.platform_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  profit_percent NUMERIC NOT NULL DEFAULT 0 CHECK (profit_percent >= 0 AND profit_percent <= 100),
  emergency_fund_percent NUMERIC NOT NULL DEFAULT 5 CHECK (emergency_fund_percent >= 0 AND emergency_fund_percent <= 50),
  pix_key TEXT,
  pix_type TEXT DEFAULT 'cpf',
  is_owner BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_transfer BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage partners"
  ON public.platform_partners FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Emergency fund tracking
CREATE TABLE public.emergency_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
  source TEXT NOT NULL,
  description TEXT,
  partner_id UUID REFERENCES public.platform_partners(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_fund ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage emergency fund"
  ON public.emergency_fund FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Partner payout history
CREATE TABLE public.partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.platform_partners(id) NOT NULL,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  emergency_deduction NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  payout_method TEXT DEFAULT 'asaas_pix',
  transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage partner payouts"
  ON public.partner_payouts FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Trigger for updated_at on platform_partners
CREATE TRIGGER update_platform_partners_updated_at
  BEFORE UPDATE ON public.platform_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_financial_transactions_updated_at();
