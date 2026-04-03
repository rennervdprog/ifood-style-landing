
CREATE OR REPLACE FUNCTION public.admin_delete_partner(_profile_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role text;
  _store_ids uuid[];
BEGIN
  -- Only platform admin can delete partners
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode excluir parceiros.';
  END IF;

  -- Get the partner's role
  SELECT role INTO _role FROM public.profiles WHERE user_id = _profile_user_id;
  
  IF _role IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;

  IF _role NOT IN ('lojista', 'motoboy') THEN
    RAISE EXCEPTION 'Só é possível excluir lojistas ou motoboys.';
  END IF;

  -- Check for active orders
  IF _role = 'motoboy' THEN
    IF EXISTS (
      SELECT 1 FROM public.orders 
      WHERE driver_id = _profile_user_id 
      AND status NOT IN ('finalizado', 'entregue', 'cancelado')
    ) THEN
      RAISE EXCEPTION 'Este entregador possui pedidos ativos. Finalize-os antes de excluir.';
    END IF;
  END IF;

  IF _role = 'lojista' THEN
    -- Get all store IDs for this owner
    SELECT array_agg(id) INTO _store_ids FROM public.stores WHERE owner_id = _profile_user_id;

    IF _store_ids IS NOT NULL THEN
      -- Check for active orders on any store
      IF EXISTS (
        SELECT 1 FROM public.orders 
        WHERE store_id = ANY(_store_ids) 
        AND status NOT IN ('finalizado', 'entregue', 'cancelado')
      ) THEN
        RAISE EXCEPTION 'Este lojista possui pedidos ativos em suas lojas. Finalize-os antes de excluir.';
      END IF;

      -- Delete store-related data
      DELETE FROM public.addon_items WHERE group_id IN (
        SELECT id FROM public.addon_groups WHERE store_id = ANY(_store_ids)
      );
      DELETE FROM public.product_addon_groups WHERE product_id IN (
        SELECT id FROM public.products WHERE store_id = ANY(_store_ids)
      );
      DELETE FROM public.addon_groups WHERE store_id = ANY(_store_ids);
      DELETE FROM public.order_items WHERE order_id IN (
        SELECT id FROM public.orders WHERE store_id = ANY(_store_ids)
      );
      DELETE FROM public.order_messages WHERE order_id IN (
        SELECT id FROM public.orders WHERE store_id = ANY(_store_ids)
      );
      DELETE FROM public.order_ratings WHERE store_id = ANY(_store_ids);
      DELETE FROM public.coupons WHERE store_id = ANY(_store_ids);
      DELETE FROM public.coupon_uses WHERE coupon_id IN (
        SELECT id FROM public.coupons WHERE store_id = ANY(_store_ids)
      );
      DELETE FROM public.opening_hours WHERE store_id = ANY(_store_ids);
      DELETE FROM public.menu_sections WHERE store_id = ANY(_store_ids);
      DELETE FROM public.products WHERE store_id = ANY(_store_ids);
      DELETE FROM public.financial_transactions WHERE store_id = ANY(_store_ids);
      DELETE FROM public.store_balances WHERE store_id = ANY(_store_ids);
      DELETE FROM public.orders WHERE store_id = ANY(_store_ids);
      DELETE FROM public.stores WHERE id = ANY(_store_ids);
    END IF;
  END IF;

  IF _role = 'motoboy' THEN
    -- Delete driver-related data
    DELETE FROM public.order_messages WHERE order_id IN (
      SELECT id FROM public.orders WHERE driver_id = _profile_user_id
    );
    DELETE FROM public.driver_earnings WHERE driver_user_id = _profile_user_id;
    DELETE FROM public.driver_balances WHERE driver_user_id = _profile_user_id;
    DELETE FROM public.withdrawal_requests WHERE driver_user_id = _profile_user_id;
    DELETE FROM public.payout_history WHERE entity_id = _profile_user_id::text AND entity_type = 'driver';
    -- Remove driver assignment from old orders
    UPDATE public.orders SET driver_id = NULL WHERE driver_id = _profile_user_id;
    DELETE FROM public.drivers WHERE user_id = _profile_user_id;
  END IF;

  -- Delete profile
  DELETE FROM public.profiles WHERE user_id = _profile_user_id;
END;
$$;
