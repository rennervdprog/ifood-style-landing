
-- Admin function to cancel/delete test orders
CREATE OR REPLACE FUNCTION public.admin_cancel_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode cancelar pedidos.';
  END IF;

  UPDATE public.orders SET status = 'cancelado' WHERE id = _order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
END;
$$;
