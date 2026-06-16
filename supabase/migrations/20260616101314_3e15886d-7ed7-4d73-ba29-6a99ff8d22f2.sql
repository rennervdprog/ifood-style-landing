CREATE OR REPLACE FUNCTION public.enforce_store_balance_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_store_blocked_by_balance(NEW.store_id) THEN
    RAISE EXCEPTION 'STORE_BLOCKED_BALANCE: Esta loja está com repasse acumulado acima de R$ 500. O lojista precisa quitar o PIX da plataforma para voltar a receber pedidos.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;