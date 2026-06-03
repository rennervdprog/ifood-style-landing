-- Harden user_roles: prevent self privilege escalation on UPDATE/DELETE as well
DROP POLICY IF EXISTS "Prevent self role changes" ON public.user_roles;
CREATE POLICY "Prevent self role changes"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (user_id <> auth.uid())
WITH CHECK (user_id <> auth.uid());