DROP POLICY IF EXISTS "Store owners can read own stores" ON public.stores;
NOTIFY pgrst, 'reload schema';