
DROP VIEW IF EXISTS public.delivery_contacts;
CREATE VIEW public.delivery_contacts 
WITH (security_invoker = on)
AS
SELECT 
  user_id,
  full_name,
  phone,
  whatsapp_number,
  neighborhood
FROM public.profiles;

GRANT SELECT ON public.delivery_contacts TO authenticated;
