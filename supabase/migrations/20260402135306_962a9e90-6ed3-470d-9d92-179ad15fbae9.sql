-- Drop the insecure view
DROP VIEW IF EXISTS public.delivery_contacts;

-- Create a secure function that respects access control
CREATE OR REPLACE FUNCTION public.get_delivery_contacts(_order_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  phone text,
  whatsapp_number text,
  neighborhood text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admin can see all
  IF public.is_platform_admin(auth.uid()) THEN
    RETURN QUERY
      SELECT p.user_id, p.full_name, p.phone, p.whatsapp_number, p.neighborhood
      FROM public.profiles p;
    RETURN;
  END IF;

  -- Drivers: only contacts for their assigned orders
  IF public.is_driver(auth.uid()) THEN
    RETURN QUERY
      SELECT DISTINCT p.user_id, p.full_name, p.phone, p.whatsapp_number, p.neighborhood
      FROM public.profiles p
      WHERE p.user_id IN (
        SELECT o.client_id FROM public.orders o WHERE o.driver_id = auth.uid()
      );
    RETURN;
  END IF;

  -- Store owners: contacts for their store orders
  RETURN QUERY
    SELECT DISTINCT p.user_id, p.full_name, p.phone, p.whatsapp_number, p.neighborhood
    FROM public.profiles p
    WHERE p.user_id IN (
      SELECT o.client_id FROM public.orders o
      JOIN public.stores s ON o.store_id = s.id
      WHERE s.owner_id = auth.uid()
    );
END;
$$;