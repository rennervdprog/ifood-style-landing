-- Create store_secrets table for sensitive integration credentials
CREATE TABLE public.store_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  zapi_enabled BOOLEAN NOT NULL DEFAULT false,
  zapi_instance_id TEXT,
  zapi_token TEXT,
  zapi_client_token TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_secrets ENABLE ROW LEVEL SECURITY;

-- Only store owner can read their secrets
CREATE POLICY "Store owner can read own secrets"
ON public.store_secrets
FOR SELECT
TO authenticated
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR public.is_platform_admin(auth.uid())
);

-- Only store owner can insert
CREATE POLICY "Store owner can insert own secrets"
ON public.store_secrets
FOR INSERT
TO authenticated
WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- Only store owner can update
CREATE POLICY "Store owner can update own secrets"
ON public.store_secrets
FOR UPDATE
TO authenticated
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  OR public.is_platform_admin(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_store_secrets_updated_at
BEFORE UPDATE ON public.store_secrets
FOR EACH ROW
EXECUTE FUNCTION public.touch_financial_transactions_updated_at();