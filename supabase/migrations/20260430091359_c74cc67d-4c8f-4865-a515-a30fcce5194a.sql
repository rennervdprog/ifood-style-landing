-- Create an enum for the status if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.store_driver_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status column to store_drivers
ALTER TABLE public.store_drivers 
ADD COLUMN IF NOT EXISTS status public.store_driver_status DEFAULT 'pending';

-- Update RLS policies for store_drivers
-- Only the store owner should be able to insert (already handled by existing RLS or triggers, but let's ensure safety)
-- The driver should be able to update their own status

CREATE POLICY "Drivers can update their own status" 
ON public.store_drivers 
FOR UPDATE 
USING (auth.uid() = driver_user_id)
WITH CHECK (auth.uid() = driver_user_id);
