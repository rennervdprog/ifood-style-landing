
-- 1. Create security definer function to check store ownership without triggering stores RLS
CREATE OR REPLACE FUNCTION public.is_store_owner(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND owner_id = _user_id
  )
$$;

-- 2. Create security definer function to check store driver membership without triggering store_drivers RLS
CREATE OR REPLACE FUNCTION public.is_store_driver_member(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE driver_user_id = _user_id AND store_id = _store_id
  )
$$;

-- 3. Also a helper to get store IDs owned by a user
CREATE OR REPLACE FUNCTION public.get_owned_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.stores WHERE owner_id = _user_id
$$;

-- 4. Fix stores SELECT policy for store drivers (was causing recursion by querying store_drivers)
DROP POLICY IF EXISTS "Store drivers can read assigned store" ON public.stores;
CREATE POLICY "Store drivers can read assigned store"
ON public.stores FOR SELECT
TO authenticated
USING (public.is_store_driver_member(auth.uid(), id));

-- 5. Fix store_drivers policies that query stores (causing recursion)
DROP POLICY IF EXISTS "Store owners can read own store drivers" ON public.store_drivers;
CREATE POLICY "Store owners can read own store drivers"
ON public.store_drivers FOR SELECT
TO authenticated
USING (public.is_store_owner(auth.uid(), store_id));

DROP POLICY IF EXISTS "Store owners can insert own store drivers" ON public.store_drivers;
CREATE POLICY "Store owners can insert own store drivers"
ON public.store_drivers FOR INSERT
TO authenticated
WITH CHECK (public.is_store_owner(auth.uid(), store_id));

DROP POLICY IF EXISTS "Store owners can delete own store drivers" ON public.store_drivers;
CREATE POLICY "Store owners can delete own store drivers"
ON public.store_drivers FOR DELETE
TO authenticated
USING (public.is_store_owner(auth.uid(), store_id));
