
-- Add transaction_code column
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS transaction_code text;

-- Create sequence for SK codes
CREATE SEQUENCE IF NOT EXISTS withdrawal_code_seq START WITH 1001;

-- Create function to auto-generate transaction code
CREATE OR REPLACE FUNCTION public.generate_withdrawal_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.transaction_code := 'SK-' || lpad(nextval('withdrawal_code_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_withdrawal_code ON public.withdrawal_requests;
CREATE TRIGGER set_withdrawal_code
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_withdrawal_code();

-- Backfill existing rows
UPDATE public.withdrawal_requests 
SET transaction_code = 'SK-' || lpad(nextval('withdrawal_code_seq')::text, 4, '0')
WHERE transaction_code IS NULL;
