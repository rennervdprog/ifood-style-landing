
-- Fase 1: RPC para decrementar comissão PDV de forma atômica após pagamento confirmado.
CREATE OR REPLACE FUNCTION public.decrement_pdv_commission_pending(_store_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur numeric := 0;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;

  SELECT COALESCE(pdv_commission_pending, 0) INTO v_cur
  FROM public.store_plans
  WHERE store_id = _store_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.store_plans
     SET pdv_commission_pending = GREATEST(0, v_cur - _amount),
         updated_at = now()
   WHERE store_id = _store_id AND is_active = true;
END;
$$;

-- Fase 1: trigger de proteção em store_balances (modo WARNING — observação por 7 dias
-- antes de promover para EXCEPTION). Loga violações em financial_audit_log.
CREATE OR REPLACE FUNCTION public.validate_store_balance_nonneg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.repasse_pendente < 0 OR NEW.comissao_pendente < 0 OR COALESCE(NEW.pending_commission,0) < 0 THEN
    -- modo observação: registra violação e força para zero, sem quebrar a operação.
    BEGIN
      INSERT INTO public.financial_audit_log (actor_type, action, entity_type, entity_id, amount, metadata)
      VALUES ('system', 'store_balance_negative_blocked', 'store_balances', NEW.store_id::text, NULL,
              jsonb_build_object(
                'severity', 'warning',
                'repasse_pendente', NEW.repasse_pendente,
                'comissao_pendente', NEW.comissao_pendente,
                'pending_commission', NEW.pending_commission,
                'old_repasse', OLD.repasse_pendente,
                'old_comissao', OLD.comissao_pendente
              ));
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'validate_store_balance_nonneg audit insert failed: %', SQLERRM;
    END;
    NEW.repasse_pendente := GREATEST(0, NEW.repasse_pendente);
    NEW.comissao_pendente := GREATEST(0, NEW.comissao_pendente);
    NEW.pending_commission := GREATEST(0, COALESCE(NEW.pending_commission, 0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_store_balance_nonneg ON public.store_balances;
CREATE TRIGGER trg_validate_store_balance_nonneg
BEFORE INSERT OR UPDATE ON public.store_balances
FOR EACH ROW EXECUTE FUNCTION public.validate_store_balance_nonneg();
