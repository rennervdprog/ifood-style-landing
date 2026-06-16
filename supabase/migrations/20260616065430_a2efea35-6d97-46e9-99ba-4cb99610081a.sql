
-- Enforcement do bloqueio de R$150 no servidor
-- Quando a loja tem repasse_pendente + comissao_pendente >= 150, novos pedidos são rejeitados.

CREATE OR REPLACE FUNCTION public.is_store_blocked_by_balance(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (COALESCE(repasse_pendente,0) + COALESCE(comissao_pendente,0)) >= 150
     FROM public.store_balances
     WHERE store_id = _store_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_store_balance_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_store_blocked_by_balance(NEW.store_id) THEN
    RAISE EXCEPTION 'STORE_BLOCKED_BALANCE: Esta loja está com repasse acumulado acima de R$ 150. O lojista precisa quitar o PIX da plataforma para voltar a receber pedidos.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_store_balance_lock ON public.orders;
CREATE TRIGGER trg_enforce_store_balance_lock
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_store_balance_lock();
