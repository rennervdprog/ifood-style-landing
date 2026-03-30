
-- Update trigger to also prevent self-approval
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio cargo.';
    END IF;
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio status de aprovação.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
