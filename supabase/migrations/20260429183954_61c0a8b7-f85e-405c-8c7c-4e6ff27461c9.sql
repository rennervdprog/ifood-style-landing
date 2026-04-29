-- 1. Transformar Views de SECURITY DEFINER para SECURITY INVOKER
DROP VIEW IF EXISTS public.stores_public;
CREATE VIEW public.stores_public WITH (security_invoker = true) AS 
SELECT * FROM public.stores WHERE status = 'ativo'::store_status;

DROP VIEW IF EXISTS public.stores_driver_view;
CREATE VIEW public.stores_driver_view WITH (security_invoker = true) AS 
SELECT s.id, s.name, s.address_street, s.address_neighborhood, s.image_url
FROM public.stores s;

DROP VIEW IF EXISTS public.profile_contacts;
CREATE VIEW public.profile_contacts WITH (security_invoker = true) AS 
SELECT user_id, full_name, phone, whatsapp_number, neighborhood, email
FROM public.profiles;

-- 2. Corrigir permissões de funções SECURITY DEFINER
-- Apenas usuários autenticados devem ter permissão de execução
REVOKE EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_store_driver_earnings_paid(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.register_as_motoboy(text, text, text, text) FROM public, anon;

-- 3. Reforçar o search_path em funções críticas para evitar sequestro de chamadas
ALTER FUNCTION public.is_platform_admin(uuid) SET search_path = public;
ALTER FUNCTION public.update_store_rating() SET search_path = public;
ALTER FUNCTION public.check_device_active(text) SET search_path = public;

-- 4. Garantir que as tabelas base tenham RLS habilitado (reforço)
ALTER TABLE IF EXISTS public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stores ENABLE ROW LEVEL SECURITY;
