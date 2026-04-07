-- Fix views to use SECURITY INVOKER
ALTER VIEW public.stores_public SET (security_invoker = on);
ALTER VIEW public.coupons_public SET (security_invoker = on);