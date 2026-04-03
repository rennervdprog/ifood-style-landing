ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_reference text,
  ADD COLUMN IF NOT EXISTS address_city text DEFAULT 'Itatinga',
  ADD COLUMN IF NOT EXISTS address_state text DEFAULT 'SP';