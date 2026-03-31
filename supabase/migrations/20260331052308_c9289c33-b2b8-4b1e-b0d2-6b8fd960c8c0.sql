
-- Add is_online column to drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

-- Allow drivers to update their own online status
CREATE POLICY "Drivers can update own online status"
ON public.drivers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to read online driver count
CREATE POLICY "Authenticated can read online drivers"
ON public.drivers FOR SELECT TO authenticated
USING (is_online = true);

-- Enable realtime for drivers table
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
