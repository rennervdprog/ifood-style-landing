-- O REVOKE por papel não remove permissões herdadas de PUBLIC.
-- Estas funções são internas a gatilhos e não devem possuir chamada direta.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.accrue_fixed_plan_split() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accrue_pdv_fixed_fee() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accrue_platform_fee_on_delivery() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accumulate_pdv_commission() FROM PUBLIC;

COMMIT;
