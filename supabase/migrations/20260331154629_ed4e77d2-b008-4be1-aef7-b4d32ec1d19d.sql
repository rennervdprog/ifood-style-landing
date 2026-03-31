-- Allow admin to delete withdrawal requests
CREATE POLICY "Admin can delete withdrawal requests"
ON public.withdrawal_requests
FOR DELETE
TO authenticated
USING (is_platform_admin(auth.uid()));