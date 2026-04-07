
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS asaas_account_id text,
ADD COLUMN IF NOT EXISTS asaas_wallet_id text;

COMMENT ON COLUMN public.stores.asaas_account_id IS 'Asaas subaccount ID for split payments';
COMMENT ON COLUMN public.stores.asaas_wallet_id IS 'Asaas wallet ID for receiving split payments';
