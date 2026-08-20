-- Segurança: remove exposição pública indevida sem alterar dados operacionais.
-- Escopo: privilégios de RPC, validação de identidade e escrita na view de motoboys.

-- A view é utilizada pelo aplicativo somente para leitura do motoboy vinculado.
-- Remover escrita evita alteração indireta de stores por uma view SECURITY DEFINER.
REVOKE ALL PRIVILEGES ON TABLE public.stores_driver_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stores_driver_view TO authenticated;

-- O contexto de roteamento só pode ser consultado pelo próprio usuário autenticado,
-- exceto por administrador da plataforma.
CREATE OR REPLACE FUNCTION public.get_user_routing_context(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester uuid := auth.uid();
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário obrigatório.';
  END IF;

  IF _user_id <> v_requester AND NOT public.is_platform_admin(v_requester) THEN
    RAISE EXCEPTION 'Sem permissão para consultar este contexto.';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'adminRow', (SELECT jsonb_build_object('role', role)
                   FROM public.user_roles
                   WHERE user_id = _user_id AND role = 'admin'
                   LIMIT 1),
      'profile', (SELECT to_jsonb(p)
                  FROM (SELECT role, is_approved, network_id, unit_store_id
                        FROM public.profiles
                        WHERE user_id = _user_id
                        LIMIT 1) p),
      'ownedStore', (SELECT jsonb_build_object('id', id, 'slug', slug)
                     FROM public.stores
                     WHERE owner_id = _user_id
                     LIMIT 1),
      'matrizNetwork', (SELECT jsonb_build_object('id', id, 'is_approved', is_approved)
                        FROM public.store_networks
                        WHERE owner_id = _user_id
                        LIMIT 1),
      'driver', (SELECT jsonb_build_object('user_id', user_id, 'is_active', is_active)
                 FROM public.drivers
                 WHERE user_id = _user_id
                 LIMIT 1),
      'storeDriver', (SELECT jsonb_build_object('id', id)
                      FROM public.store_drivers
                      WHERE driver_user_id = _user_id
                      LIMIT 1),
      'reseller', (SELECT jsonb_build_object('id', id)
                   FROM public.resellers
                   WHERE user_id = _user_id
                   LIMIT 1),
      'storePlanType', (SELECT sp.plan_type
                        FROM public.store_plans sp
                        JOIN public.stores s ON s.id = sp.store_id
                        WHERE s.owner_id = _user_id
                          AND sp.is_active = true
                        LIMIT 1)
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_routing_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_routing_context(uuid) TO authenticated, service_role;

-- A relação de lojas próprias não pode ser enumerada sem sessão.
CREATE OR REPLACE FUNCTION public.get_owned_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester uuid := auth.uid();
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário obrigatório.';
  END IF;

  IF _user_id <> v_requester AND NOT public.is_platform_admin(v_requester) THEN
    RAISE EXCEPTION 'Sem permissão para consultar lojas deste usuário.';
  END IF;

  RETURN QUERY
  SELECT s.id
  FROM public.stores s
  WHERE s.owner_id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_owned_store_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owned_store_ids(uuid) TO authenticated, service_role;

-- A vinculação de revendedor só pode ser realizada pelo dono da loja recém-cadastrada
-- ou por administrador. Mantém a operação idempotente.
CREATE OR REPLACE FUNCTION public.reseller_attach_signup(_store_id uuid, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_reseller uuid;
  v_store_owner uuid;
  v_requester uuid := auth.uid();
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  v_code := upper(regexp_replace(coalesce(_code, ''), '[^A-Z0-9]', '', 'g'));
  IF v_code = '' THEN
    RETURN false;
  END IF;

  SELECT id
    INTO v_reseller
  FROM public.resellers
  WHERE code = v_code
    AND status = 'approved';

  IF v_reseller IS NULL THEN
    RETURN false;
  END IF;

  SELECT owner_id
    INTO v_store_owner
  FROM public.stores
  WHERE id = _store_id;

  IF v_store_owner IS NULL THEN
    RETURN false;
  END IF;

  IF v_store_owner <> v_requester AND NOT public.is_platform_admin(v_requester) THEN
    RAISE EXCEPTION 'Sem permissão para vincular revendedor a esta loja.';
  END IF;

  -- Proteção contra autoindicação.
  IF EXISTS (
    SELECT 1
    FROM public.resellers
    WHERE id = v_reseller
      AND user_id = v_store_owner
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.stores
  SET referred_by_reseller_id = v_reseller,
      reseller_locked_at = now()
  WHERE id = _store_id
    AND referred_by_reseller_id IS NULL;

  INSERT INTO public.reseller_referrals (reseller_id, store_id, source, status)
  VALUES (v_reseller, _store_id, 'link', 'pending')
  ON CONFLICT (store_id) DO NOTHING;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reseller_attach_signup(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_attach_signup(uuid, text) TO authenticated, service_role;

-- O débito de retornáveis continua disponível para o motoboy do pedido, dono da loja
-- ou administrador, no mesmo modelo de autorização de register_empties_return.
CREATE OR REPLACE FUNCTION public.apply_order_empties_debit(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order record;
  _exchange jsonb;
  _line jsonb;
  _gid uuid;
  _qty int;
  _balance int;
BEGIN
  SELECT id, client_id, store_id, driver_id, metadata
    INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1
       FROM public.stores s
       WHERE s.id = _order.store_id
         AND s.owner_id = auth.uid()
     )
     AND NOT public.is_platform_admin(auth.uid())
  THEN
    RAISE EXCEPTION 'Sem permissão para aplicar débito de retornáveis.';
  END IF;

  _exchange := coalesce(_order.metadata -> 'empties_exchange', '[]'::jsonb);
  IF jsonb_array_length(_exchange) = 0 THEN
    RETURN;
  END IF;

  -- Idempotente: evita qualquer débito duplicado no mesmo pedido.
  IF EXISTS (
    SELECT 1
    FROM public.empties_movements
    WHERE order_id = _order_id
      AND kind = 'charged'
  ) THEN
    RETURN;
  END IF;

  FOR _line IN SELECT * FROM jsonb_array_elements(_exchange)
  LOOP
    _gid := (_line ->> 'returnable_group_id')::uuid;
    _qty := coalesce((_line ->> 'qty')::int, 0);

    IF _gid IS NULL OR _qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT qty
      INTO _balance
    FROM public.customer_empties
    WHERE customer_id = _order.client_id
      AND store_id = _order.store_id
      AND returnable_group_id = _gid
    FOR UPDATE;

    _balance := coalesce(_balance, 0);
    IF _balance < _qty THEN
      _qty := _balance;
    END IF;
    IF _qty <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.customer_empties
    SET qty = qty - _qty,
        updated_at = now()
    WHERE customer_id = _order.client_id
      AND store_id = _order.store_id
      AND returnable_group_id = _gid;

    INSERT INTO public.empties_movements
      (customer_id, store_id, returnable_group_id, order_id, kind, qty, created_by)
    VALUES
      (_order.client_id, _order.store_id, _gid, _order_id, 'charged', _qty, auth.uid());
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_order_empties_debit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_empties_debit(uuid) TO authenticated, service_role;

-- Rotinas automáticas não podem ser acionadas pelo navegador. Cron e Edge Functions
-- autenticadas usam postgres ou service_role e continuam com permissão explícita.
REVOKE EXECUTE ON FUNCTION public.auto_finalize_stale_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_finalize_stale_orders() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_repasse_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_repasse_expiry() TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_scheduled_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_scheduled_orders() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_pending_pix_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_pix_orders() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_page_views() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_page_views() TO service_role;
