
-- Fix: Prevent users from updating their own role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can update their own profile but NOT the role column
-- We achieve this by using a trigger that prevents role changes
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only platform admin can change roles
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Não é permitido alterar o próprio cargo.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_change();

-- Re-create the update policy
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix: Ensure drivers table has explicit deny for INSERT/UPDATE/DELETE by non-admins
-- Currently INSERT is only done via register_as_motoboy (SECURITY DEFINER)
-- Explicit INSERT deny policy (no authenticated user should insert directly)
CREATE POLICY "No direct driver insert"
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct driver update"
ON public.drivers
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No direct driver delete"
ON public.drivers
FOR DELETE
TO authenticated
USING (false);
