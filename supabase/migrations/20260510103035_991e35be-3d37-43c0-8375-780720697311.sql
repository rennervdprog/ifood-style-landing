-- Adiciona taxa fixa por venda PDV (R$ por venda) — independente do percentual
ALTER TABLE public.store_plans
  ADD COLUMN IF NOT EXISTS pdv_fixed_fee_per_sale NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Define R$1,00 por venda PDV para todos os planos fixos
UPDATE public.store_plans
SET pdv_fixed_fee_per_sale = 1.00
WHERE plan_type IN ('fixed', 'supporter') AND is_active = true;

-- Trigger: ao inserir pedido PDV, acumula taxa fixa em pdv_commission_pending
CREATE OR REPLACE FUNCTION public.accrue_pdv_fixed_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC(10,2);
BEGIN
  IF NEW.order_source = 'pdv' THEN
    SELECT COALESCE(pdv_fixed_fee_per_sale, 0) INTO v_fee
    FROM public.store_plans
    WHERE store_id = NEW.store_id AND is_active = true
    LIMIT 1;

    IF v_fee > 0 THEN
      UPDATE public.store_plans
      SET pdv_commission_pending = COALESCE(pdv_commission_pending, 0) + v_fee
      WHERE store_id = NEW.store_id AND is_active = true;

      -- Reflete no pedido para histórico/relatórios
      NEW.app_fee = COALESCE(NEW.app_fee, 0) + v_fee;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accrue_pdv_fixed_fee ON public.orders;
CREATE TRIGGER trg_accrue_pdv_fixed_fee
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.accrue_pdv_fixed_fee();