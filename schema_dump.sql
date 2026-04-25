--
-- PostgreSQL database dump
--

\restrict W1cNMcMIxc6JvxB1CMmhlc8SHuGSiwETILzkivNSxNcgQeMykhMHPzChUIrAxLt

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: financial_transaction_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_transaction_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'failed',
    'cancelled'
);


--
-- Name: financial_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financial_transaction_type AS ENUM (
    'commission_charge',
    'store_payout',
    'driver_payout'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'aguardando_pagamento',
    'pendente',
    'preparando',
    'pronto_para_entrega',
    'em_transito',
    'entregue',
    'saiu_entrega',
    'finalizado',
    'cancelado'
);


--
-- Name: partner_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.partner_role AS ENUM (
    'cliente',
    'lojista',
    'motoboy'
);


--
-- Name: pix_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pix_type AS ENUM (
    'cpf',
    'cnpj',
    'email',
    'phone',
    'random'
);


--
-- Name: refund_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_reason AS ENUM (
    'wrong_product',
    'missing_items',
    'damaged',
    'late_delivery',
    'poor_quality',
    'other'
);


--
-- Name: refund_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_status AS ENUM (
    'pending',
    'approved',
    'processed',
    'rejected'
);


--
-- Name: refund_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_type AS ENUM (
    'full',
    'partial',
    'wallet_credit'
);


--
-- Name: store_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.store_category AS ENUM (
    'lanches',
    'pizzas',
    'adegas',
    'japonesa',
    'saudavel',
    'sobremesas',
    'cafeteria',
    'churrasco',
    'farmacias',
    'docerias',
    'restaurante',
    'esfihas'
);


--
-- Name: store_plan_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.store_plan_type AS ENUM (
    'fixed',
    'hybrid',
    'commission_only'
);


--
-- Name: store_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.store_status AS ENUM (
    'analise',
    'ativo',
    'bloqueado'
);


--
-- Name: wallet_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_transaction_type AS ENUM (
    'credit',
    'debit'
);


--
-- Name: accrue_fixed_plan_split(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accrue_fixed_plan_split() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _platform_split numeric;
  _delivery_mode text;
  _is_physical boolean;
  _is_test boolean;
BEGIN
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN
    RETURN NEW;
  END IF;
  SELECT is_test, delivery_mode INTO _is_test, _delivery_mode
  FROM public.stores WHERE id = NEW.store_id;
  IF COALESCE(_is_test, false) THEN RETURN NEW; END IF;
  _is_physical := COALESCE(NEW.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  IF NOT _is_physical THEN RETURN NEW; END IF;
  IF COALESCE(NEW.delivery_fee, 0) <= 0 THEN RETURN NEW; END IF;
  IF _delivery_mode != 'own' THEN RETURN NEW; END IF;
  _platform_split := public.get_fixed_plan_platform_split(NEW.store_id);
  IF _platform_split <= 0 THEN RETURN NEW; END IF;
  INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
  VALUES (NEW.store_id, 0, 0, _platform_split, now())
  ON CONFLICT (store_id) DO UPDATE SET
    repasse_pendente = store_balances.repasse_pendente + _platform_split,
    updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: accrue_moderator_earnings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accrue_moderator_earnings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _mod_ref RECORD;
  _mod RECORD;
  _delivery_mode TEXT;
  _commission_rate NUMERIC;
  _mod_commission_amount NUMERIC;
  _plan_type TEXT;
  _is_test boolean;
BEGIN
  IF NEW.status != 'finalizado' OR OLD.status IS NOT DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
  SELECT is_test INTO _is_test FROM public.stores WHERE id = NEW.store_id;
  IF COALESCE(_is_test, false) THEN RETURN NEW; END IF;
  SELECT mr.moderator_id INTO _mod_ref FROM public.moderator_referrals mr WHERE mr.store_id = NEW.store_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO _mod FROM public.moderators WHERE id = _mod_ref.moderator_id AND is_active = true;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT sp.plan_type INTO _plan_type FROM public.store_plans sp
  WHERE sp.store_id = NEW.store_id AND sp.is_active = true LIMIT 1;
  _plan_type := COALESCE(_plan_type, 'commission_only');
  _commission_rate := public.get_store_commission_rate(NEW.store_id);
  IF _commission_rate > 0 AND _mod.commission_split_percent > 0 THEN
    _mod_commission_amount := ROUND(NEW.subtotal * (_mod.commission_split_percent / 100.0), 2);
    IF _mod_commission_amount > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'commission_split', _mod_commission_amount);
    END IF;
  END IF;
  IF _plan_type = 'fixed' THEN
    SELECT delivery_mode INTO _delivery_mode FROM public.stores WHERE id = NEW.store_id;
    IF _delivery_mode = 'platform' AND COALESCE(NEW.delivery_fee, 0) > 0 AND _mod.delivery_split > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'delivery_split', _mod.delivery_split);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: accrue_moderator_plan_fee(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accrue_moderator_plan_fee(_store_id uuid, _monthly_fee numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _mod_ref RECORD;
  _mod RECORD;
  _amount NUMERIC;
BEGIN
  SELECT mr.moderator_id INTO _mod_ref
  FROM public.moderator_referrals mr
  WHERE mr.store_id = _store_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO _mod FROM public.moderators WHERE id = _mod_ref.moderator_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  _amount := ROUND(_monthly_fee * (_mod.plan_fee_percent / 100.0), 2);
  IF _amount > 0 THEN
    INSERT INTO public.moderator_earnings (moderator_id, store_id, earning_type, amount, period)
    VALUES (_mod_ref.moderator_id, _store_id, 'plan_fee', _amount, to_char(now(), 'YYYY-MM'));
  END IF;
END;
$$;


--
-- Name: admin_approve_partner(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_approve_partner(_profile_user_id uuid, _approved boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode aprovar parceiros.';
  END IF;

  UPDATE profiles SET is_approved = _approved WHERE user_id = _profile_user_id;

  -- If lojista, also update store status
  IF _approved THEN
    UPDATE stores SET status = 'ativo' WHERE owner_id = _profile_user_id;

    -- Auto-create closed opening hours for newly approved stores (if none exist)
    INSERT INTO opening_hours (store_id, day_of_week, is_closed_all_day, open_time, close_time)
    SELECT s.id, d.day, true, '08:00', '22:00'
    FROM stores s
    CROSS JOIN generate_series(0, 6) AS d(day)
    WHERE s.owner_id = _profile_user_id
      AND NOT EXISTS (
        SELECT 1 FROM opening_hours oh WHERE oh.store_id = s.id AND oh.day_of_week = d.day
      );
  ELSE
    UPDATE stores SET status = 'bloqueado' WHERE owner_id = _profile_user_id;
  END IF;

  -- If motoboy, activate/deactivate driver
  UPDATE drivers SET is_active = _approved WHERE user_id = _profile_user_id;
END;
$$;


--
-- Name: admin_cancel_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_cancel_order(_order_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: admin_cleanup_duplicate_withdrawals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_cleanup_duplicate_withdrawals() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode limpar duplicatas.';
  END IF;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY driver_user_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.withdrawal_requests
    WHERE status = 'solicitado'
  ), deleted AS (
    DELETE FROM public.withdrawal_requests wr
    USING ranked r
    WHERE wr.id = r.id
      AND r.rn > 1
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;


--
-- Name: admin_create_test_store(text, public.store_category); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_test_store(_name text, _category public.store_category) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _store_id uuid;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar lojas de teste.';
  END IF;

  INSERT INTO public.stores (name, category, owner_id, status, slug)
  VALUES (
    _name,
    _category,
    auth.uid(),
    'ativo',
    'test-' || lower(replace(_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 4)
  )
  RETURNING id INTO _store_id;

  -- Create default menu section
  INSERT INTO public.menu_sections (store_id, name, sort_order)
  VALUES (_store_id, 'Destaques', 0);

  -- Create default opening hours (all open)
  INSERT INTO public.opening_hours (store_id, day_of_week, is_closed_all_day, open_time, close_time)
  SELECT _store_id, d.day, false, '08:00', '23:00'
  FROM generate_series(0, 6) AS d(day);

  RETURN _store_id;
END;
$$;


--
-- Name: admin_delete_partner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_partner(_profile_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: admin_delete_store(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_store(_store_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: apply_cancellation_policy(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_cancellation_policy(_order_id uuid, _reason text DEFAULT 'Cancelado pelo cliente'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _order RECORD;
  _fee_percent NUMERIC;
  _fee_amount NUMERIC;
  _refund_amount NUMERIC;
  _is_prepaid boolean;
  _result jsonb;
  _minutes_in_status NUMERIC;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;

  -- Only the client, store owner or admin can cancel
  IF _order.client_id != auth.uid()
     AND NOT public.is_platform_admin(auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _order.store_id AND owner_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este pedido.';
  END IF;

  IF _order.status IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedidos entregues/finalizados não podem ser cancelados. Abra uma solicitação de reembolso.';
  END IF;

  IF _order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido já está cancelado.';
  END IF;

  -- Determine if payment was prepaid (PIX or wallet) vs pay-on-delivery (dinheiro/cartao)
  _is_prepaid := COALESCE(_order.payment_method, '') IN ('pix', 'wallet', 'saldo');

  -- Calculate minutes since confirmed
  _minutes_in_status := EXTRACT(EPOCH FROM (now() - COALESCE(_order.confirmed_at, _order.created_at))) / 60.0;

  -- Fee based on status with time-based override
  CASE _order.status
    WHEN 'aguardando_pagamento' THEN _fee_percent := 0;
    WHEN 'pendente' THEN _fee_percent := 0;
    WHEN 'preparando' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 20; END IF;
    WHEN 'pronto_para_entrega' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 40; END IF;
    WHEN 'saiu_entrega' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 60; END IF;
    WHEN 'em_transito' THEN
      IF _minutes_in_status >= 20 THEN _fee_percent := 0;
      ELSE _fee_percent := 60; END IF;
    ELSE _fee_percent := 0;
  END CASE;

  _fee_amount := ROUND(_order.subtotal * (_fee_percent / 100.0), 2);
  _refund_amount := GREATEST(0, _order.subtotal - _fee_amount);

  -- Cancel the order
  UPDATE public.orders SET status = 'cancelado' WHERE id = _order_id;

  -- Only credit wallet if payment was prepaid (PIX/wallet)
  -- For cash/card: client hasn't paid yet, no refund needed
  IF _is_prepaid AND _refund_amount > 0 THEN
    INSERT INTO public.user_wallet (user_id, balance, updated_at)
    VALUES (_order.client_id, _refund_amount, now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.user_wallet.balance + _refund_amount,
      updated_at = now();

    INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
    VALUES (
      _order.client_id,
      _refund_amount,
      'credit',
      'cancellation',
      _order_id,
      CASE
        WHEN _fee_percent = 0 THEN 'Reembolso total - cancelamento pedido #' || substr(_order_id::text, 1, 8)
        ELSE 'Reembolso parcial (' || (100 - _fee_percent) || '%) - cancelamento pedido #' || substr(_order_id::text, 1, 8)
      END
    );
  END IF;

  _result := jsonb_build_object(
    'cancelled', true,
    'fee_percent', _fee_percent,
    'fee_amount', _fee_amount,
    'refund_amount', CASE WHEN _is_prepaid THEN _refund_amount ELSE 0 END,
    'refund_method', CASE WHEN _is_prepaid THEN 'wallet_credit' ELSE 'none' END,
    'is_prepaid', _is_prepaid,
    'payment_method', COALESCE(_order.payment_method, 'unknown'),
    'time_override', _minutes_in_status >= 20
  );

  RETURN _result;
END;
$$;


--
-- Name: approve_plan_change(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _req record;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar mudanças de plano.';
  END IF;

  SELECT * INTO _req FROM plan_change_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  -- Update the store plan
  UPDATE store_plans SET
    plan_type = _req.requested_plan_type,
    monthly_fee = _req.requested_monthly_fee,
    commission_rate = _req.requested_commission_rate,
    updated_at = now()
  WHERE store_id = _req.store_id AND is_active = true;

  -- Mark request as approved
  UPDATE plan_change_requests SET
    status = 'approved',
    admin_notes = COALESCE(_admin_notes, admin_notes),
    processed_at = now()
  WHERE id = _request_id;
END;
$$;


--
-- Name: auto_finalize_stale_orders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_finalize_stale_orders() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _finalized_count integer := 0;
  _alert_count integer := 0;
  _store record;
BEGIN
  -- Finalize stale orders for own-delivery stores (2h+)
  WITH stale AS (
    SELECT o.id, o.store_id, o.subtotal
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status IN ('saiu_entrega', 'entregue')
      AND o.created_at < now() - interval '2 hours'
  ),
  updated AS (
    UPDATE orders
    SET status = 'finalizado', confirmed_at = now()
    FROM stale
    WHERE orders.id = stale.id
    RETURNING orders.id
  )
  SELECT count(*) INTO _finalized_count FROM updated;

  -- NOTE: Commission/split accrual is handled by triggers:
  -- - accrue_fixed_plan_split (for fixed plan own delivery)
  -- - validate_order_prices (for app_fee calculation)
  -- No manual processing needed here to avoid double-counting.

  -- Generate compliance alerts for stores with many unfinalized orders (commission plans only)
  FOR _store IN
    SELECT s.id as store_id, s.name, count(*) as unfinalized_count
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    WHERE s.delivery_mode = 'own'
      AND o.status IN ('saiu_entrega', 'entregue')
      AND o.created_at < now() - interval '1 hour'
      AND public.get_store_commission_rate(s.id) > 0
    GROUP BY s.id, s.name
    HAVING count(*) >= 10
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM compliance_alerts
      WHERE store_id = _store.store_id
        AND alert_type = 'unfinalized_orders'
        AND is_resolved = false
    ) THEN
      INSERT INTO compliance_alerts (store_id, alert_type, message)
      VALUES (
        _store.store_id,
        'unfinalized_orders',
        'Loja "' || _store.name || '" possui ' || _store.unfinalized_count || ' pedidos não finalizados. Possível evasão de comissão.'
      );
      _alert_count := _alert_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'finalized', _finalized_count,
    'alerts_created', _alert_count,
    'timestamp', now()
  );
END;
$$;


--
-- Name: award_loyalty_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_loyalty_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _config record;
  _points integer;
BEGIN
  IF NEW.status = 'finalizado' AND OLD.status IS DISTINCT FROM 'finalizado' THEN
    SELECT * INTO _config FROM public.loyalty_config
    WHERE store_id = NEW.store_id AND is_enabled = true;
    
    IF FOUND THEN
      _points := GREATEST(1, floor(NEW.subtotal * _config.points_per_real));
      
      INSERT INTO public.loyalty_points (user_id, store_id, points, total_orders, last_order_at)
      VALUES (NEW.client_id, NEW.store_id, _points, 1, now())
      ON CONFLICT (user_id, store_id) DO UPDATE SET
        points = loyalty_points.points + _points,
        total_orders = loyalty_points.total_orders + 1,
        last_order_at = now(),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: calculate_prorata_credit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_prorata_credit(_store_id uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _plan record;
  _days_in_cycle integer := 30;
  _days_used integer;
  _daily_rate numeric;
  _credit numeric;
BEGIN
  SELECT * INTO _plan FROM store_plans
  WHERE store_id = _store_id AND is_active = true LIMIT 1;

  IF NOT FOUND OR _plan.monthly_fee <= 0 THEN
    RETURN 0;
  END IF;

  -- Calculate days used since last billing or start
  _days_used := LEAST(
    EXTRACT(DAY FROM (now() - COALESCE(_plan.last_billed_at, _plan.started_at)))::integer,
    _days_in_cycle
  );

  _daily_rate := _plan.monthly_fee / _days_in_cycle;
  _credit := GREATEST(0, ROUND((_days_in_cycle - _days_used) * _daily_rate, 2));

  RETURN _credit;
END;
$$;


--
-- Name: check_device_active(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_device_active(_device_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_active_devices
    WHERE user_id = auth.uid()
      AND device_id = _device_id
  );
$$;


--
-- Name: claim_push_device(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_push_device(_fcm_token text DEFAULT NULL::text, _player_id text DEFAULT NULL::text, _device_info text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _current_user uuid := auth.uid();
begin
  if _current_user is null then
    raise exception 'Unauthorized';
  end if;

  if coalesce(nullif(_fcm_token, ''), nullif(_player_id, '')) is null then
    raise exception 'Device identifier is required';
  end if;

  if nullif(_fcm_token, '') is not null then
    delete from public.fcm_tokens
    where token = _fcm_token
      and user_id <> _current_user;

    insert into public.fcm_tokens (user_id, token, device_info, updated_at)
    values (_current_user, _fcm_token, _device_info, now())
    on conflict (user_id, token)
    do update set
      device_info = excluded.device_info,
      updated_at = now();
  end if;

  if nullif(_player_id, '') is not null then
    delete from public.onesignal_players
    where player_id = _player_id
      and user_id <> _current_user;

    insert into public.onesignal_players (user_id, player_id, device_info, updated_at)
    values (_current_user, _player_id, _device_info, now())
    on conflict (user_id, player_id)
    do update set
      device_info = excluded.device_info,
      updated_at = now();
  end if;
end;
$$;


--
-- Name: client_confirm_delivery(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.client_confirm_delivery(_order_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _order record;
  _commission numeric;
  _commission_rate numeric;
  _platform_split numeric;
  _delivery_mode text;
BEGIN
  SELECT id, client_id, status, store_id, subtotal, delivery_confirmed_by_client
  INTO _order
  FROM orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.client_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o dono deste pedido.';
  END IF;

  IF _order.delivery_confirmed_by_client THEN
    RAISE EXCEPTION 'Entrega já confirmada.';
  END IF;

  IF _order.status NOT IN ('saiu_entrega', 'entregue', 'em_transito') THEN
    RAISE EXCEPTION 'Pedido não está em status de entrega.';
  END IF;

  UPDATE orders
  SET delivery_confirmed_by_client = true,
      status = 'finalizado',
      confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = _order_id;

  _commission_rate := public.get_store_commission_rate(_order.store_id);

  IF _commission_rate > 0 THEN
    -- Commission plan: charge commission
    _commission := ROUND(_order.subtotal * (_commission_rate / 100.0), 2);

    INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
    VALUES (_order.store_id, _commission, _commission, 0, now())
    ON CONFLICT (store_id) DO UPDATE SET
      comissao_pendente = store_balances.comissao_pendente + _commission,
      pending_commission = store_balances.pending_commission + _commission,
      updated_at = now();
  ELSE
    -- Fixed plan: check if own delivery and charge platform split
    SELECT COALESCE(s.delivery_mode, 'platform') INTO _delivery_mode
    FROM stores s WHERE s.id = _order.store_id;

    IF _delivery_mode = 'own' THEN
      _platform_split := public.get_fixed_plan_platform_split(_order.store_id);
      
      IF _platform_split > 0 THEN
        INSERT INTO store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
        VALUES (_order.store_id, 0, 0, _platform_split, now())
        ON CONFLICT (store_id) DO UPDATE SET
          repasse_pendente = store_balances.repasse_pendente + _platform_split,
          updated_at = now();
      END IF;
    END IF;
  END IF;
END;
$$;


--
-- Name: confirm_order_payment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_order_payment(_order_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.orders
  SET status = 'pendente'
  WHERE id = _order_id
    AND client_id = auth.uid()
    AND status = 'aguardando_pagamento';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou não está aguardando pagamento.';
  END IF;
END;
$$;


--
-- Name: count_supporter_plans(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_supporter_plans() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::integer
  FROM public.store_plans
  WHERE plan_type = 'fixed'
    AND monthly_fee = 130
    AND is_active = true;
$$;


--
-- Name: create_store_driver_earning(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_store_driver_earning() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_store_driver boolean;
  v_fee numeric;
  v_cut numeric;
BEGIN
  -- Only fire on transition into 'entregue' or 'finalizado'
  IF NEW.status NOT IN ('entregue', 'finalizado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Driver must be a store-linked driver for this store
  SELECT EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE store_id = NEW.store_id AND driver_user_id = NEW.driver_id
  ) INTO v_is_store_driver;

  IF NOT v_is_store_driver THEN
    RETURN NEW;
  END IF;

  -- Read store's own_delivery_fee
  SELECT COALESCE(own_delivery_fee, 0) INTO v_fee
  FROM public.stores WHERE id = NEW.store_id;

  -- Read platform cut from admin_settings
  SELECT COALESCE((value->>'amount')::numeric, 2)
  INTO v_cut
  FROM public.admin_settings
  WHERE key = 'store_driver_platform_cut';

  v_cut := COALESCE(v_cut, 2);

  IF v_fee <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.store_driver_earnings (
    store_id, driver_user_id, order_id, fee_total, platform_cut, driver_amount, status
  ) VALUES (
    NEW.store_id,
    NEW.driver_id,
    NEW.id,
    v_fee,
    LEAST(v_cut, v_fee),
    GREATEST(v_fee - v_cut, 0),
    'pendente'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: driver_accept_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.driver_accept_order(_order_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _driver_city text;
  _store_city text;
  _store_id uuid;
  _is_platform_driver boolean;
  _is_store_driver boolean;
BEGIN
  -- Get order's store_id
  SELECT o.store_id INTO _store_id FROM public.orders o WHERE o.id = _order_id;
  
  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Check if user is a platform driver
  _is_platform_driver := public.is_driver(auth.uid());
  
  -- Check if user is a store driver for this store
  _is_store_driver := public.is_store_driver(auth.uid(), _store_id);

  IF NOT _is_platform_driver AND NOT _is_store_driver THEN
    RAISE EXCEPTION 'Você não é um entregador autorizado para este pedido.';
  END IF;

  -- City check only for platform drivers (store drivers are already linked to the store)
  IF _is_platform_driver AND NOT _is_store_driver THEN
    SELECT city INTO _driver_city FROM public.drivers WHERE user_id = auth.uid();
    
    SELECT COALESCE(s.address_city, 'itatinga') INTO _store_city
    FROM public.stores s WHERE s.id = _store_id;

    IF _driver_city IS DISTINCT FROM _store_city THEN
      RAISE EXCEPTION 'Este pedido é de outra cidade. Você só pode aceitar pedidos da sua cidade.';
    END IF;
  END IF;

  UPDATE public.orders
  SET driver_id = auth.uid()
  WHERE id = _order_id
    AND status = 'pronto_para_entrega'
    AND driver_id IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível aceitar este pedido. Outro entregador pode ter aceitado primeiro.';
  END IF;
END;
$$;


--
-- Name: driver_confirm_earning_received(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.driver_confirm_earning_received(_earning_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_driver uuid;
BEGIN
  SELECT driver_user_id INTO v_driver
    FROM store_driver_earnings
   WHERE id = _earning_id;

  IF v_driver IS NULL OR v_driver <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE store_driver_earnings
     SET status = 'pago',
         driver_confirmed_at = now(),
         paid_at = COALESCE(paid_at, now())
   WHERE id = _earning_id
     AND status = 'aguardando_confirmacao';
END;
$$;


--
-- Name: driver_confirm_store_return(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _order RECORD;
  _is_physical_payment boolean;
  _delivery_fee numeric;
  _commission numeric;
  _commission_rate numeric;
  _platform_split numeric;
  _is_authorized boolean;
BEGIN
  SELECT id, status, driver_id, payment_method, subtotal, delivery_fee, store_id, return_to_store_confirmed, settlement_code
  INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  IF _order.status NOT IN ('entregue', 'finalizado') THEN
    RAISE EXCEPTION 'Pedido precisa estar com status entregue ou finalizado.';
  END IF;

  IF _order.return_to_store_confirmed THEN
    RAISE EXCEPTION 'Retorno já confirmado.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _delivery_fee := COALESCE(_order.delivery_fee, 0);

  _commission_rate := public.get_store_commission_rate(_order.store_id);

  IF NOT _is_physical_payment THEN
    RAISE EXCEPTION 'Este pedido não exige acerto físico com a loja.';
  END IF;

  IF _order.settlement_code IS NOT NULL THEN
    IF _settlement_code IS NULL OR _settlement_code != _order.settlement_code THEN
      RAISE EXCEPTION 'Código de acerto inválido. Solicite o código ao lojista.';
    END IF;
  END IF;

  UPDATE public.orders
  SET return_to_store_confirmed = true,
      status = 'finalizado'
  WHERE id = _order_id;

  IF _commission_rate > 0 THEN
    _commission := ROUND(COALESCE(_order.subtotal, 0) * (_commission_rate / 100.0), 2);

    INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
    VALUES (_order.store_id, _commission, _commission, 0, now())
    ON CONFLICT (store_id) DO UPDATE
    SET comissao_pendente = public.store_balances.comissao_pendente + _commission,
        pending_commission = public.store_balances.comissao_pendente + _commission,
        updated_at = now();
  END IF;

  UPDATE public.driver_earnings
  SET status = 'pago_loja'
  WHERE order_id = _order_id
    AND driver_user_id = auth.uid()
    AND status IN ('waiting_store_settlement', 'pendente');

  UPDATE public.driver_balances
  SET paid_amount = public.driver_balances.paid_amount + _delivery_fee,
      updated_at = now()
  WHERE driver_user_id = auth.uid();
END;
$$;


--
-- Name: driver_finish_delivery(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _order RECORD;
  _is_physical_payment boolean;
  _earning_status text;
  _next_order_status public.order_status;
  _platform_split numeric;
  _is_authorized boolean;
  _is_store_drv boolean;
BEGIN
  SELECT id, delivery_pin, status, driver_id, delivery_fee, payment_method, store_id
  INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.status NOT IN ('em_transito', 'saiu_entrega') THEN
    RAISE EXCEPTION 'Este pedido não está em rota de entrega.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  _is_authorized := public.is_driver(auth.uid()) OR public.is_store_driver(auth.uid(), _order.store_id);
  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.delivery_pin IS NOT NULL AND (_pin IS NULL OR _pin != _order.delivery_pin) THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o cliente.';
  END IF;

  _is_physical_payment := COALESCE(_order.payment_method, '') IN ('dinheiro', 'cartao', 'money', 'card_delivery');
  _is_store_drv := public.is_store_driver_member(auth.uid(), _order.store_id);

  -- Store drivers always finalize directly (payment already collected on delivery)
  IF _is_store_drv THEN
    _next_order_status := 'finalizado'::public.order_status;
    _earning_status := 'pendente';
  ELSE
    _earning_status := CASE WHEN _is_physical_payment THEN 'waiting_store_settlement' ELSE 'pendente' END;
    _next_order_status := CASE WHEN _is_physical_payment THEN 'entregue'::public.order_status ELSE 'finalizado'::public.order_status END;
  END IF;

  _platform_split := public.get_fixed_plan_platform_split(_order.store_id);

  UPDATE public.orders
  SET status = _next_order_status,
      confirmed_at = now()
  WHERE id = _order_id;

  INSERT INTO public.driver_earnings (driver_user_id, order_id, amount, status)
  VALUES (auth.uid(), _order_id, COALESCE(_order.delivery_fee, 0), _earning_status);

  INSERT INTO public.driver_balances (driver_user_id, total_earned, pending_amount, paid_amount, updated_at)
  VALUES (
    auth.uid(),
    COALESCE(_order.delivery_fee, 0),
    CASE 
      WHEN _is_physical_payment AND NOT _is_store_drv THEN -_platform_split
      ELSE COALESCE(_order.delivery_fee, 0) - _platform_split
    END,
    0,
    now()
  )
  ON CONFLICT (driver_user_id) DO UPDATE SET
    total_earned = public.driver_balances.total_earned + COALESCE(_order.delivery_fee, 0),
    pending_amount = public.driver_balances.pending_amount + CASE 
      WHEN _is_physical_payment AND NOT _is_store_drv THEN -_platform_split
      ELSE COALESCE(_order.delivery_fee, 0) - _platform_split
    END,
    updated_at = now();
END;
$$;


--
-- Name: driver_validate_collection(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.driver_validate_collection(_order_id uuid, _code text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _order RECORD;
  _is_authorized boolean;
BEGIN
  SELECT id, status, driver_id, collection_code, collection_validated, store_id INTO _order
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF _order.driver_id != auth.uid() THEN
    RAISE EXCEPTION 'Você não é o entregador deste pedido.';
  END IF;

  _is_authorized := public.is_driver(auth.uid()) OR public.is_store_driver(auth.uid(), _order.store_id);
  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Você não é um entregador ativo.';
  END IF;

  IF _order.status != 'pronto_para_entrega' THEN
    RAISE EXCEPTION 'Pedido não está no status correto para validação de coleta.';
  END IF;

  IF _order.collection_code IS NULL THEN
    RAISE EXCEPTION 'Este pedido não possui código de coleta.';
  END IF;

  IF _code IS NULL OR _code != _order.collection_code THEN
    RAISE EXCEPTION 'Código inválido. Verifique com o lojista.';
  END IF;

  UPDATE public.orders 
  SET collection_validated = true, status = 'em_transito'
  WHERE id = _order_id;
END;
$$;


--
-- Name: generate_collection_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_collection_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  _delivery_mode text;
BEGIN
  IF NEW.status = 'pronto_para_entrega' AND (OLD.status IS DISTINCT FROM 'pronto_para_entrega') AND NEW.collection_code IS NULL THEN
    SELECT COALESCE(s.delivery_mode, 'platform') INTO _delivery_mode
    FROM public.stores s WHERE s.id = NEW.store_id;
    
    IF _delivery_mode = 'platform' THEN
      NEW.collection_code := lpad(floor(random() * 10000)::text, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_delivery_pin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_delivery_pin() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'pendente' AND NEW.delivery_pin IS NULL THEN
    NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_financial_reference(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_financial_reference(_prefix text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  _clean_prefix text;
BEGIN
  _clean_prefix := upper(regexp_replace(COALESCE(_prefix, 'TX'), '[^A-Za-z0-9]', '', 'g'));
  RETURN '#' || _clean_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
END;
$$;


--
-- Name: generate_settlement_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_settlement_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  _delivery_mode text;
BEGIN
  -- Only generate for cash/card payments when status changes to entregue/finalizado
  IF NEW.payment_method IN ('dinheiro', 'cartao')
     AND NEW.status IN ('entregue', 'finalizado')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.settlement_code IS NULL THEN

    -- Check if store uses own delivery - skip settlement code
    SELECT delivery_mode INTO _delivery_mode
    FROM public.stores WHERE id = NEW.store_id;

    IF _delivery_mode = 'own' THEN
      RETURN NEW;
    END IF;

    NEW.settlement_code := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_withdrawal_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_withdrawal_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.transaction_code := 'SK-' || lpad(nextval('withdrawal_code_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: get_delivery_contacts(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_delivery_contacts(_order_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(user_id uuid, full_name text, phone text, whatsapp_number text, neighborhood text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: get_fixed_plan_platform_split(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fixed_plan_platform_split(_store_id uuid) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _plan RECORD;
  _config_value jsonb;
  _platform_split numeric;
BEGIN
  -- Check if store has a fixed plan and load override
  SELECT sp.plan_type, sp.platform_delivery_split_override INTO _plan
  FROM public.store_plans sp
  WHERE sp.store_id = _store_id AND sp.is_active = true
  LIMIT 1;

  IF _plan.plan_type IS NULL OR _plan.plan_type != 'fixed' THEN
    RETURN 0;
  END IF;

  -- VIP override takes precedence (including 0)
  IF _plan.platform_delivery_split_override IS NOT NULL THEN
    RETURN _plan.platform_delivery_split_override;
  END IF;

  -- Read platform_split from admin_settings delivery_fee_config
  SELECT value INTO _config_value
  FROM public.admin_settings
  WHERE key = 'delivery_fee_config'
  LIMIT 1;

  IF _config_value IS NOT NULL AND _config_value ? 'platform_split' THEN
    _platform_split := (_config_value->>'platform_split')::numeric;
    RETURN COALESCE(_platform_split, 2);
  END IF;

  RETURN 2;
END;
$$;


--
-- Name: get_owned_store_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_owned_store_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.stores WHERE owner_id = _user_id
$$;


--
-- Name: get_page_view_stats(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_page_view_stats(_page text DEFAULT 'store_directory'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _today bigint;
  _week bigint;
  _month bigint;
  _total bigint;
  _unique_today bigint;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver estatísticas.';
  END IF;

  SELECT COUNT(*) INTO _today FROM public.page_views
    WHERE page = _page AND created_at >= date_trunc('day', now());
  SELECT COUNT(*) INTO _week FROM public.page_views
    WHERE page = _page AND created_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO _month FROM public.page_views
    WHERE page = _page AND created_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO _total FROM public.page_views WHERE page = _page;
  SELECT COUNT(DISTINCT COALESCE(visitor_hash, user_id::text)) INTO _unique_today
    FROM public.page_views
    WHERE page = _page AND created_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'today', _today,
    'unique_today', _unique_today,
    'week', _week,
    'month', _month,
    'total', _total
  );
END;
$$;


--
-- Name: get_store_commission_rate(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_store_commission_rate(_store_id uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN sp.plan_type = 'fixed' THEN 0 ELSE sp.commission_rate END
     FROM public.store_plans sp
     WHERE sp.store_id = _store_id AND sp.is_active = true
     LIMIT 1),
    COALESCE((SELECT s.commission_rate FROM public.stores s WHERE s.id = _store_id), 6)
  )
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _role public.partner_role;
  _full_name text;
  _document text;
  _vehicle text;
  _whatsapp text;
  _phone text;
  _store_name text;
  _store_category text;
  _city text;
  _cep text;
  _street text;
  _neighborhood text;
  _pix_type text;
  _pix_key text;
  _selected_plan text;
  _driver_type text;
  _new_store_id uuid;
  _supporter_count integer;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.partner_role, 'cliente');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _document := NEW.raw_user_meta_data->>'document';
  _vehicle := NEW.raw_user_meta_data->>'vehicle';
  _whatsapp := NEW.raw_user_meta_data->>'whatsapp';
  _phone := NEW.raw_user_meta_data->>'phone';
  _store_name := NEW.raw_user_meta_data->>'store_name';
  _store_category := NEW.raw_user_meta_data->>'store_category';
  _city := COALESCE(NEW.raw_user_meta_data->>'city', 'itatinga');
  _cep := NEW.raw_user_meta_data->>'cep';
  _street := NEW.raw_user_meta_data->>'street';
  _neighborhood := NEW.raw_user_meta_data->>'neighborhood';
  _pix_type := NEW.raw_user_meta_data->>'pix_type';
  _pix_key := NEW.raw_user_meta_data->>'pix_key';
  _selected_plan := NEW.raw_user_meta_data->>'selected_plan';
  _driver_type := COALESCE(NEW.raw_user_meta_data->>'driver_type', 'platform');

  IF _selected_plan = 'supporter' THEN
    SELECT COUNT(*) INTO _supporter_count
    FROM public.store_plans
    WHERE plan_type = 'fixed' AND monthly_fee = 130 AND is_active = true;
    IF _supporter_count >= 10 THEN
      _selected_plan := 'fixed';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, document, vehicle, whatsapp_number, phone, email, city, cep, street, neighborhood, pix_type, pix_key)
  VALUES (NEW.id, _full_name, _role, _document, _vehicle, _whatsapp, _phone, NEW.email, _city, _cep, _street, _neighborhood,
    CASE WHEN _pix_type IS NOT NULL THEN _pix_type::public.pix_type ELSE NULL END,
    _pix_key)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    document = COALESCE(EXCLUDED.document, profiles.document),
    vehicle = COALESCE(EXCLUDED.vehicle, profiles.vehicle),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    city = COALESCE(EXCLUDED.city, profiles.city),
    cep = COALESCE(EXCLUDED.cep, profiles.cep),
    street = COALESCE(EXCLUDED.street, profiles.street),
    neighborhood = COALESCE(EXCLUDED.neighborhood, profiles.neighborhood),
    pix_type = COALESCE(EXCLUDED.pix_type, profiles.pix_type),
    pix_key = COALESCE(EXCLUDED.pix_key, profiles.pix_key);

  IF _role = 'motoboy' AND _driver_type != 'store' THEN
    INSERT INTO public.drivers (user_id, name, is_active, city)
    VALUES (NEW.id, _full_name, false, _city)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF _role = 'lojista' AND _store_name IS NOT NULL THEN
    INSERT INTO public.stores (name, category, owner_id, status, address_city, delivery_mode, address_cep, address_street, address_neighborhood)
    VALUES (_store_name, _store_category::public.store_category, NEW.id, 'analise', _city, 'own', _cep, _street, _neighborhood)
    RETURNING id INTO _new_store_id;

    IF _new_store_id IS NOT NULL THEN
      INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
      VALUES (
        _new_store_id,
        CASE
          WHEN _selected_plan = 'supporter' THEN 'fixed'::public.store_plan_type
          WHEN _selected_plan = 'fixed' THEN 'fixed'::public.store_plan_type
          WHEN _selected_plan = 'hybrid' THEN 'hybrid'::public.store_plan_type
          ELSE 'commission_only'::public.store_plan_type
        END,
        CASE
          WHEN _selected_plan = 'supporter' THEN 130
          WHEN _selected_plan = 'fixed' THEN 180
          WHEN _selected_plan = 'hybrid' THEN 100
          ELSE 0
        END,
        CASE
          WHEN _selected_plan IN ('supporter', 'fixed') THEN 0
          WHEN _selected_plan = 'hybrid' THEN 2.5
          ELSE 6
        END,
        true,
        CASE
          WHEN _selected_plan IN ('supporter', 'fixed', 'hybrid') THEN now() + interval '7 days'
          ELSE NULL
        END
      )
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: insert_order_status_chat_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_order_status_chat_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _msg text;
  _sender uuid;
  _store_owner uuid;
BEGIN
  -- Only trigger on actual status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get store owner for sender_id
  SELECT owner_id INTO _store_owner
  FROM public.stores
  WHERE id = NEW.store_id;

  -- Determine message and sender based on new status
  CASE NEW.status
    WHEN 'pendente' THEN
      _msg := '📋 Pedido recebido pela loja';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'preparando' THEN
      _msg := '👨‍🍳 Seu pedido está sendo preparado!';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'pronto_para_entrega' THEN
      _msg := '📦 Pedido pronto! Aguardando entregador.';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'saiu_entrega' THEN
      _msg := '🛵 Saiu para entrega!';
      _sender := COALESCE(NEW.driver_id, _store_owner, NEW.client_id);
    WHEN 'em_transito' THEN
      _msg := '🛵 Entregador a caminho!';
      _sender := COALESCE(NEW.driver_id, _store_owner, NEW.client_id);
    WHEN 'entregue' THEN
      _msg := '✅ Pedido entregue!';
      _sender := COALESCE(NEW.driver_id, _store_owner, NEW.client_id);
    WHEN 'finalizado' THEN
      _msg := '🏁 Pedido finalizado. Obrigado pela preferência!';
      _sender := COALESCE(_store_owner, NEW.client_id);
    WHEN 'cancelado' THEN
      _msg := '❌ Pedido cancelado.';
      _sender := COALESCE(_store_owner, NEW.client_id);
    ELSE
      RETURN NEW;
  END CASE;

  -- Insert the system message
  INSERT INTO public.order_messages (order_id, sender_id, message)
  VALUES (NEW.id, _sender, _msg);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'insert_order_status_chat_message error: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: is_driver(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_driver(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers
    WHERE user_id = _user_id AND is_active = true
  )
$$;


--
-- Name: is_internal_account(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_internal_account(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) IN ('luan123@gmail.com', 'natalino123@gmail.com')
  )
  OR public.has_role(_user_id, 'admin'::app_role)
  OR public.has_role(_user_id, 'moderator'::app_role);
$$;


--
-- Name: is_platform_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;


--
-- Name: is_store_driver(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_store_driver(_user_id uuid, _store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE driver_user_id = _user_id
      AND store_id = _store_id
  )
$$;


--
-- Name: is_store_driver_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_store_driver_member(_user_id uuid, _store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_drivers
    WHERE driver_user_id = _user_id AND store_id = _store_id
  )
$$;


--
-- Name: is_store_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_store_owner(_user_id uuid, _store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND owner_id = _user_id
  )
$$;


--
-- Name: is_test_store(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_test_store(_store_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT is_test FROM public.stores WHERE id = _store_id), false);
$$;


--
-- Name: mark_all_store_driver_earnings_paid(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_all_store_driver_earnings_paid(_driver_user_id uuid, _store_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner FROM public.stores WHERE id = _store_id;

  IF v_owner <> auth.uid() AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.store_driver_earnings
  SET status = 'pago', paid_at = now(), paid_by = auth.uid()
  WHERE driver_user_id = _driver_user_id
    AND store_id = _store_id
    AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: mark_store_driver_earning_paid(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_store_driver_earning_paid(_earning_id uuid, _notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner uuid;
  v_store_id uuid;
BEGIN
  SELECT s.owner_id, e.store_id INTO v_owner, v_store_id
  FROM public.store_driver_earnings e
  JOIN public.stores s ON s.id = e.store_id
  WHERE e.id = _earning_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Earning not found';
  END IF;

  IF v_owner <> auth.uid() AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.store_driver_earnings
  SET status = 'pago',
      paid_at = now(),
      paid_by = auth.uid(),
      notes = COALESCE(_notes, notes)
  WHERE id = _earning_id;
END;
$$;


--
-- Name: notify_admins_new_approval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_new_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_admin_ids uuid[];
  v_role text;
  v_label text;
  v_url text;
  v_service_key text;
BEGIN
  -- Only fire for pending lojista/motoboy
  IF NEW.is_approved IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;
  IF NEW.role::text NOT IN ('lojista', 'motoboy') THEN
    RETURN NEW;
  END IF;

  v_role := NEW.role::text;
  v_label := CASE WHEN v_role = 'lojista' THEN 'lojista' ELSE 'entregador' END;

  -- Collect admin user_ids
  SELECT array_agg(user_id) INTO v_admin_ids
  FROM public.user_roles
  WHERE role = 'admin';

  IF v_admin_ids IS NULL OR array_length(v_admin_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get supabase URL and service role key from vault (fallback to settings)
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  v_url := 'https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/send-push';

  IF v_service_key IS NULL THEN
    -- Cannot call without service key; skip silently (toast still works via realtime)
    RETURN NEW;
  END IF;

  -- Fire async HTTP request via pg_net
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(v_admin_ids),
      'title', '🔔 Novo ' || v_label || ' aguardando aprovação',
      'body', COALESCE(NEW.full_name, 'Novo cadastro') || ' acabou de se cadastrar.',
      'data', jsonb_build_object('link', '/admin', 'tab', 'approvals')
    )
  );

  RETURN NEW;
END;
$$;


--
-- Name: notify_order_status_zapi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_status_zapi() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _zapi_enabled boolean;
  _client_phone text;
  _store_name text;
  _short_id text;
  _msg text;
  _to_phone text;
BEGIN
  -- Only fire on actual status change
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only for statuses we want to notify the client about
  IF NEW.status NOT IN ('preparando','pronto_para_entrega','saiu_entrega','em_transito','entregue','finalizado','cancelado') THEN
    RETURN NEW;
  END IF;

  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);
  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_order_status_zapi: missing settings';
    RETURN NEW;
  END IF;

  -- Check Z-API enabled for this store
  SELECT zapi_enabled INTO _zapi_enabled
  FROM public.store_secrets
  WHERE store_id = NEW.store_id;

  IF NOT COALESCE(_zapi_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Get client whatsapp/phone
  SELECT COALESCE(p.whatsapp_number, p.phone) INTO _client_phone
  FROM public.profiles p
  WHERE p.user_id = NEW.client_id;

  IF _client_phone IS NULL OR length(regexp_replace(_client_phone, '\D', '', 'g')) < 10 THEN
    RETURN NEW;
  END IF;

  -- Store name + short id for the message
  SELECT name INTO _store_name FROM public.stores WHERE id = NEW.store_id;
  _short_id := upper(substr(NEW.id::text, 1, 8));

  _msg := CASE NEW.status
    WHEN 'preparando' THEN '✅ ' || COALESCE(_store_name, 'Loja') || ': seu pedido #' || _short_id || ' foi aceito e está sendo preparado! 👨‍🍳'
    WHEN 'pronto_para_entrega' THEN '📦 ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' pronto! Aguardando entregador.'
    WHEN 'saiu_entrega' THEN '🛵 ' || COALESCE(_store_name, 'Loja') || ': seu pedido #' || _short_id || ' saiu para entrega!'
    WHEN 'em_transito' THEN '🛵 ' || COALESCE(_store_name, 'Loja') || ': entregador a caminho com o pedido #' || _short_id || '!'
    WHEN 'entregue' THEN '✅ ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' entregue! Bom apetite! 🍽️'
    WHEN 'finalizado' THEN '🏁 ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' finalizado. Obrigado pela preferência!'
    WHEN 'cancelado' THEN '❌ ' || COALESCE(_store_name, 'Loja') || ': pedido #' || _short_id || ' foi cancelado.'
    ELSE NULL
  END;

  IF _msg IS NULL THEN RETURN NEW; END IF;

  _to_phone := regexp_replace(_client_phone, '\D', '', 'g');

  -- Fire-and-forget call to send-zapi internal endpoint via edge function
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/zapi-send-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'store_id', NEW.store_id,
      'phone', _to_phone,
      'message', _msg
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_order_status_zapi error: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: notify_order_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_order_sync: missing supabase URL or service key settings';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/sync-to-external',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'action', 'sync_order',
      'data', jsonb_build_object(
        'order', jsonb_build_object(
          'id', NEW.id,
          'client_id', NEW.client_id,
          'store_id', NEW.store_id,
          'status', NEW.status,
          'subtotal', NEW.subtotal,
          'delivery_fee', NEW.delivery_fee,
          'total_price', NEW.total_price,
          'app_fee', NEW.app_fee,
          'payment_method', NEW.payment_method,
          'neighborhood', NEW.neighborhood,
          'address_details', NEW.address_details,
          'delivery_pin', NEW.delivery_pin,
          'collection_code', NEW.collection_code,
          'settlement_code', NEW.settlement_code,
          'driver_id', NEW.driver_id,
          'needs_change', NEW.needs_change,
          'change_for', NEW.change_for,
          'collection_validated', NEW.collection_validated,
          'return_to_store_confirmed', NEW.return_to_store_confirmed,
          'visible_to_client', NEW.visible_to_client,
          'confirmed_at', NEW.confirmed_at,
          'created_at', NEW.created_at
        )
      )
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_order_sync error: %', SQLERRM;
  RETURN NEW;
END;
$$;


--
-- Name: notify_record_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_record_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _supabase_url text;
  _service_key text;
  _table_name text;
  _record jsonb;
BEGIN
  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_record_sync: missing supabase URL or service key';
    RETURN COALESCE(NEW, OLD);
  END IF;

  _table_name := TG_TABLE_NAME;
  _record := to_jsonb(COALESCE(NEW, OLD));

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/sync-to-external',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'action', 'sync_record',
      'data', jsonb_build_object(
        'table', _table_name,
        'record', _record
      )
    )::jsonb
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_record_sync (%) error: %', _table_name, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: prevent_driver_protected_fields_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_driver_protected_fields_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Apenas o próprio motoboy pode alterar seu registro via esta policy,
  -- e só pode mudar is_online. Demais campos protegidos.
  IF auth.uid() = NEW.user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Não é permitido alterar is_active';
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'Não é permitido alterar name';
    END IF;
    IF NEW.city IS DISTINCT FROM OLD.city THEN
      RAISE EXCEPTION 'Não é permitido alterar city';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não é permitido alterar user_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_role_self_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_role_self_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio cargo.';
    END IF;
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio status de aprovação.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: process_refund(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_refund(_refund_id uuid, _approved_amount numeric, _admin_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _refund RECORD;
  _is_admin boolean;
  _is_store_owner boolean;
BEGIN
  SELECT * INTO _refund FROM public.refund_requests WHERE id = _refund_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _refund.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  _is_admin := public.is_platform_admin(auth.uid());
  _is_store_owner := EXISTS (SELECT 1 FROM public.stores WHERE id = _refund.store_id AND owner_id = auth.uid());

  IF NOT _is_admin AND NOT _is_store_owner THEN
    RAISE EXCEPTION 'Sem permissão para processar reembolsos.';
  END IF;

  IF _approved_amount <= 0 THEN
    -- Reject
    UPDATE public.refund_requests SET
      status = 'rejected',
      admin_notes = COALESCE(_admin_notes, admin_notes),
      resolved_by = auth.uid(),
      resolved_at = now()
    WHERE id = _refund_id;
    RETURN;
  END IF;

  -- Approve and credit wallet
  UPDATE public.refund_requests SET
    status = 'processed',
    approved_amount = _approved_amount,
    admin_notes = COALESCE(_admin_notes, admin_notes),
    resolved_by = auth.uid(),
    resolved_at = now()
  WHERE id = _refund_id;

  -- Upsert wallet balance
  INSERT INTO public.user_wallet (user_id, balance, updated_at)
  VALUES (_refund.requester_id, _approved_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = public.user_wallet.balance + _approved_amount,
    updated_at = now();

  -- Record transaction
  INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    _refund.requester_id,
    _approved_amount,
    'credit',
    'refund',
    _refund.order_id,
    'Reembolso do pedido #' || substr(_refund.order_id::text, 1, 8)
  );
END;
$$;


--
-- Name: record_page_view(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_page_view(_page text, _visitor_hash text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  -- Bloqueia se for admin / moderador / conta interna
  IF _uid IS NOT NULL AND public.is_internal_account(_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.page_views (page, visitor_hash, user_id)
  VALUES (_page, _visitor_hash, _uid);
END;
$$;


--
-- Name: register_as_lojista(text, text, text, public.store_category, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_as_lojista(_full_name text, _document text, _store_name text, _store_category public.store_category, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO stores (name, category, owner_id)
  VALUES (_store_name, _store_category, _user_id)
  RETURNING id INTO _store_id;

  RETURN _store_id;
END;
$$;


--
-- Name: register_as_lojista(text, text, text, public.store_category, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_as_lojista(_full_name text, _document text, _store_name text, _store_category public.store_category, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text, _selected_plan text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO stores (name, category, owner_id, delivery_mode)
  VALUES (_store_name, _store_category, _user_id, 'own')
  RETURNING id INTO _store_id;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
  VALUES (
    _store_id,
    CASE
      WHEN _selected_plan = 'fixed' THEN 'fixed'::store_plan_type
      WHEN _selected_plan = 'hybrid' THEN 'hybrid'::store_plan_type
      ELSE 'commission_only'::store_plan_type
    END,
    CASE
      WHEN _selected_plan = 'fixed' THEN 180
      WHEN _selected_plan = 'hybrid' THEN 100
      ELSE 0
    END,
    CASE
      WHEN _selected_plan = 'fixed' THEN 0
      WHEN _selected_plan = 'hybrid' THEN 2.5
      ELSE 6
    END,
    true,
    CASE
      WHEN _selected_plan IN ('fixed', 'hybrid') THEN now() + interval '7 days'
      ELSE NULL
    END
  ) ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$$;


--
-- Name: register_as_motoboy(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_as_motoboy(_full_name text, _document text, _vehicle text, _avatar_url text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  -- Check not already registered
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  -- Upsert profile
  INSERT INTO profiles (user_id, full_name, role, document, vehicle, avatar_url)
  VALUES (_user_id, _full_name, 'motoboy', _document, _vehicle, _avatar_url)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'motoboy',
    document = EXCLUDED.document,
    vehicle = EXCLUDED.vehicle,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  -- Register as driver
  INSERT INTO drivers (user_id, name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;


--
-- Name: register_as_motoboy(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_as_motoboy(_full_name text, _document text, _vehicle text, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, vehicle, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'motoboy', _document, _vehicle, _avatar_url, _whatsapp)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'motoboy',
    document = EXCLUDED.document,
    vehicle = EXCLUDED.vehicle,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number);

  INSERT INTO drivers (user_id, name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;


--
-- Name: register_device_login(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_device_login(_device_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old_device text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current device if any
  SELECT device_id INTO _old_device
  FROM public.user_active_devices
  WHERE user_id = _user_id;

  -- Upsert the new device
  INSERT INTO public.user_active_devices (user_id, device_id, last_seen_at)
  VALUES (_user_id, _device_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    device_id = EXCLUDED.device_id,
    last_seen_at = now();

  RETURN jsonb_build_object(
    'registered', true,
    'previous_device', _old_device
  );
END;
$$;


--
-- Name: reject_plan_change(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _req record;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar mudanças de plano.';
  END IF;

  SELECT * INTO _req FROM plan_change_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; END IF;

  UPDATE plan_change_requests SET
    status = 'rejected',
    admin_notes = COALESCE(_admin_notes, admin_notes),
    processed_at = now()
  WHERE id = _request_id;
END;
$$;


--
-- Name: search_motoboy_profiles(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_motoboy_profiles(_search text) RETURNS TABLE(user_id uuid, full_name text, phone text, whatsapp_number text, vehicle text, email text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _clean text;
BEGIN
  -- Only store owners can search
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas lojistas podem buscar motoboys.';
  END IF;

  _clean := lower(trim(_search));

  RETURN QUERY
    SELECT p.user_id, p.full_name, p.phone, p.whatsapp_number, p.vehicle, p.email
    FROM public.profiles p
    WHERE p.role = 'motoboy'
      AND (
        lower(p.full_name) LIKE '%' || _clean || '%'
        OR lower(COALESCE(p.email, '')) LIKE '%' || _clean || '%'
        OR replace(COALESCE(p.phone, ''), '-', '') LIKE '%' || replace(_clean, '-', '') || '%'
        OR replace(COALESCE(p.whatsapp_number, ''), '-', '') LIKE '%' || replace(_clean, '-', '') || '%'
      )
    LIMIT 10;
END;
$$;


--
-- Name: set_app_links_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_app_links_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: store_assign_order_driver(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_assign_order_driver(_order_id uuid, _driver_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _store_id uuid;
  _owner uuid;
  _status order_status;
  _current_driver uuid;
BEGIN
  SELECT o.store_id, o.status, o.driver_id INTO _store_id, _status, _current_driver
  FROM public.orders o WHERE o.id = _order_id;

  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  SELECT s.owner_id INTO _owner FROM public.stores s WHERE s.id = _store_id;
  IF _owner IS DISTINCT FROM auth.uid() AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o lojista pode designar entregadores.';
  END IF;

  IF _current_driver IS NOT NULL THEN
    RAISE EXCEPTION 'Pedido já foi aceito por um entregador.';
  END IF;

  IF _status NOT IN ('pendente','preparando','pronto_para_entrega') THEN
    RAISE EXCEPTION 'Pedido não está em estado válido para designação.';
  END IF;

  -- If targeting a driver, ensure they are linked to this store
  IF _driver_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_drivers sd
      WHERE sd.store_id = _store_id AND sd.driver_user_id = _driver_user_id
    ) THEN
      RAISE EXCEPTION 'Esse entregador não está vinculado à sua loja.';
    END IF;
  END IF;

  UPDATE public.orders
  SET assigned_driver_id = _driver_user_id
  WHERE id = _order_id;
END;
$$;


--
-- Name: store_mark_all_driver_earnings_paid(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_mark_all_driver_earnings_paid(_driver_user_id uuid, _store_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner FROM stores WHERE id = _store_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE store_driver_earnings
     SET status = 'aguardando_confirmacao',
         store_marked_paid_at = now()
   WHERE store_id = _store_id
     AND driver_user_id = _driver_user_id
     AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: store_mark_driver_earning_paid(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_mark_driver_earning_paid(_earning_id uuid, _notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_store_id uuid;
  v_owner uuid;
BEGIN
  SELECT sde.store_id, s.owner_id
    INTO v_store_id, v_owner
    FROM store_driver_earnings sde
    JOIN stores s ON s.id = sde.store_id
   WHERE sde.id = _earning_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE store_driver_earnings
     SET status = 'aguardando_confirmacao',
         store_marked_paid_at = now()
   WHERE id = _earning_id
     AND status = 'pendente';
END;
$$;


--
-- Name: sync_store_balances_legacy_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_store_balances_legacy_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.comissao_pendente := COALESCE(NEW.comissao_pendente, 0);
  NEW.repasse_pendente := COALESCE(NEW.repasse_pendente, 0);
  NEW.pending_commission := NEW.comissao_pendente;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: sync_store_categories(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_store_categories() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Ensure categories is never null
  IF NEW.categories IS NULL THEN
    NEW.categories := '{}'::store_category[];
  END IF;

  -- Always include the primary category in the array
  IF NEW.category IS NOT NULL AND NOT (NEW.category = ANY (NEW.categories)) THEN
    NEW.categories := array_prepend(NEW.category, NEW.categories);
  END IF;

  -- If primary category is not set but array has values, set primary to first
  IF NEW.category IS NULL AND array_length(NEW.categories, 1) > 0 THEN
    NEW.category := NEW.categories[1];
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: touch_financial_transactions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_financial_transactions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_store_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_store_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE stores
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM order_ratings
    WHERE store_id = NEW.store_id
  )
  WHERE id = NEW.store_id;
  RETURN NEW;
END;
$$;


--
-- Name: use_coupon(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_coupon(_coupon_id uuid, _user_id uuid, _order_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _coupon record;
BEGIN
  -- Lock the coupon row to prevent race conditions
  SELECT * INTO _coupon
  FROM public.coupons
  WHERE id = _coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado.';
  END IF;

  IF NOT _coupon.is_active THEN
    RAISE EXCEPTION 'Cupom inativo.';
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.used_count >= _coupon.max_uses THEN
    RAISE EXCEPTION 'Cupom esgotado.';
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Cupom expirado.';
  END IF;

  -- Check if user already used this coupon
  IF EXISTS (SELECT 1 FROM public.coupon_uses WHERE coupon_id = _coupon_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Você já utilizou este cupom.';
  END IF;

  -- Atomically increment used_count and insert usage record
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_id;
  INSERT INTO public.coupon_uses (coupon_id, user_id, order_id) VALUES (_coupon_id, _user_id, _order_id);

  RETURN true;
END;
$$;


--
-- Name: use_wallet_balance(uuid, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_wallet_balance(_user_id uuid, _amount numeric, _order_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _current_balance NUMERIC;
  _deducted NUMERIC;
BEGIN
  IF auth.uid() != _user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  SELECT balance INTO _current_balance
  FROM public.user_wallet
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND OR _current_balance <= 0 THEN
    RETURN 0;
  END IF;

  _deducted := LEAST(_current_balance, _amount);

  UPDATE public.user_wallet
  SET balance = balance - _deducted, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    _user_id,
    _deducted,
    'debit',
    'order_payment',
    _order_id,
    'Crédito usado no pedido #' || substr(_order_id::text, 1, 8)
  );

  RETURN _deducted;
END;
$$;


--
-- Name: validate_order_prices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_prices() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _commission_rate numeric;
BEGIN
  _commission_rate := public.get_store_commission_rate(NEW.store_id);

  NEW.app_fee := ROUND(COALESCE(NEW.subtotal, 0) * (_commission_rate / 100.0), 2);

  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;

  NEW.total_price := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0));

  RETURN NEW;
END;
$$;


--
-- Name: verify_order_subtotal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_order_subtotal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _real_subtotal numeric;
  _order_record record;
  _app_fee numeric;
  _commission_rate numeric;
BEGIN
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO _real_subtotal
  FROM public.order_items
  WHERE order_id = NEW.order_id;

  SELECT * INTO _order_record FROM public.orders WHERE id = NEW.order_id;

  IF _order_record IS NOT NULL AND ABS(_real_subtotal - _order_record.subtotal) > 0.01 THEN
    _commission_rate := public.get_store_commission_rate(_order_record.store_id);
    _app_fee := ROUND(_real_subtotal * (_commission_rate / 100.0), 2);

    UPDATE public.orders
    SET subtotal = _real_subtotal,
        app_fee = _app_fee,
        total_price = GREATEST(0, _real_subtotal + COALESCE(_order_record.delivery_fee, 0))
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addon_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addon_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    name text NOT NULL,
    min_select integer DEFAULT 0 NOT NULL,
    max_select integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid NOT NULL,
    price_replaces_base boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN addon_groups.price_replaces_base; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.addon_groups.price_replaces_base IS 'When true, the selected addon price REPLACES the product base price instead of being added to it. Useful for size variations (e.g. 200ml, 300ml).';


--
-- Name: addon_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addon_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    description text,
    url text NOT NULL,
    icon text DEFAULT 'Link'::text NOT NULL,
    is_external boolean DEFAULT false NOT NULL,
    is_highlight boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: archived_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archived_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_user_id uuid NOT NULL,
    full_name text,
    email text,
    document text,
    phone text,
    whatsapp_number text,
    role text,
    city text,
    neighborhood text,
    pix_key text,
    pix_type text,
    cep text,
    street text,
    address_number text,
    terms_accepted_at timestamp with time zone,
    account_created_at timestamp with time zone,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    deletion_reason text DEFAULT 'user_request'::text,
    retain_until timestamp with time zone DEFAULT (now() + '5 years'::interval) NOT NULL,
    order_count integer DEFAULT 0,
    total_spent numeric DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    image_url text,
    link_type text DEFAULT 'none'::text NOT NULL,
    link_value text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    alert_type text DEFAULT 'unfinalized_orders'::text NOT NULL,
    message text NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: coupon_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_uses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'percentage'::text NOT NULL,
    discount_value numeric DEFAULT 0 NOT NULL,
    min_order_value numeric DEFAULT 0 NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    first_order_only boolean DEFAULT false NOT NULL,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text, 'free_shipping'::text])))
);


--
-- Name: coupons_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.coupons_public WITH (security_invoker='on') AS
 SELECT id,
    code,
    discount_type,
    discount_value,
    min_order_value,
    expires_at,
    is_active,
    store_id,
    first_order_only,
    description
   FROM public.coupons
  WHERE (is_active = true);


--
-- Name: driver_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    total_earned numeric DEFAULT 0 NOT NULL,
    pending_amount numeric DEFAULT 0 NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: driver_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    order_id uuid,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision,
    speed double precision,
    heading double precision,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_online boolean DEFAULT false NOT NULL,
    city text DEFAULT 'itatinga'::text
);


--
-- Name: emergency_fund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_fund (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    transaction_type text NOT NULL,
    source text NOT NULL,
    description text,
    partner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT emergency_fund_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['deposit'::text, 'withdrawal'::text])))
);


--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fcm_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_info text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid
);


--
-- Name: financial_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    transaction_kind public.financial_transaction_type NOT NULL,
    reference_code text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    status public.financial_transaction_status DEFAULT 'pending'::public.financial_transaction_status NOT NULL,
    provider text DEFAULT 'mercado_pago'::text NOT NULL,
    mercado_pago_payment_id text,
    mercado_pago_transfer_id text,
    pix_qr_code text,
    pix_qr_code_base64 text,
    pix_copy_paste text,
    settled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_transactions_amount_nonnegative CHECK ((amount >= (0)::numeric))
);


--
-- Name: loyalty_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    points_per_real numeric DEFAULT 1 NOT NULL,
    min_points_redeem integer DEFAULT 50 NOT NULL,
    discount_per_point numeric DEFAULT 0.10 NOT NULL,
    max_discount_percent numeric DEFAULT 20 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    total_orders integer DEFAULT 0 NOT NULL,
    last_order_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: moderator_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderator_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    moderator_id uuid NOT NULL,
    store_id uuid NOT NULL,
    order_id uuid,
    earning_type text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    period text,
    is_paid boolean DEFAULT false NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT moderator_earnings_earning_type_check CHECK ((earning_type = ANY (ARRAY['plan_fee'::text, 'delivery_split'::text, 'commission_split'::text])))
);


--
-- Name: moderator_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderator_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    moderator_id uuid NOT NULL,
    store_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: moderators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text,
    phone text,
    referral_code text NOT NULL,
    plan_fee_percent numeric DEFAULT 40 NOT NULL,
    delivery_split numeric DEFAULT 1.00 NOT NULL,
    commission_split_percent numeric DEFAULT 2 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: neighborhood_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.neighborhood_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    fee numeric(10,2) DEFAULT 0 NOT NULL
);


--
-- Name: onesignal_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onesignal_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    player_id text NOT NULL,
    device_info text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: opening_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opening_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    open_time time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    close_time time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    is_closed_all_day boolean DEFAULT false NOT NULL,
    CONSTRAINT opening_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric NOT NULL,
    observations text,
    addons jsonb DEFAULT '[]'::jsonb
);


--
-- Name: order_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    store_id uuid NOT NULL,
    status public.order_status DEFAULT 'pendente'::public.order_status NOT NULL,
    subtotal numeric NOT NULL,
    delivery_fee numeric DEFAULT 0 NOT NULL,
    total_price numeric NOT NULL,
    payment_method text NOT NULL,
    neighborhood text NOT NULL,
    address_details text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    driver_id uuid,
    app_fee numeric DEFAULT 0 NOT NULL,
    delivery_pin text,
    confirmed_at timestamp with time zone,
    needs_change boolean DEFAULT false NOT NULL,
    change_for numeric DEFAULT 0,
    return_to_store_confirmed boolean DEFAULT false NOT NULL,
    collection_code text,
    collection_validated boolean DEFAULT false NOT NULL,
    visible_to_client boolean DEFAULT true NOT NULL,
    settlement_code text,
    scheduled_for timestamp with time zone,
    delivery_confirmed_by_client boolean DEFAULT false NOT NULL,
    client_lat double precision,
    client_lng double precision,
    assigned_driver_id uuid
);


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page text NOT NULL,
    visitor_hash text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partner_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    gross_amount numeric DEFAULT 0 NOT NULL,
    emergency_deduction numeric DEFAULT 0 NOT NULL,
    net_amount numeric DEFAULT 0 NOT NULL,
    payout_method text DEFAULT 'asaas_pix'::text,
    transfer_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    period_start date,
    period_end date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text])))
);


--
-- Name: payout_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    entity_name text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    payout_type text DEFAULT 'manual'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_user_id uuid NOT NULL
);


--
-- Name: pizza_borders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_borders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text DEFAULT 'Borda Tradicional'::text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    current_plan_type public.store_plan_type NOT NULL,
    current_monthly_fee numeric DEFAULT 0 NOT NULL,
    requested_plan_type public.store_plan_type NOT NULL,
    requested_monthly_fee numeric DEFAULT 0 NOT NULL,
    requested_commission_rate numeric DEFAULT 0 NOT NULL,
    prorata_credit numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: platform_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    profit_percent numeric DEFAULT 0 NOT NULL,
    emergency_fund_percent numeric DEFAULT 5 NOT NULL,
    pix_key text,
    pix_type text DEFAULT 'cpf'::text,
    is_owner boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    auto_transfer boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_partners_emergency_fund_percent_check CHECK (((emergency_fund_percent >= (0)::numeric) AND (emergency_fund_percent <= (50)::numeric))),
    CONSTRAINT platform_partners_profit_percent_check CHECK (((profit_percent >= (0)::numeric) AND (profit_percent <= (100)::numeric)))
);


--
-- Name: product_addon_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_addon_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    addon_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    image_url text,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    section_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    role public.partner_role DEFAULT 'cliente'::public.partner_role NOT NULL,
    document text,
    vehicle text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    street text,
    number text,
    complement text,
    reference_point text,
    neighborhood text,
    phone text,
    pix_key text,
    pix_type public.pix_type,
    whatsapp_number text,
    email text,
    cep text,
    has_seen_onboarding boolean DEFAULT false NOT NULL,
    city text DEFAULT 'itatinga'::text,
    cnh_number text,
    cnh_front_url text,
    cnh_back_url text,
    selfie_url text,
    terms_accepted_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: profile_contacts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_contacts WITH (security_invoker='true') AS
 SELECT user_id,
    full_name,
    phone,
    whatsapp_number,
    neighborhood,
    email
   FROM public.profiles
  WHERE (deleted_at IS NULL);


--
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    store_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    reason public.refund_reason DEFAULT 'other'::public.refund_reason NOT NULL,
    description text,
    evidence_urls text[] DEFAULT '{}'::text[],
    refund_type public.refund_type DEFAULT 'wallet_credit'::public.refund_type NOT NULL,
    requested_amount numeric DEFAULT 0 NOT NULL,
    approved_amount numeric,
    status public.refund_status DEFAULT 'pending'::public.refund_status NOT NULL,
    admin_notes text,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: saved_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text DEFAULT 'Casa'::text NOT NULL,
    street text NOT NULL,
    number text NOT NULL,
    complement text,
    neighborhood text NOT NULL,
    reference_point text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cep text
);


--
-- Name: store_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    pending_commission numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    repasse_pendente numeric DEFAULT 0 NOT NULL,
    comissao_pendente numeric DEFAULT 0 NOT NULL
);


--
-- Name: store_driver_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_driver_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    driver_user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    fee_total numeric DEFAULT 0 NOT NULL,
    platform_cut numeric DEFAULT 0 NOT NULL,
    driver_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    paid_at timestamp with time zone,
    paid_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    store_marked_paid_at timestamp with time zone,
    driver_confirmed_at timestamp with time zone,
    payment_mode text DEFAULT 'fim_do_dia'::text
);


--
-- Name: store_drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    driver_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_mode text DEFAULT 'fim_do_dia'::text NOT NULL,
    CONSTRAINT store_drivers_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['instantaneo'::text, 'fim_do_dia'::text])))
);


--
-- Name: store_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    plan_type public.store_plan_type DEFAULT 'commission_only'::public.store_plan_type NOT NULL,
    monthly_fee numeric DEFAULT 0 NOT NULL,
    commission_rate numeric DEFAULT 15 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    next_billing_date timestamp with time zone,
    last_billed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_ends_at timestamp with time zone,
    app_addon_fee numeric DEFAULT 0 NOT NULL,
    pix_operational_fee_override numeric,
    platform_delivery_split_override numeric
);


--
-- Name: COLUMN store_plans.pix_operational_fee_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_plans.pix_operational_fee_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per PIX transaction)';


--
-- Name: COLUMN store_plans.platform_delivery_split_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_plans.platform_delivery_split_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per delivery for platform)';


--
-- Name: store_plans_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.store_plans_public WITH (security_invoker='true') AS
 SELECT store_id,
    plan_type,
    is_active,
    trial_ends_at
   FROM public.store_plans;


--
-- Name: store_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_secrets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    zapi_enabled boolean DEFAULT false NOT NULL,
    zapi_instance_id text,
    zapi_token text,
    zapi_client_token text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category public.store_category NOT NULL,
    image_url text,
    is_open boolean DEFAULT true NOT NULL,
    rating numeric(2,1) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_id uuid,
    status public.store_status DEFAULT 'analise'::public.store_status NOT NULL,
    force_closed boolean DEFAULT false NOT NULL,
    slug text,
    address_street text,
    address_number text,
    address_complement text,
    address_neighborhood text,
    address_reference text,
    address_city text DEFAULT 'Itatinga'::text,
    address_state text DEFAULT 'SP'::text,
    address_cep text,
    delivery_mode text DEFAULT 'own'::text NOT NULL,
    own_delivery_fee numeric DEFAULT 0 NOT NULL,
    asaas_account_id text,
    asaas_wallet_id text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    commission_rate numeric DEFAULT 6 NOT NULL,
    app_enabled boolean DEFAULT false NOT NULL,
    app_subscribed boolean DEFAULT false NOT NULL,
    latitude double precision,
    longitude double precision,
    is_test boolean DEFAULT false NOT NULL,
    categories public.store_category[] DEFAULT '{}'::public.store_category[] NOT NULL,
    CONSTRAINT stores_delivery_mode_check CHECK ((delivery_mode = ANY (ARRAY['platform'::text, 'own'::text])))
);


--
-- Name: COLUMN stores.asaas_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stores.asaas_account_id IS 'Asaas subaccount ID for split payments';


--
-- Name: COLUMN stores.asaas_wallet_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stores.asaas_wallet_id IS 'Asaas wallet ID for receiving split payments';


--
-- Name: stores_driver_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.stores_driver_view WITH (security_invoker='true') AS
 SELECT id,
    name,
    slug,
    image_url,
    category,
    is_open,
    force_closed,
    status,
    delivery_mode,
    own_delivery_fee,
    address_cep,
    address_city,
    address_neighborhood,
    address_street,
    address_number,
    address_complement,
    address_reference,
    address_state,
    latitude,
    longitude
   FROM public.stores;


--
-- Name: stores_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.stores_public WITH (security_invoker='true') AS
 SELECT id,
    name,
    slug,
    image_url,
    category,
    categories,
    rating,
    is_open,
    force_closed,
    status,
    delivery_mode,
    own_delivery_fee,
    created_at,
    owner_id,
    address_cep,
    address_city,
    address_complement,
    address_neighborhood,
    address_number,
    address_reference,
    address_state,
    address_street,
    settings
   FROM public.stores s
  WHERE ((is_test = false) OR (is_test IS NULL));


--
-- Name: terms_acceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms_acceptance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    terms_version text DEFAULT '1.0'::text NOT NULL,
    privacy_version text DEFAULT '1.0'::text NOT NULL,
    ip_address text,
    user_agent text,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_active_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_active_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: user_wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_wallet (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    transaction_type public.wallet_transaction_type NOT NULL,
    reference_type text DEFAULT 'refund'::text NOT NULL,
    reference_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: withdrawal_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.withdrawal_code_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    amount numeric NOT NULL,
    pix_key text NOT NULL,
    pix_type text DEFAULT 'cpf'::text NOT NULL,
    status text DEFAULT 'solicitado'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    admin_notes text,
    transaction_code text
);


--
-- Name: addon_groups addon_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_groups
    ADD CONSTRAINT addon_groups_pkey PRIMARY KEY (id);


--
-- Name: addon_items addon_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_items
    ADD CONSTRAINT addon_items_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_key_key UNIQUE (key);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: app_links app_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_links
    ADD CONSTRAINT app_links_pkey PRIMARY KEY (id);


--
-- Name: archived_accounts archived_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_accounts
    ADD CONSTRAINT archived_accounts_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: compliance_alerts compliance_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_alerts
    ADD CONSTRAINT compliance_alerts_pkey PRIMARY KEY (id);


--
-- Name: coupon_uses coupon_uses_coupon_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_coupon_id_user_id_key UNIQUE (coupon_id, user_id);


--
-- Name: coupon_uses coupon_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: driver_balances driver_balances_driver_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_balances
    ADD CONSTRAINT driver_balances_driver_user_id_key UNIQUE (driver_user_id);


--
-- Name: driver_balances driver_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_balances
    ADD CONSTRAINT driver_balances_pkey PRIMARY KEY (id);


--
-- Name: driver_earnings driver_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_earnings
    ADD CONSTRAINT driver_earnings_pkey PRIMARY KEY (id);


--
-- Name: driver_locations driver_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);


--
-- Name: emergency_fund emergency_fund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_fund
    ADD CONSTRAINT emergency_fund_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: financial_transactions financial_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_pkey PRIMARY KEY (id);


--
-- Name: financial_transactions financial_transactions_reference_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_reference_code_key UNIQUE (reference_code);


--
-- Name: loyalty_config loyalty_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_pkey PRIMARY KEY (id);


--
-- Name: loyalty_config loyalty_config_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_store_id_key UNIQUE (store_id);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_user_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_user_id_store_id_key UNIQUE (user_id, store_id);


--
-- Name: loyalty_points loyalty_points_user_store_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_user_store_unique UNIQUE (user_id, store_id);


--
-- Name: menu_sections menu_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_sections
    ADD CONSTRAINT menu_sections_pkey PRIMARY KEY (id);


--
-- Name: moderator_earnings moderator_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_pkey PRIMARY KEY (id);


--
-- Name: moderator_referrals moderator_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_pkey PRIMARY KEY (id);


--
-- Name: moderator_referrals moderator_referrals_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_store_id_key UNIQUE (store_id);


--
-- Name: moderators moderators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderators
    ADD CONSTRAINT moderators_pkey PRIMARY KEY (id);


--
-- Name: moderators moderators_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderators
    ADD CONSTRAINT moderators_referral_code_key UNIQUE (referral_code);


--
-- Name: neighborhood_fees neighborhood_fees_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighborhood_fees
    ADD CONSTRAINT neighborhood_fees_name_key UNIQUE (name);


--
-- Name: neighborhood_fees neighborhood_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighborhood_fees
    ADD CONSTRAINT neighborhood_fees_pkey PRIMARY KEY (id);


--
-- Name: onesignal_players onesignal_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onesignal_players
    ADD CONSTRAINT onesignal_players_pkey PRIMARY KEY (id);


--
-- Name: onesignal_players onesignal_players_user_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onesignal_players
    ADD CONSTRAINT onesignal_players_user_id_player_id_key UNIQUE (user_id, player_id);


--
-- Name: opening_hours opening_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_pkey PRIMARY KEY (id);


--
-- Name: opening_hours opening_hours_store_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_store_id_day_of_week_key UNIQUE (store_id, day_of_week);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_messages order_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_pkey PRIMARY KEY (id);


--
-- Name: order_ratings order_ratings_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_ratings
    ADD CONSTRAINT order_ratings_order_id_key UNIQUE (order_id);


--
-- Name: order_ratings order_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_ratings
    ADD CONSTRAINT order_ratings_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: partner_payouts partner_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_pkey PRIMARY KEY (id);


--
-- Name: payout_history payout_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_history
    ADD CONSTRAINT payout_history_pkey PRIMARY KEY (id);


--
-- Name: pizza_borders pizza_borders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_borders
    ADD CONSTRAINT pizza_borders_pkey PRIMARY KEY (id);


--
-- Name: plan_change_requests plan_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_change_requests
    ADD CONSTRAINT plan_change_requests_pkey PRIMARY KEY (id);


--
-- Name: platform_partners platform_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_partners
    ADD CONSTRAINT platform_partners_pkey PRIMARY KEY (id);


--
-- Name: product_addon_groups product_addon_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_pkey PRIMARY KEY (id);


--
-- Name: product_addon_groups product_addon_groups_product_id_addon_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_product_id_addon_group_id_key UNIQUE (product_id, addon_group_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (id);


--
-- Name: saved_addresses saved_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_addresses
    ADD CONSTRAINT saved_addresses_pkey PRIMARY KEY (id);


--
-- Name: store_balances store_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_balances
    ADD CONSTRAINT store_balances_pkey PRIMARY KEY (id);


--
-- Name: store_balances store_balances_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_balances
    ADD CONSTRAINT store_balances_store_id_key UNIQUE (store_id);


--
-- Name: store_driver_earnings store_driver_earnings_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_order_id_key UNIQUE (order_id);


--
-- Name: store_driver_earnings store_driver_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_pkey PRIMARY KEY (id);


--
-- Name: store_drivers store_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_drivers
    ADD CONSTRAINT store_drivers_pkey PRIMARY KEY (id);


--
-- Name: store_drivers store_drivers_store_id_driver_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_drivers
    ADD CONSTRAINT store_drivers_store_id_driver_user_id_key UNIQUE (store_id, driver_user_id);


--
-- Name: store_plans store_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_plans
    ADD CONSTRAINT store_plans_pkey PRIMARY KEY (id);


--
-- Name: store_plans store_plans_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_plans
    ADD CONSTRAINT store_plans_store_id_key UNIQUE (store_id);


--
-- Name: store_secrets store_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_secrets
    ADD CONSTRAINT store_secrets_pkey PRIMARY KEY (id);


--
-- Name: store_secrets store_secrets_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_secrets
    ADD CONSTRAINT store_secrets_store_id_key UNIQUE (store_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: stores stores_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_slug_key UNIQUE (slug);


--
-- Name: terms_acceptance terms_acceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_acceptance
    ADD CONSTRAINT terms_acceptance_pkey PRIMARY KEY (id);


--
-- Name: user_active_devices user_active_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_devices
    ADD CONSTRAINT user_active_devices_pkey PRIMARY KEY (id);


--
-- Name: user_active_devices user_active_devices_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_devices
    ADD CONSTRAINT user_active_devices_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_wallet user_wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallet
    ADD CONSTRAINT user_wallet_pkey PRIMARY KEY (id);


--
-- Name: user_wallet user_wallet_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallet
    ADD CONSTRAINT user_wallet_user_id_key UNIQUE (user_id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_driver_locations_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_locations_driver ON public.driver_locations USING btree (driver_user_id);


--
-- Name: idx_driver_locations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_locations_order ON public.driver_locations USING btree (order_id);


--
-- Name: idx_driver_locations_unique_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_driver_locations_unique_driver ON public.driver_locations USING btree (driver_user_id);


--
-- Name: idx_driver_locations_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_locations_updated ON public.driver_locations USING btree (updated_at DESC);


--
-- Name: idx_fcm_tokens_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fcm_tokens_store_id ON public.fcm_tokens USING btree (store_id) WHERE (store_id IS NOT NULL);


--
-- Name: idx_financial_transactions_kind_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_kind_status ON public.financial_transactions USING btree (transaction_kind, status);


--
-- Name: idx_financial_transactions_mp_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_financial_transactions_mp_payment_id ON public.financial_transactions USING btree (mercado_pago_payment_id) WHERE (mercado_pago_payment_id IS NOT NULL);


--
-- Name: idx_financial_transactions_mp_transfer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_financial_transactions_mp_transfer_id ON public.financial_transactions USING btree (mercado_pago_transfer_id) WHERE (mercado_pago_transfer_id IS NOT NULL);


--
-- Name: idx_financial_transactions_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_transactions_store_id ON public.financial_transactions USING btree (store_id);


--
-- Name: idx_orders_assigned_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_assigned_driver ON public.orders USING btree (assigned_driver_id) WHERE (assigned_driver_id IS NOT NULL);


--
-- Name: idx_page_views_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_created ON public.page_views USING btree (created_at DESC);


--
-- Name: idx_page_views_page_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_page_created ON public.page_views USING btree (page, created_at DESC);


--
-- Name: idx_products_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_store_id ON public.products USING btree (store_id);


--
-- Name: idx_store_driver_earnings_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_driver_earnings_driver ON public.store_driver_earnings USING btree (driver_user_id, status);


--
-- Name: idx_store_driver_earnings_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_driver_earnings_store ON public.store_driver_earnings USING btree (store_id, status);


--
-- Name: idx_stores_categories_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_categories_gin ON public.stores USING gin (categories);


--
-- Name: idx_stores_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_category ON public.stores USING btree (category);


--
-- Name: idx_stores_is_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_is_open ON public.stores USING btree (is_open);


--
-- Name: idx_stores_is_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_is_test ON public.stores USING btree (is_test) WHERE (is_test = true);


--
-- Name: idx_stores_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_slug ON public.stores USING btree (slug);


--
-- Name: idx_terms_acceptance_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terms_acceptance_user ON public.terms_acceptance USING btree (user_id);


--
-- Name: ux_withdrawal_requests_one_active_per_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_withdrawal_requests_one_active_per_driver ON public.withdrawal_requests USING btree (driver_user_id) WHERE (status = 'solicitado'::text);


--
-- Name: ux_withdrawal_requests_transaction_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_withdrawal_requests_transaction_code ON public.withdrawal_requests USING btree (transaction_code) WHERE (transaction_code IS NOT NULL);


--
-- Name: orders award_loyalty_on_order_finalized; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER award_loyalty_on_order_finalized AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_points();


--
-- Name: order_ratings on_rating_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_rating_insert AFTER INSERT ON public.order_ratings FOR EACH ROW EXECUTE FUNCTION public.update_store_rating();


--
-- Name: profiles prevent_role_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_role_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();


--
-- Name: orders set_delivery_pin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_pin BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_delivery_pin();


--
-- Name: withdrawal_requests set_withdrawal_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_withdrawal_code BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.generate_withdrawal_code();


--
-- Name: driver_balances sync_driver_balances_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_driver_balances_to_external AFTER INSERT OR UPDATE ON public.driver_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: driver_earnings sync_driver_earnings_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_driver_earnings_to_external AFTER INSERT OR UPDATE ON public.driver_earnings FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: drivers sync_drivers_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_drivers_to_external AFTER INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: financial_transactions sync_financial_transactions_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_financial_transactions_to_external AFTER INSERT OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: order_items sync_order_items_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_order_items_to_external AFTER INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: order_messages sync_order_messages_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_order_messages_to_external AFTER INSERT OR UPDATE ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: store_balances sync_store_balances_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_store_balances_to_external AFTER INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: stores sync_store_categories_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_store_categories_trg BEFORE INSERT OR UPDATE OF category, categories ON public.stores FOR EACH ROW EXECUTE FUNCTION public.sync_store_categories();


--
-- Name: orders trg_accrue_fixed_plan_split; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_accrue_fixed_plan_split BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.accrue_fixed_plan_split();


--
-- Name: orders trg_accrue_moderator_earnings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_accrue_moderator_earnings BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.accrue_moderator_earnings();


--
-- Name: app_links trg_app_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_app_links_updated_at BEFORE UPDATE ON public.app_links FOR EACH ROW EXECUTE FUNCTION public.set_app_links_updated_at();


--
-- Name: orders trg_create_store_driver_earning; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_create_store_driver_earning AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.create_store_driver_earning();


--
-- Name: orders trg_generate_collection_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_collection_code BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_collection_code();


--
-- Name: orders trg_generate_settlement_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_settlement_code BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_settlement_code();


--
-- Name: profiles trg_notify_admins_new_approval; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_new_approval AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_approval();


--
-- Name: orders trg_notify_order_status_zapi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_order_status_zapi AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_zapi();


--
-- Name: orders trg_order_status_chat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_status_chat AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.insert_order_status_chat_message();


--
-- Name: drivers trg_prevent_driver_protected_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_driver_protected_fields BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.prevent_driver_protected_fields_update();


--
-- Name: orders trg_sync_order_to_external; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_order_to_external AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_sync();


--
-- Name: store_balances trg_sync_store_balances_legacy_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_store_balances_legacy_fields BEFORE INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.sync_store_balances_legacy_fields();


--
-- Name: financial_transactions trg_touch_financial_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


--
-- Name: orders trg_validate_order_prices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_order_prices BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_prices();


--
-- Name: order_items trg_verify_order_subtotal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_verify_order_subtotal AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.verify_order_subtotal();


--
-- Name: orders trigger_generate_collection_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_collection_code BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_collection_code();


--
-- Name: orders trigger_generate_delivery_pin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_delivery_pin BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_delivery_pin();


--
-- Name: withdrawal_requests trigger_generate_withdrawal_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_generate_withdrawal_code BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.generate_withdrawal_code();


--
-- Name: profiles trigger_prevent_role_self_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_prevent_role_self_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();


--
-- Name: addon_groups trigger_sync_addon_groups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_addon_groups AFTER INSERT OR UPDATE ON public.addon_groups FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: addon_items trigger_sync_addon_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_addon_items AFTER INSERT OR UPDATE ON public.addon_items FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: banners trigger_sync_banners; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_banners AFTER INSERT OR UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: coupons trigger_sync_coupons; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_coupons AFTER INSERT OR UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: driver_balances trigger_sync_driver_balances; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_driver_balances AFTER INSERT OR UPDATE ON public.driver_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: driver_earnings trigger_sync_driver_earnings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_driver_earnings AFTER INSERT OR UPDATE ON public.driver_earnings FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: drivers trigger_sync_drivers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_drivers AFTER INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: financial_transactions trigger_sync_financial_transactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_financial_transactions AFTER INSERT OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: menu_sections trigger_sync_menu_sections; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_menu_sections AFTER INSERT OR UPDATE ON public.menu_sections FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: neighborhood_fees trigger_sync_neighborhood_fees; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_neighborhood_fees AFTER INSERT OR UPDATE ON public.neighborhood_fees FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: opening_hours trigger_sync_opening_hours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_opening_hours AFTER INSERT OR UPDATE ON public.opening_hours FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: order_items trigger_sync_order_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_order_items AFTER INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: order_messages trigger_sync_order_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_order_messages AFTER INSERT OR UPDATE ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: orders trigger_sync_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_orders AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: product_addon_groups trigger_sync_product_addon_groups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_product_addon_groups AFTER INSERT OR UPDATE ON public.product_addon_groups FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: products trigger_sync_products; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_products AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: profiles trigger_sync_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_profiles AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: store_balances trigger_sync_store_balances; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_store_balances AFTER INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: store_balances trigger_sync_store_balances_legacy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_store_balances_legacy BEFORE INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.sync_store_balances_legacy_fields();


--
-- Name: stores trigger_sync_stores; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_stores AFTER INSERT OR UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: withdrawal_requests trigger_sync_withdrawal_requests; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_withdrawal_requests AFTER INSERT OR UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


--
-- Name: financial_transactions trigger_touch_financial_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_touch_financial_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


--
-- Name: order_ratings trigger_update_store_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_store_rating AFTER INSERT ON public.order_ratings FOR EACH ROW EXECUTE FUNCTION public.update_store_rating();


--
-- Name: moderators update_moderators_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_moderators_updated_at BEFORE UPDATE ON public.moderators FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


--
-- Name: platform_partners update_platform_partners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_partners_updated_at BEFORE UPDATE ON public.platform_partners FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


--
-- Name: store_plans update_store_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_plans_updated_at BEFORE UPDATE ON public.store_plans FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


--
-- Name: store_secrets update_store_secrets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_secrets_updated_at BEFORE UPDATE ON public.store_secrets FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


--
-- Name: addon_groups addon_groups_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_groups
    ADD CONSTRAINT addon_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: addon_items addon_items_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_items
    ADD CONSTRAINT addon_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.addon_groups(id) ON DELETE CASCADE;


--
-- Name: banners banners_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: compliance_alerts compliance_alerts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_alerts
    ADD CONSTRAINT compliance_alerts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: coupon_uses coupon_uses_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: driver_locations driver_locations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: emergency_fund emergency_fund_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_fund
    ADD CONSTRAINT emergency_fund_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.platform_partners(id);


--
-- Name: fcm_tokens fcm_tokens_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: financial_transactions financial_transactions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: loyalty_config loyalty_config_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: menu_sections menu_sections_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_sections
    ADD CONSTRAINT menu_sections_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: moderator_earnings moderator_earnings_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.moderators(id) ON DELETE CASCADE;


--
-- Name: moderator_earnings moderator_earnings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: moderator_earnings moderator_earnings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: moderator_referrals moderator_referrals_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.moderators(id) ON DELETE CASCADE;


--
-- Name: moderator_referrals moderator_referrals_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: moderators moderators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderators
    ADD CONSTRAINT moderators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: opening_hours opening_hours_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_messages order_messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: partner_payouts partner_payouts_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.platform_partners(id);


--
-- Name: pizza_borders pizza_borders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_borders
    ADD CONSTRAINT pizza_borders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: plan_change_requests plan_change_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_change_requests
    ADD CONSTRAINT plan_change_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: product_addon_groups product_addon_groups_addon_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_addon_group_id_fkey FOREIGN KEY (addon_group_id) REFERENCES public.addon_groups(id) ON DELETE CASCADE;


--
-- Name: product_addon_groups product_addon_groups_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.menu_sections(id) ON DELETE SET NULL;


--
-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refund_requests refund_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: refund_requests refund_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_driver_earnings store_driver_earnings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: store_driver_earnings store_driver_earnings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: store_drivers store_drivers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_drivers
    ADD CONSTRAINT store_drivers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: store_plans store_plans_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_plans
    ADD CONSTRAINT store_plans_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: store_secrets store_secrets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_secrets
    ADD CONSTRAINT store_secrets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: stores stores_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: terms_acceptance terms_acceptance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_acceptance
    ADD CONSTRAINT terms_acceptance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_settings Admin can delete settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can delete settings" ON public.admin_settings FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: withdrawal_requests Admin can delete withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can delete withdrawal requests" ON public.withdrawal_requests FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: archived_accounts Admin can insert archived accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can insert archived accounts" ON public.archived_accounts FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: admin_settings Admin can insert settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can insert settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: loyalty_config Admin can manage all config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage all config" ON public.loyalty_config TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: coupons Admin can manage all coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage all coupons" ON public.coupons TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: plan_change_requests Admin can manage all plan requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage all plan requests" ON public.plan_change_requests TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: store_plans Admin can manage all store plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage all store plans" ON public.store_plans TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: compliance_alerts Admin can manage compliance alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage compliance alerts" ON public.compliance_alerts TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: payout_history Admin can manage payout history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage payout history" ON public.payout_history TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: coupon_uses Admin can read all coupon uses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: driver_balances Admin can read all driver balances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all driver balances" ON public.driver_balances FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: driver_earnings Admin can read all driver earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all driver earnings" ON public.driver_earnings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: fcm_tokens Admin can read all fcm tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all fcm tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: order_ratings Admin can read all ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all ratings" ON public.order_ratings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: terms_acceptance Admin can read all terms acceptance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all terms acceptance" ON public.terms_acceptance FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: withdrawal_requests Admin can read all withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read all withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: archived_accounts Admin can read archived accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read archived accounts" ON public.archived_accounts FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: admin_settings Admin can read settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: driver_balances Admin can update driver balances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update driver balances" ON public.driver_balances FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: driver_earnings Admin can update driver earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update driver earnings" ON public.driver_earnings FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: admin_settings Admin can update settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: withdrawal_requests Admin can update withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: store_drivers Admin full access store drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access store drivers" ON public.store_drivers TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: store_driver_earnings Admin manage store driver earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage store driver earnings" ON public.store_driver_earnings TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: drivers Admins and store owners can read online drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and store owners can read online drivers" ON public.drivers FOR SELECT TO authenticated USING ((public.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))));


--
-- Name: moderator_earnings Admins can manage earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage earnings" ON public.moderator_earnings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: emergency_fund Admins can manage emergency fund; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage emergency fund" ON public.emergency_fund TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: moderators Admins can manage moderators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage moderators" ON public.moderators TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: partner_payouts Admins can manage partner payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage partner payouts" ON public.partner_payouts TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: platform_partners Admins can manage partners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage partners" ON public.platform_partners TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: moderator_referrals Admins can manage referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage referrals" ON public.moderator_referrals TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: driver_locations Admins can read all locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all locations" ON public.driver_locations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can read all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: page_views Admins can read page views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read page views" ON public.page_views FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: refund_requests Admins can update all refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: refund_requests Admins can view all refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: wallet_transactions Admins can view all wallet transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: user_wallet Admins can view all wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all wallets" ON public.user_wallet FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: app_links Anyone can read active app_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active app_links" ON public.app_links FOR SELECT USING ((is_active = true));


--
-- Name: banners Anyone can read active banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active banners" ON public.banners FOR SELECT USING ((is_active = true));


--
-- Name: addon_groups Anyone can read addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read addon groups" ON public.addon_groups FOR SELECT USING (true);


--
-- Name: addon_items Anyone can read addon items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read addon items" ON public.addon_items FOR SELECT USING (true);


--
-- Name: loyalty_config Anyone can read loyalty config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read loyalty config" ON public.loyalty_config FOR SELECT USING (true);


--
-- Name: menu_sections Anyone can read menu sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read menu sections" ON public.menu_sections FOR SELECT USING (true);


--
-- Name: neighborhood_fees Anyone can read neighborhood_fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read neighborhood_fees" ON public.neighborhood_fees FOR SELECT USING (true);


--
-- Name: opening_hours Anyone can read opening hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read opening hours" ON public.opening_hours FOR SELECT USING (true);


--
-- Name: pizza_borders Anyone can read pizza borders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read pizza borders" ON public.pizza_borders FOR SELECT USING (true);


--
-- Name: product_addon_groups Anyone can read product addon links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read product addon links" ON public.product_addon_groups FOR SELECT USING (true);


--
-- Name: products Anyone can read products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);


--
-- Name: admin_settings Anyone can read public settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read public settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['delivery_fee_config'::text, 'min_payout_amount'::text])));


--
-- Name: page_views Anyone can record page view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can record page view" ON public.page_views FOR INSERT TO authenticated, anon WITH CHECK ((((auth.uid() IS NULL) AND (user_id IS NULL)) OR ((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (user_id IS NULL)))));


--
-- Name: refund_requests Clients can create refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create refund requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = refund_requests.order_id) AND (orders.client_id = auth.uid()))))));


--
-- Name: orders Clients can hide own completed orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can hide own completed orders" ON public.orders FOR UPDATE TO authenticated USING (((client_id = auth.uid()) AND (status = ANY (ARRAY['entregue'::public.order_status, 'finalizado'::public.order_status, 'cancelado'::public.order_status])))) WITH CHECK (((client_id = auth.uid()) AND (status = ANY (ARRAY['entregue'::public.order_status, 'finalizado'::public.order_status, 'cancelado'::public.order_status]))));


--
-- Name: order_items Clients can insert own order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can insert own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.client_id = auth.uid())))));


--
-- Name: orders Clients can insert own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK ((client_id = auth.uid()));


--
-- Name: driver_locations Clients can read driver location for their orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can read driver location for their orders" ON public.driver_locations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.driver_id = driver_locations.driver_user_id) AND (o.client_id = auth.uid()) AND (o.status = ANY (ARRAY['em_transito'::public.order_status, 'saiu_entrega'::public.order_status]))))));


--
-- Name: order_items Clients can read own order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can read own order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.client_id = auth.uid())))));


--
-- Name: orders Clients can read own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can read own orders" ON public.orders FOR SELECT TO authenticated USING ((client_id = auth.uid()));


--
-- Name: orders Clients can update own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can update own orders" ON public.orders FOR UPDATE TO authenticated USING (((client_id = auth.uid()) AND (status = 'aguardando_pagamento'::public.order_status))) WITH CHECK (((client_id = auth.uid()) AND (status = 'cancelado'::public.order_status)));


--
-- Name: refund_requests Clients can view own refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can view own refund requests" ON public.refund_requests FOR SELECT TO authenticated USING ((requester_id = auth.uid()));


--
-- Name: store_driver_earnings Drivers can confirm own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can confirm own earnings" ON public.store_driver_earnings FOR UPDATE TO authenticated USING ((driver_user_id = auth.uid())) WITH CHECK ((driver_user_id = auth.uid()));


--
-- Name: withdrawal_requests Drivers can create withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can create withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK ((driver_user_id = auth.uid()));


--
-- Name: driver_locations Drivers can insert own location; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can insert own location" ON public.driver_locations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = driver_user_id));


--
-- Name: order_messages Drivers can read messages for assigned orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read messages for assigned orders" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND (o.driver_id = auth.uid())))));


--
-- Name: driver_balances Drivers can read own balance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read own balance" ON public.driver_balances FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));


--
-- Name: driver_earnings Drivers can read own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read own earnings" ON public.driver_earnings FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));


--
-- Name: driver_locations Drivers can read own location; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read own location" ON public.driver_locations FOR SELECT TO authenticated USING ((auth.uid() = driver_user_id));


--
-- Name: drivers Drivers can read own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read own record" ON public.drivers FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: store_drivers Drivers can read own store links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read own store links" ON public.store_drivers FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));


--
-- Name: withdrawal_requests Drivers can read own withdrawal requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can read own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));


--
-- Name: orders Drivers can see ready orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can see ready orders" ON public.orders FOR SELECT TO authenticated USING ((public.is_driver(auth.uid()) AND (((status = 'pronto_para_entrega'::public.order_status) AND (driver_id IS NULL) AND (store_id IN ( SELECT s.id
   FROM public.stores s
  WHERE ((COALESCE(s.address_city, 'itatinga'::text) = ( SELECT COALESCE(d.city, 'itatinga'::text) AS "coalesce"
           FROM public.drivers d
          WHERE (d.user_id = auth.uid()))) AND (COALESCE(s.delivery_mode, 'platform'::text) = 'platform'::text))))) OR (driver_id = auth.uid()))));


--
-- Name: order_messages Drivers can send messages on assigned orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can send messages on assigned orders" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND (o.driver_id = auth.uid()))))));


--
-- Name: driver_locations Drivers can update own location; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can update own location" ON public.driver_locations FOR UPDATE TO authenticated USING ((auth.uid() = driver_user_id));


--
-- Name: drivers Drivers can update own online status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can update own online status" ON public.drivers FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: store_driver_earnings Drivers see own store earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers see own store earnings" ON public.store_driver_earnings FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));


--
-- Name: moderator_earnings Moderators can view own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Moderators can view own earnings" ON public.moderator_earnings FOR SELECT TO authenticated USING ((moderator_id IN ( SELECT moderators.id
   FROM public.moderators
  WHERE (moderators.user_id = auth.uid()))));


--
-- Name: moderators Moderators can view own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Moderators can view own record" ON public.moderators FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: moderator_referrals Moderators can view own referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Moderators can view own referrals" ON public.moderator_referrals FOR SELECT TO authenticated USING ((moderator_id IN ( SELECT moderators.id
   FROM public.moderators
  WHERE (moderators.user_id = auth.uid()))));


--
-- Name: drivers No direct driver delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct driver delete" ON public.drivers FOR DELETE TO authenticated USING (false);


--
-- Name: drivers No direct driver insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct driver insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: order_messages Order participants can read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order participants can read messages" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND ((o.client_id = auth.uid()) OR (o.store_id IN ( SELECT s.id
           FROM public.stores s
          WHERE (s.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid()))))));


--
-- Name: order_messages Order participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Order participants can send messages" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND ((o.client_id = auth.uid()) OR (o.store_id IN ( SELECT s.id
           FROM public.stores s
          WHERE (s.owner_id = auth.uid())))))))));


--
-- Name: addon_groups Platform admin can delete addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete addon groups" ON public.addon_groups FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: addon_items Platform admin can delete addon items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete addon items" ON public.addon_items FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: financial_transactions Platform admin can delete financial transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete financial transactions" ON public.financial_transactions FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: menu_sections Platform admin can delete menu sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete menu sections" ON public.menu_sections FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: opening_hours Platform admin can delete opening hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete opening hours" ON public.opening_hours FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: product_addon_groups Platform admin can delete product addon links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete product addon links" ON public.product_addon_groups FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: products Platform admin can delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete products" ON public.products FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: stores Platform admin can delete stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can delete stores" ON public.stores FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: financial_transactions Platform admin can insert financial transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can insert financial transactions" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: pizza_borders Platform admin can manage all borders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can manage all borders" ON public.pizza_borders TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: app_links Platform admin can manage app_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can manage app_links" ON public.app_links TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: banners Platform admin can manage banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can manage banners" ON public.banners TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: store_balances Platform admin can read all balances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all balances" ON public.store_balances FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: drivers Platform admin can read all drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all drivers" ON public.drivers FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: financial_transactions Platform admin can read all financial transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: loyalty_points Platform admin can read all loyalty; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: order_items Platform admin can read all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: orders Platform admin can read all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: profiles Platform admin can read all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: stores Platform admin can read all stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can read all stores" ON public.stores FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));


--
-- Name: profiles Platform admin can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: store_balances Platform admin can update balances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can update balances" ON public.store_balances FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: financial_transactions Platform admin can update financial transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admin can update financial transactions" ON public.financial_transactions FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));


--
-- Name: user_roles Prevent self role assignment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Prevent self role assignment" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((user_id <> auth.uid()) AND public.is_platform_admin(auth.uid())));


--
-- Name: order_items Store drivers can read linked order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store drivers can read linked order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_items.order_id) AND (sd.driver_user_id = auth.uid())))));


--
-- Name: order_messages Store drivers can read linked order messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store drivers can read linked order messages" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_messages.order_id) AND (sd.driver_user_id = auth.uid())))));


--
-- Name: stores Store drivers can read linked stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store drivers can read linked stores" ON public.stores FOR SELECT TO authenticated USING ((id IN ( SELECT store_drivers.store_id
   FROM public.store_drivers
  WHERE (store_drivers.driver_user_id = auth.uid()))));


--
-- Name: orders Store drivers can see linked store orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store drivers can see linked store orders" ON public.orders FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id)))) AND ((driver_id = auth.uid()) OR (assigned_driver_id = auth.uid()) OR ((assigned_driver_id IS NULL) AND (driver_id IS NULL)) OR ((driver_id IS NOT NULL) AND (driver_id = auth.uid())))));


--
-- Name: order_messages Store drivers can send messages on linked orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store drivers can send messages on linked orders" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_messages.order_id) AND (sd.driver_user_id = auth.uid()))))));


--
-- Name: orders Store drivers can update linked store orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store drivers can update linked store orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id)))));


--
-- Name: store_secrets Store owner can insert own secrets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owner can insert own secrets" ON public.store_secrets FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: store_secrets Store owner can read own secrets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owner can read own secrets" ON public.store_secrets FOR SELECT TO authenticated USING (((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid())));


--
-- Name: store_secrets Store owner can update own secrets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owner can update own secrets" ON public.store_secrets FOR UPDATE TO authenticated USING (((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid())));


--
-- Name: addon_groups Store owners can delete addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete addon groups" ON public.addon_groups FOR DELETE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_items Store owners can delete addon items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete addon items" ON public.addon_items FOR DELETE TO authenticated USING ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_items Store owners can delete addon items via store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete addon items via store" ON public.addon_items FOR DELETE TO authenticated USING ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));


--
-- Name: pizza_borders Store owners can delete own borders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete own borders" ON public.pizza_borders FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: opening_hours Store owners can delete own hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete own hours" ON public.opening_hours FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: menu_sections Store owners can delete own menu sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete own menu sections" ON public.menu_sections FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: products Store owners can delete own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete own products" ON public.products FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: store_drivers Store owners can delete own store drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete own store drivers" ON public.store_drivers FOR DELETE TO authenticated USING (public.is_store_owner(auth.uid(), store_id));


--
-- Name: product_addon_groups Store owners can delete product addon links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete product addon links" ON public.product_addon_groups FOR DELETE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_groups Store owners can delete store addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can delete store addon groups" ON public.addon_groups FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: pizza_borders Store owners can insert own borders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can insert own borders" ON public.pizza_borders FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: opening_hours Store owners can insert own hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can insert own hours" ON public.opening_hours FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: products Store owners can insert own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: store_drivers Store owners can insert own store drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can insert own store drivers" ON public.store_drivers FOR INSERT TO authenticated WITH CHECK (public.is_store_owner(auth.uid(), store_id));


--
-- Name: product_addon_groups Store owners can insert product addon links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can insert product addon links" ON public.product_addon_groups FOR INSERT TO authenticated WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_groups Store owners can insert store addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can insert store addon groups" ON public.addon_groups FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: addon_groups Store owners can manage addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage addon groups" ON public.addon_groups FOR INSERT TO authenticated WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_items Store owners can manage addon items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage addon items" ON public.addon_items FOR INSERT TO authenticated WITH CHECK ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_items Store owners can manage addon items via store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage addon items via store" ON public.addon_items FOR INSERT TO authenticated WITH CHECK ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));


--
-- Name: banners Store owners can manage own banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage own banners" ON public.banners TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: loyalty_config Store owners can manage own config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage own config" ON public.loyalty_config TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: coupons Store owners can manage own coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage own coupons" ON public.coupons TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: menu_sections Store owners can manage own menu sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can manage own menu sections" ON public.menu_sections FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: driver_locations Store owners can read driver location for their orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read driver location for their orders" ON public.driver_locations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.stores s ON ((o.store_id = s.id)))
  WHERE ((o.id = driver_locations.order_id) AND (s.owner_id = auth.uid())))));


--
-- Name: profiles Store owners can read linked driver profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read linked driver profiles" ON public.profiles FOR SELECT TO authenticated USING ((user_id IN ( SELECT sd.driver_user_id
   FROM (public.store_drivers sd
     JOIN public.stores s ON ((sd.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: store_balances Store owners can read own balance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own balance" ON public.store_balances FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: compliance_alerts Store owners can read own compliance alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own compliance alerts" ON public.compliance_alerts FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: financial_transactions Store owners can read own financial transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING ((store_id IN ( SELECT s.id
   FROM public.stores s
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: store_plans Store owners can read own plan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own plan" ON public.store_plans FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: plan_change_requests Store owners can read own plan requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own plan requests" ON public.plan_change_requests FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: store_drivers Store owners can read own store drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own store drivers" ON public.store_drivers FOR SELECT TO authenticated USING (public.is_store_owner(auth.uid(), store_id));


--
-- Name: stores Store owners can read own stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read own stores" ON public.stores FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: fcm_tokens Store owners can read store fcm tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read store fcm tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: loyalty_points Store owners can read store loyalty; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read store loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: order_items Store owners can read store order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read store order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.stores s ON ((o.store_id = s.id)))
  WHERE ((o.id = order_items.order_id) AND (s.owner_id = auth.uid())))));


--
-- Name: orders Store owners can read store orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read store orders" ON public.orders FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: order_ratings Store owners can read store ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can read store ratings" ON public.order_ratings FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: plan_change_requests Store owners can request plan changes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can request plan changes" ON public.plan_change_requests FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: addon_groups Store owners can update addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update addon groups" ON public.addon_groups FOR UPDATE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid())))) WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_items Store owners can update addon items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update addon items" ON public.addon_items FOR UPDATE TO authenticated USING ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid())))) WITH CHECK ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));


--
-- Name: addon_items Store owners can update addon items via store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update addon items via store" ON public.addon_items FOR UPDATE TO authenticated USING ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid())))))) WITH CHECK ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));


--
-- Name: pizza_borders Store owners can update own borders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update own borders" ON public.pizza_borders FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: opening_hours Store owners can update own hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update own hours" ON public.opening_hours FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: menu_sections Store owners can update own menu sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update own menu sections" ON public.menu_sections FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: products Store owners can update own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update own products" ON public.products FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: stores Store owners can update own store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update own store" ON public.stores FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: refund_requests Store owners can update refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.stores
  WHERE ((stores.id = refund_requests.store_id) AND (stores.owner_id = auth.uid())))));


--
-- Name: addon_groups Store owners can update store addon groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update store addon groups" ON public.addon_groups FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: orders Store owners can update store orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can update store orders" ON public.orders FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: refund_requests Store owners can view store refund requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners can view store refund requests" ON public.refund_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.stores
  WHERE ((stores.id = refund_requests.store_id) AND (stores.owner_id = auth.uid())))));


--
-- Name: store_driver_earnings Store owners see store driver earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners see store driver earnings" ON public.store_driver_earnings FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: store_driver_earnings Store owners update store driver earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store owners update store driver earnings" ON public.store_driver_earnings FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));


--
-- Name: user_active_devices Users can delete own device; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own device" ON public.user_active_devices FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: onesignal_players Users can delete own players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own players" ON public.onesignal_players FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: fcm_tokens Users can delete own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own tokens" ON public.fcm_tokens FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: coupon_uses Users can insert own coupon uses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own coupon uses" ON public.coupon_uses FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_active_devices Users can insert own device; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own device" ON public.user_active_devices FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: onesignal_players Users can insert own players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own players" ON public.onesignal_players FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: order_ratings Users can insert own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own ratings" ON public.order_ratings FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: terms_acceptance Users can insert own terms acceptance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own terms acceptance" ON public.terms_acceptance FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: fcm_tokens Users can insert own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own tokens" ON public.fcm_tokens FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: saved_addresses Users can manage own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own addresses" ON public.saved_addresses TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: coupon_uses Users can read own coupon uses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_active_devices Users can read own device; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own device" ON public.user_active_devices FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: loyalty_points Users can read own loyalty; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: onesignal_players Users can read own players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own players" ON public.onesignal_players FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: order_ratings Users can read own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own ratings" ON public.order_ratings FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_roles Users can read own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: terms_acceptance Users can read own terms acceptance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own terms acceptance" ON public.terms_acceptance FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: fcm_tokens Users can read own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_active_devices Users can update own device; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own device" ON public.user_active_devices FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: onesignal_players Users can update own players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own players" ON public.onesignal_players FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: fcm_tokens Users can update own tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own tokens" ON public.fcm_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_wallet Users can view own wallet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own wallet" ON public.user_wallet FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: wallet_transactions Users can view own wallet transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: addon_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: addon_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_links ENABLE ROW LEVEL SECURITY;

--
-- Name: archived_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.archived_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_uses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: emergency_fund; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.emergency_fund ENABLE ROW LEVEL SECURITY;

--
-- Name: fcm_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: moderator_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderator_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: moderator_referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderator_referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: moderators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

--
-- Name: neighborhood_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.neighborhood_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: onesignal_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;

--
-- Name: opening_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: order_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: payout_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payout_history ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_borders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_borders ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_partners ENABLE ROW LEVEL SECURITY;

--
-- Name: product_addon_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: refund_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: store_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: store_driver_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_driver_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: store_drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: store_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: store_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: terms_acceptance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;

--
-- Name: user_active_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_active_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict W1cNMcMIxc6JvxB1CMmhlc8SHuGSiwETILzkivNSxNcgQeMykhMHPzChUIrAxLt

