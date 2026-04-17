-- Simplificar a policy de update do driver para permitir alternar is_online de forma confiável
-- A policy anterior usava subqueries que podem falhar dependendo do contexto RLS

DROP POLICY IF EXISTS "Drivers can update own online status" ON public.drivers;

-- Trigger que impede alterar campos sensíveis (substitui o WITH CHECK problemático)
CREATE OR REPLACE FUNCTION public.prevent_driver_protected_fields_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas o próprio motoboy pode alterar seu registro via esta policy,
  -- e só pode mudar is_online. Demais campos protegidos.
  IF auth.uid() = NEW.user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Não é permitido alterar is_active';
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'Não é permitido alterar name';
    END IF;
    IF NEW.city IS DISTINCT FROM OLD.city THEN
      RAISE EXCEPTION 'Não é permitido alterar city';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não é permitido alterar user_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_driver_protected_fields ON public.drivers;
CREATE TRIGGER trg_prevent_driver_protected_fields
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_driver_protected_fields_update();

-- Policy simples: motoboy pode atualizar seu próprio registro (campos protegidos pelo trigger)
CREATE POLICY "Drivers can update own online status"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());