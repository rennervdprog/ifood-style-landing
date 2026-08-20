-- Baixa atômica de comissão PDV após confirmação de pagamento.
-- A rotina é interna: webhooks e jobs usam service_role; clientes nunca a chamam diretamente.

CREATE OR REPLACE FUNCTION public.decrement_pdv_commission_pending(
  _store_id uuid,
  _amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric;
BEGIN
  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'store_id é obrigatório';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero';
  END IF;

  UPDATE public.store_plans
  SET pdv_commission_pending = GREATEST(0, COALESCE(pdv_commission_pending, 0) - _amount),
      updated_at = now()
  WHERE store_id = _store_id
    AND is_active = true
  RETURNING pdv_commission_pending INTO v_remaining;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano ativo não encontrado para a loja';
  END IF;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_pdv_commission_pending(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_pdv_commission_pending(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.decrement_pdv_commission_pending(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_pdv_commission_pending(uuid, numeric) TO service_role;
