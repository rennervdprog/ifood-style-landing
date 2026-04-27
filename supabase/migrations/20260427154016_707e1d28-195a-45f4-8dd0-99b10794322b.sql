-- Add delivery columns to stores table if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'delivery_enabled') THEN
        ALTER TABLE public.stores ADD COLUMN delivery_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'delivery_fee') THEN
        ALTER TABLE public.stores ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'delivery_radius') THEN
        ALTER TABLE public.stores ADD COLUMN delivery_radius NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'delivery_base_km') THEN
        ALTER TABLE public.stores ADD COLUMN delivery_base_km NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'minimum_order_value') THEN
        ALTER TABLE public.stores ADD COLUMN minimum_order_value NUMERIC(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'estimated_delivery_time') THEN
        ALTER TABLE public.stores ADD COLUMN estimated_delivery_time TEXT;
    END IF;
END $$;

-- Ensure permissions are correctly set
GRANT ALL ON public.stores TO authenticated;
GRANT SELECT ON public.stores TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';