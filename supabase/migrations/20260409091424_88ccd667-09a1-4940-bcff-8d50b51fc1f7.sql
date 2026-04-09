
-- Fix stores_public view with correct column order
DROP VIEW IF EXISTS public.stores_public;

CREATE VIEW public.stores_public AS
SELECT 
  id,
  name,
  slug,
  image_url,
  category,
  rating,
  is_open,
  force_closed,
  status,
  delivery_mode,
  own_delivery_fee,
  created_at,
  owner_id,
  address_cep,
  address_city,
  address_complement,
  address_neighborhood,
  address_number,
  address_reference,
  address_state,
  address_street
FROM public.stores
WHERE status = 'ativo';
-- Explicitly excludes: asaas_account_id, asaas_wallet_id, settings
