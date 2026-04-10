-- Update the public read policy to also allow reading min_payout_amount
DROP POLICY IF EXISTS "Anyone can read public settings" ON public.admin_settings;
CREATE POLICY "Anyone can read public settings"
ON public.admin_settings
FOR SELECT
TO public
USING (key IN ('delivery_fee_config', 'min_payout_amount'));