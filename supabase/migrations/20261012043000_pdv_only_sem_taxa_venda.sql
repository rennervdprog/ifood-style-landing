-- Somente PDV não deve ter taxa por venda — apenas R$ 69/mês flat.
-- Zera pdv_fixed_fee_per_sale para planos pdv_only ativos.
-- O trigger accrue_pdv_fixed_fee só acumula quando o valor > 0.

UPDATE public.store_plans
SET pdv_fixed_fee_per_sale = 0,
    pdv_commission_pending = 0
WHERE plan_type = 'pdv_only'
  AND is_active = true;
