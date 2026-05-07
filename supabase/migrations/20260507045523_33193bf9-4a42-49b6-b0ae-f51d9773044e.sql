-- Add pdv_enabled to store_plans table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_plans' AND column_name = 'pdv_enabled') THEN
    ALTER TABLE public.store_plans ADD COLUMN pdv_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;