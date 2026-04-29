CREATE OR REPLACE FUNCTION public.check_supporter_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supporter_count INTEGER;
BEGIN
  -- Only check if the new record is for the 'supporter' plan
  IF NEW.plan_type = 'supporter' THEN
    SELECT COUNT(*)
    INTO _supporter_count
    FROM public.store_plans
    WHERE plan_type = 'supporter' AND is_active = true;

    IF _supporter_count >= 10 THEN
      RAISE EXCEPTION 'Limite de vagas do plano Apoiador atingido'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists to avoid errors on reapplying
DROP TRIGGER IF EXISTS tr_check_supporter_plan_limit ON public.store_plans;

-- Create the trigger
CREATE TRIGGER tr_check_supporter_plan_limit
BEFORE INSERT ON public.store_plans
FOR EACH ROW
EXECUTE FUNCTION public.check_supporter_plan_limit();