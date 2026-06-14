DROP POLICY IF EXISTS "Platform admin can read all stores" ON public.stores;
DROP POLICY IF EXISTS "Store drivers can read linked stores" ON public.stores;
DROP POLICY IF EXISTS "Store drivers can read assigned store" ON public.stores;