-- Fix security definer view warning
DROP VIEW IF EXISTS public.profile_contacts;

CREATE VIEW public.profile_contacts 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  full_name,
  phone,
  whatsapp_number,
  neighborhood,
  email
FROM public.profiles
WHERE deleted_at IS NULL;

GRANT SELECT ON public.profile_contacts TO authenticated;