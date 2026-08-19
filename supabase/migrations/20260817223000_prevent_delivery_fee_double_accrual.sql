-- Previne lançamento duplicado da parcela de entrega absorvida pelo lojista.
-- O gatilho accrue_platform_fee_on_delivery é a única fonte de lançamento:
-- ele já registra idempotência por order_id em platform_fee_accruals e acumula
-- os componentes platform_add_customer + platform_add_payout_deduction.

BEGIN;

DROP TRIGGER IF EXISTS trg_accrue_fixed_plan_split ON public.orders;

-- Funções internas de trigger não devem ser invocadas diretamente por clientes.
REVOKE EXECUTE ON FUNCTION public.accrue_fixed_plan_split() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accrue_pdv_fixed_fee() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accrue_platform_fee_on_delivery() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accumulate_pdv_commission() FROM anon, authenticated;

COMMIT;
