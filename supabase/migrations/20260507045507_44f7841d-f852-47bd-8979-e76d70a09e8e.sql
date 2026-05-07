-- Add order_source to orders table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_source') THEN
    ALTER TABLE public.orders ADD COLUMN order_source TEXT DEFAULT 'app';
  END IF;
END $$;

-- Add pdv_commission_pending to store_plans table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_plans' AND column_name = 'pdv_commission_pending') THEN
    ALTER TABLE public.store_plans ADD COLUMN pdv_commission_pending NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add pdv_commission_rate to store_plans table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_plans' AND column_name = 'pdv_commission_rate') THEN
    ALTER TABLE public.store_plans ADD COLUMN pdv_commission_rate NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;