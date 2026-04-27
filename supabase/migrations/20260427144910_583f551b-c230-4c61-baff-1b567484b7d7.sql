-- Add delivery fee configuration columns to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS delivery_fee_type TEXT DEFAULT 'fixed' CHECK (delivery_fee_type IN ('fixed', 'km')),
ADD COLUMN IF NOT EXISTS delivery_base_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_base NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_per_km NUMERIC DEFAULT 0;

-- Update the public view if it exists (assuming it's named stores_public based on previous code view)
-- If it's a view, we might need to recreate it or just rely on the table if it's not a security view
-- Checking for existence of stores_public before trying to refresh it if it was a materialized view 
-- but in Supabase it's usually a standard view. Let's just update the table, 
-- Supabase views often auto-include new columns if they are defined as SELECT * FROM stores.
