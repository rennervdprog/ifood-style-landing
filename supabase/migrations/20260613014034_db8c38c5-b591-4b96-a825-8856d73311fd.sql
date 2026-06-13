
CREATE TABLE IF NOT EXISTS public.asaas_subaccounts_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  external_store_id uuid,
  wallet_id text NOT NULL,
  account_id text,
  api_key text,
  cpf_cnpj text,
  email text,
  status text NOT NULL DEFAULT 'created',
  raw_response jsonb,
  last_error jsonb,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS asaas_subaccounts_registry_wallet_id_key ON public.asaas_subaccounts_registry(wallet_id);
CREATE INDEX IF NOT EXISTS asaas_subaccounts_registry_store_id_idx ON public.asaas_subaccounts_registry(store_id);
CREATE INDEX IF NOT EXISTS asaas_subaccounts_registry_external_store_id_idx ON public.asaas_subaccounts_registry(external_store_id);

GRANT SELECT, INSERT, UPDATE ON public.asaas_subaccounts_registry TO authenticated;
GRANT ALL ON public.asaas_subaccounts_registry TO service_role;

ALTER TABLE public.asaas_subaccounts_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage asaas registry"
ON public.asaas_subaccounts_registry
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_asaas_registry_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS asaas_subaccounts_registry_touch ON public.asaas_subaccounts_registry;
CREATE TRIGGER asaas_subaccounts_registry_touch
BEFORE UPDATE ON public.asaas_subaccounts_registry
FOR EACH ROW EXECUTE FUNCTION public.touch_asaas_registry_updated_at();
