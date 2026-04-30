-- Enable Realtime for critical tables if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'drivers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'driver_balances') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_balances;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'driver_earnings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_earnings;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'withdrawal_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL to ensure payload completeness in UPDATE events
-- This is crucial for Realtime listeners to get the full record even on updates
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.stores REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.driver_balances REPLICA IDENTITY FULL;
ALTER TABLE public.driver_earnings REPLICA IDENTITY FULL;
ALTER TABLE public.withdrawal_requests REPLICA IDENTITY FULL;
