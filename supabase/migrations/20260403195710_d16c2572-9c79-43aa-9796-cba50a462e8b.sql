CREATE POLICY "Anyone can read public settings"
ON public.admin_settings
FOR SELECT
TO public
USING (key IN ('delivery_fee_config'));