
REVOKE EXECUTE ON FUNCTION public.validate_partner_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_auto_approve_partner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_valid_cpf(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_valid_cnpj(text) FROM PUBLIC, anon;
