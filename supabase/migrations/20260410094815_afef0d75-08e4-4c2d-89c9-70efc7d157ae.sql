
CREATE OR REPLACE FUNCTION public.accrue_fixed_plan_split()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _platform_split numeric;
  _delivery_mode text;
  _is_physical boolean;
BEGIN
  -- Only on transition TO finalizado
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- Check if physical payment
  _is_physical := COALESCE(NEW.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  IF NOT _is_physical THEN
    RETURN NEW;
  END IF;

  -- Check delivery mode
  SELECT delivery_mode INTO _delivery_mode FROM public.stores WHERE id = NEW.store_id;
  IF _delivery_mode != 'own' THEN
    RETURN NEW;
  END IF;

  -- Get platform split (returns 0 if not fixed plan)
  _platform_split := public.get_fixed_plan_platform_split(NEW.store_id);
  IF _platform_split <= 0 THEN
    RETURN NEW;
  END IF;

  -- Accrue the split
  INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (NEW.store_id, 0, 0, _platform_split, now())
  ON CONFLICT (store_id) DO UPDATE SET
    repasse_pendente = store_balances.repasse_pendente + _platform_split,
    updated_at = now();

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_accrue_fixed_plan_split
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.accrue_fixed_plan_split();
