CREATE TABLE public.store_credentials (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  asaas_account_id text,
  asaas_wallet_id text,
  asaas_subaccount_api_key text,
  asaas_pix_key text,
  asaas_pix_key_type text,
  asaas_activation_status jsonb,
  asaas_documents_sent boolean,
  asaas_auto_withdraw_enabled boolean NOT NULL DEFAULT false,
  asaas_min_withdraw_amount numeric NOT NULL DEFAULT 5,
  asaas_last_withdraw_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_credentials TO authenticated;
GRANT ALL ON public.store_credentials TO service_role;

ALTER TABLE public.store_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their own credentials" ON public.store_credentials FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid()));

CREATE POLICY "Platform admins can read all credentials" ON public.store_credentials FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update all credentials" ON public.store_credentials FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "service_role can manage all credentials" ON public.store_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Migrate existing data from stores
INSERT INTO public.store_credentials (
  store_id, asaas_account_id, asaas_wallet_id, asaas_subaccount_api_key,
  asaas_pix_key, asaas_pix_key_type, asaas_activation_status, asaas_documents_sent,
  asaas_auto_withdraw_enabled, asaas_min_withdraw_amount, asaas_last_withdraw_at
)
SELECT
  id, asaas_account_id, asaas_wallet_id, asaas_subaccount_api_key,
  asaas_pix_key, asaas_pix_key_type, asaas_activation_status, asaas_documents_sent,
  asaas_auto_withdraw_enabled, asaas_min_withdraw_amount, asaas_last_withdraw_at
FROM public.stores
WHERE asaas_account_id IS NOT NULL
   OR asaas_wallet_id IS NOT NULL
   OR asaas_subaccount_api_key IS NOT NULL
   OR asaas_pix_key IS NOT NULL;

-- Create index for fast lookups
CREATE INDEX idx_store_credentials_store_id ON public.store_credentials(store_id);