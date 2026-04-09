
-- Plan type enum
CREATE TYPE public.store_plan_type AS ENUM ('fixed', 'hybrid', 'commission_only');

-- Store plans table
CREATE TABLE public.store_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_type public.store_plan_type NOT NULL DEFAULT 'commission_only',
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_billing_date TIMESTAMP WITH TIME ZONE,
  last_billed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.store_plans ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin can manage all store plans"
  ON public.store_plans FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Store owners can read own plan
CREATE POLICY "Store owners can read own plan"
  ON public.store_plans FOR SELECT
  TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Update trigger for updated_at
CREATE TRIGGER update_store_plans_updated_at
  BEFORE UPDATE ON public.store_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_financial_transactions_updated_at();

-- Migrate existing stores: all current stores get 'commission_only' plan with their existing rate
INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, next_billing_date)
SELECT id, 'commission_only', 0, commission_rate, NULL
FROM public.stores
ON CONFLICT (store_id) DO NOTHING;
