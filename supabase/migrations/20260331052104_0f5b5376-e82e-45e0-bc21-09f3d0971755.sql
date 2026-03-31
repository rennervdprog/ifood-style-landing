
-- Allow platform admin to delete stores
CREATE POLICY "Platform admin can delete stores"
ON public.stores FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow platform admin to delete products (for cascade cleanup)
CREATE POLICY "Platform admin can delete products"
ON public.products FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow platform admin to delete menu sections
CREATE POLICY "Platform admin can delete menu sections"
ON public.menu_sections FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow platform admin to delete opening hours
CREATE POLICY "Platform admin can delete opening hours"
ON public.opening_hours FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow platform admin to delete addon groups
CREATE POLICY "Platform admin can delete addon groups"
ON public.addon_groups FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow platform admin to delete addon items
CREATE POLICY "Platform admin can delete addon items"
ON public.addon_items FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Allow platform admin to delete product addon links
CREATE POLICY "Platform admin can delete product addon links"
ON public.product_addon_groups FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Create admin delete store function that handles orders safely
CREATE OR REPLACE FUNCTION public.admin_delete_store(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode excluir lojas.';
  END IF;

  -- Check for active orders
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE store_id = _store_id
    AND status NOT IN ('finalizado', 'entregue')
  ) THEN
    RAISE EXCEPTION 'Não é possível excluir uma loja com pedidos ativos.';
  END IF;

  -- Delete addon items linked to store's addon groups
  DELETE FROM public.addon_items WHERE group_id IN (
    SELECT id FROM public.addon_groups WHERE store_id = _store_id
  );

  -- Delete product addon group links
  DELETE FROM public.product_addon_groups WHERE product_id IN (
    SELECT id FROM public.products WHERE store_id = _store_id
  );

  -- Delete addon groups
  DELETE FROM public.addon_groups WHERE store_id = _store_id;

  -- Delete order items for finalized orders
  DELETE FROM public.order_items WHERE order_id IN (
    SELECT id FROM public.orders WHERE store_id = _store_id
  );

  -- Delete finalized orders
  DELETE FROM public.orders WHERE store_id = _store_id;

  -- Products, menu_sections, opening_hours cascade automatically
  DELETE FROM public.stores WHERE id = _store_id;
END;
$$;
