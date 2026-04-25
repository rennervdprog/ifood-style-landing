-- Removida linha com erro de sintaxe do dump
-- PostgreSQL database dump


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

-- Name: public; Type: SCHEMA; Schema: -; Owner: -

-- CREATE SCHEMA public;


-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -

-- COMMENT ON SCHEMA public IS 'standard public schema';


-- Name: app_role; Type: TYPE; Schema: public; Owner: -

DO 1220 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); END IF; END 1220;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: financial_transaction_status; Type: TYPE; Schema: public; Owner: -

DO 1220 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_status') THEN CREATE TYPE public.financial_transaction_status AS ENUM ('pending', 'approved', 'paid', 'failed', 'cancelled'); END IF; END 1220;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_status') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_status') THEN
        CREATE TYPE public.financial_transaction_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'failed',
    'cancelled'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: financial_transaction_type; Type: TYPE; Schema: public; Owner: -

DO 1220 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_type') THEN CREATE TYPE public.financial_transaction_type AS ENUM ('commission_charge', 'store_payout', 'driver_payout'); END IF; END 1220;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_type') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_type') THEN
        CREATE TYPE public.financial_transaction_type AS ENUM (
    'commission_charge',
    'store_payout',
    'driver_payout'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: order_status; Type: TYPE; Schema: public; Owner: -

DO 1220 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN CREATE TYPE public.order_status AS ENUM ('aguardando_pagamento', 'pendente', 'preparando', 'pronto_para_entrega', 'em_transito', 'entregue', 'saiu_entrega', 'finalizado', 'cancelado'); END IF; END 1220;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
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
    END IF;
END $$;
    END IF;
END $$;


-- Name: partner_role; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_role') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_role') THEN
        CREATE TYPE public.partner_role AS ENUM (
    'cliente',
    'lojista',
    'motoboy'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: pix_type; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_type') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_type') THEN
        CREATE TYPE public.pix_type AS ENUM (
    'cpf',
    'cnpj',
    'email',
    'phone',
    'random'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: refund_reason; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_reason') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_reason') THEN
        CREATE TYPE public.refund_reason AS ENUM (
    'wrong_product',
    'missing_items',
    'damaged',
    'late_delivery',
    'poor_quality',
    'other'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: refund_status; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE public.refund_status AS ENUM (
    'pending',
    'approved',
    'processed',
    'rejected'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: refund_type; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_type') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_type') THEN
        CREATE TYPE public.refund_type AS ENUM (
    'full',
    'partial',
    'wallet_credit'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: store_category; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_category') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_category') THEN
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
    END IF;
END $$;
    END IF;
END $$;


-- Name: store_plan_type; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_plan_type') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_plan_type') THEN
        CREATE TYPE public.store_plan_type AS ENUM (
    'fixed',
    'hybrid',
    'commission_only'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: store_status; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_status') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_status') THEN
        CREATE TYPE public.store_status AS ENUM (
    'analise',
    'ativo',
    'bloqueado'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: wallet_transaction_type; Type: TYPE; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type') THEN
        DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type') THEN
        CREATE TYPE public.wallet_transaction_type AS ENUM (
    'credit',
    'debit'
);
    END IF;
END $$;
    END IF;
END $$;


-- Name: accrue_fixed_plan_split(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.accrue_fixed_plan_split() RETURNS trigger
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


-- Name: accrue_moderator_earnings(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.accrue_moderator_earnings() RETURNS trigger
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
  IF _plan_type = 'fixed' THEN
    SELECT delivery_mode INTO _delivery_mode FROM public.stores WHERE id = NEW.store_id;
    IF _delivery_mode = 'platform' AND COALESCE(NEW.delivery_fee, 0) > 0 AND _mod.delivery_split > 0 THEN
      INSERT INTO public.moderator_earnings (moderator_id, store_id, order_id, earning_type, amount)
      VALUES (_mod_ref.moderator_id, NEW.store_id, NEW.id, 'delivery_split', _mod.delivery_split);
    END IF;
  RETURN NEW;
END;
$$;


-- Name: accrue_moderator_plan_fee(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.accrue_moderator_plan_fee(_store_id uuid, _monthly_fee numeric) RETURNS void
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


-- Name: admin_approve_partner(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.admin_approve_partner(_profile_user_id uuid, _approved boolean) RETURNS void
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


-- Name: admin_cancel_order(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.admin_cancel_order(_order_id uuid) RETURNS void
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


-- Name: admin_cleanup_duplicate_withdrawals(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_withdrawals() RETURNS integer
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


-- Name: admin_create_test_store(text, public.store_category); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.admin_create_test_store(_name text, _category public.store_category) RETURNS uuid
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


-- Name: admin_delete_partner(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.admin_delete_partner(_profile_user_id uuid) RETURNS void
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


-- Name: admin_delete_store(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.admin_delete_store(_store_id uuid) RETURNS void
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


-- Name: apply_cancellation_policy(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.apply_cancellation_policy(_order_id uuid, _reason text DEFAULT 'Cancelado pelo cliente'::text) RETURNS jsonb
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


-- Name: approve_plan_change(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.approve_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL::text) RETURNS void
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


-- Name: auto_finalize_stale_orders(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.auto_finalize_stale_orders() RETURNS jsonb
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


-- Name: award_loyalty_points(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.award_loyalty_points() RETURNS trigger
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
  
  RETURN NEW;
END;
$$;


-- Name: calculate_prorata_credit(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.calculate_prorata_credit(_store_id uuid) RETURNS numeric
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


-- Name: check_device_active(text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.check_device_active(_device_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_active_devices
    WHERE user_id = auth.uid()
      AND device_id = _device_id
  );
$$;


-- Name: claim_push_device(text, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.claim_push_device(_fcm_token text DEFAULT NULL::text, _player_id text DEFAULT NULL::text, _device_info text DEFAULT NULL::text) RETURNS void
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


-- Name: client_confirm_delivery(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.client_confirm_delivery(_order_id uuid) RETURNS void
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
END;
$$;


-- Name: confirm_order_payment(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.confirm_order_payment(_order_id uuid) RETURNS void
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


-- Name: count_supporter_plans(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.count_supporter_plans() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::integer
  FROM public.store_plans
  WHERE plan_type = 'fixed'
    AND monthly_fee = 130
    AND is_active = true;
$$;


-- Name: create_store_driver_earning(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.create_store_driver_earning() RETURNS trigger
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


-- Name: driver_accept_order(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.driver_accept_order(_order_id uuid) RETURNS void
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


-- Name: driver_confirm_earning_received(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.driver_confirm_earning_received(_earning_id uuid) RETURNS void
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


-- Name: driver_confirm_store_return(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text DEFAULT NULL::text) RETURNS void
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


-- Name: driver_finish_delivery(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text DEFAULT NULL::text) RETURNS void
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


-- Name: driver_validate_collection(uuid, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.driver_validate_collection(_order_id uuid, _code text) RETURNS void
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


-- Name: generate_collection_code(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.generate_collection_code() RETURNS trigger
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
  RETURN NEW;
END;
$$;


-- Name: generate_delivery_pin(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.generate_delivery_pin() RETURNS trigger
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


-- Name: generate_financial_reference(text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.generate_financial_reference(_prefix text) RETURNS text
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


-- Name: generate_settlement_code(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.generate_settlement_code() RETURNS trigger
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


-- Name: generate_withdrawal_code(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.generate_withdrawal_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.transaction_code := 'SK-' || lpad(nextval('withdrawal_code_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;


-- Name: get_delivery_contacts(uuid[]); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_delivery_contacts(_order_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(user_id uuid, full_name text, phone text, whatsapp_number text, neighborhood text)
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


-- Name: get_fixed_plan_platform_split(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_fixed_plan_platform_split(_store_id uuid) RETURNS numeric
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


-- Name: get_owned_store_ids(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_owned_store_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.stores WHERE owner_id = _user_id
$$;


-- Name: get_page_view_stats(text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_page_view_stats(_page text DEFAULT 'store_directory'::text) RETURNS jsonb
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


-- Name: get_store_commission_rate(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_store_commission_rate(_store_id uuid) RETURNS numeric
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


-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
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