ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS cep text;