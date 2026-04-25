  WHERE e.id = _earning_id;
DO 4313 BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Earning not found';
  IF v_owner <> auth.uid() AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  UPDATE public.store_driver_earnings
  SET status = 'pago',
      paid_at = now(),
      paid_by = auth.uid(),
      notes = COALESCE(_notes, notes)
  WHERE id = _earning_id;
END;
END 4313;
$$;
-- Name: notify_admins_new_approval(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.notify_admins_new_approval() RETURNS trigger
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
DO 4313 BEGIN
  IF NEW.is_approved IS DISTINCT FROM false THEN
    RETURN NEW;
  IF NEW.role::text NOT IN ('lojista', 'motoboy') THEN
    RETURN NEW;
  v_role := NEW.role::text;
  v_label := CASE WHEN v_role = 'lojista' THEN 'lojista' ELSE 'entregador' END;
  -- Collect admin user_ids
  SELECT array_agg(user_id) INTO v_admin_ids
  FROM public.user_roles
  WHERE role = 'admin';
  IF v_admin_ids IS NULL OR array_length(v_admin_ids, 1) = 0 THEN
    RETURN NEW;
  -- Get supabase URL and service role key from vault (fallback to settings)
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;
END 4313;
  v_url := 'https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/send-push';
DO 4313 BEGIN
  IF v_service_key IS NULL THEN
    -- Cannot call without service key; skip silently (toast still works via realtime)
    RETURN NEW;
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
END 4313;
$$;
-- Name: notify_order_status_zapi(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.notify_order_status_zapi() RETURNS trigger
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
DO 4313 BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  -- Only for statuses we want to notify the client about
  IF NEW.status NOT IN ('preparando','pronto_para_entrega','saiu_entrega','em_transito','entregue','finalizado','cancelado') THEN
    RETURN NEW;
  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);
  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_order_status_zapi: missing settings';
    RETURN NEW;
  -- Check Z-API enabled for this store
  SELECT zapi_enabled INTO _zapi_enabled
  FROM public.store_secrets
  WHERE store_id = NEW.store_id;
  IF NOT COALESCE(_zapi_enabled, false) THEN
    RETURN NEW;
  -- Get client whatsapp/phone
  SELECT COALESCE(p.whatsapp_number, p.phone) INTO _client_phone
  FROM public.profiles p
  WHERE p.user_id = NEW.client_id;
  IF _client_phone IS NULL OR length(regexp_replace(_client_phone, '\D', '', 'g')) < 10 THEN
    RETURN NEW;
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
END 4313;
DO 4313 BEGIN
  IF _msg IS NULL THEN RETURN NEW; 
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
END 4313;
$$;
-- Name: notify_order_sync(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.notify_order_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  _supabase_url := current_setting('supabase.url', true);
  _service_key := current_setting('supabase.service_role_key', true);
DO 4313 BEGIN
  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_order_sync: missing supabase URL or service key settings';
    RETURN NEW;
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
END 4313;
$$;
-- Name: notify_record_sync(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.notify_record_sync() RETURNS trigger
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
DO 4313 BEGIN
  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE LOG 'notify_record_sync: missing supabase URL or service key';
    RETURN COALESCE(NEW, OLD);
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
END 4313;
$$;
-- Name: prevent_driver_protected_fields_update(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.prevent_driver_protected_fields_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Apenas o próprio motoboy pode alterar seu registro via esta policy,
  -- e só pode mudar is_online. Demais campos protegidos.
DO 4313 BEGIN
  IF auth.uid() = NEW.user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Não é permitido alterar is_active';
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'Não é permitido alterar name';
    IF NEW.city IS DISTINCT FROM OLD.city THEN
      RAISE EXCEPTION 'Não é permitido alterar city';
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não é permitido alterar user_id';
  RETURN NEW;
END;
END 4313;
$$;
-- Name: prevent_role_self_change(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.prevent_role_self_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
DO 4313 BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio cargo.';
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio status de aprovação.';
  RETURN NEW;
END;
END 4313;
$$;
-- Name: process_refund(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.process_refund(_refund_id uuid, _approved_amount numeric, _admin_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _refund RECORD;
  _is_admin boolean;
  _is_store_owner boolean;
BEGIN
  SELECT * INTO _refund FROM public.refund_requests WHERE id = _refund_id;
DO 4313 BEGIN
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; 
  IF _refund.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; 
  _is_admin := public.is_platform_admin(auth.uid());
  _is_store_owner := EXISTS (SELECT 1 FROM public.stores WHERE id = _refund.store_id AND owner_id = auth.uid());
  IF NOT _is_admin AND NOT _is_store_owner THEN
    RAISE EXCEPTION 'Sem permissão para processar reembolsos.';
  IF _approved_amount <= 0 THEN
    -- Reject
    UPDATE public.refund_requests SET
      status = 'rejected',
      admin_notes = COALESCE(_admin_notes, admin_notes),
      resolved_by = auth.uid(),
      resolved_at = now()
    WHERE id = _refund_id;
    RETURN;
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
END 4313;
$$;
-- Name: record_page_view(text, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.record_page_view(_page text, _visitor_hash text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  -- Bloqueia se for admin / moderador / conta interna
DO 4313 BEGIN
  IF _uid IS NOT NULL AND public.is_internal_account(_uid) THEN
    RETURN;
  INSERT INTO public.page_views (page, visitor_hash, user_id)
  VALUES (_page, _visitor_hash, _uid);
END;
END 4313;
$$;
-- Name: register_as_lojista(text, text, text, public.store_category, text, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.register_as_lojista(_full_name text, _document text, _store_name text, _store_category public.store_category, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
DO 4313 BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
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
END 4313;
$$;
-- Name: register_as_lojista(text, text, text, public.store_category, text, text, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.register_as_lojista(_full_name text, _document text, _store_name text, _store_category public.store_category, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text, _selected_plan text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
BEGIN
DO 4313 BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
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
END 4313;
$$;
-- Name: register_as_motoboy(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.register_as_motoboy(_full_name text, _document text, _vehicle text, _avatar_url text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  -- Check not already registered
DO 4313 BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
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
END 4313;
$$;
-- Name: register_as_motoboy(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.register_as_motoboy(_full_name text, _document text, _vehicle text, _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
DO 4313 BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
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
END 4313;
$$;
-- Name: register_device_login(text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.register_device_login(_device_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old_device text;
BEGIN
DO 4313 BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
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
END 4313;
$$;
-- Name: reject_plan_change(uuid, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.reject_plan_change(_request_id uuid, _admin_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _req record;
BEGIN
DO 4313 BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem rejeitar mudanças de plano.';
  SELECT * INTO _req FROM plan_change_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; 
  IF _req.status != 'pending' THEN RAISE EXCEPTION 'Solicitação já processada.'; 
  UPDATE plan_change_requests SET
    status = 'rejected',
    admin_notes = COALESCE(_admin_notes, admin_notes),
    processed_at = now()
  WHERE id = _request_id;
END;
END 4313;
$$;
-- Name: search_motoboy_profiles(text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.search_motoboy_profiles(_search text) RETURNS TABLE(user_id uuid, full_name text, phone text, whatsapp_number text, vehicle text, email text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _clean text;
BEGIN
  -- Only store owners can search
DO 4313 BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas lojistas podem buscar motoboys.';
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
END 4313;
$$;
-- Name: set_app_links_updated_at(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.set_app_links_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Name: store_assign_order_driver(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.store_assign_order_driver(_order_id uuid, _driver_user_id uuid) RETURNS void
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
DO 4313 BEGIN
  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  SELECT s.owner_id INTO _owner FROM public.stores s WHERE s.id = _store_id;
  IF _owner IS DISTINCT FROM auth.uid() AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o lojista pode designar entregadores.';
  IF _current_driver IS NOT NULL THEN
    RAISE EXCEPTION 'Pedido já foi aceito por um entregador.';
  IF _status NOT IN ('pendente','preparando','pronto_para_entrega') THEN
    RAISE EXCEPTION 'Pedido não está em estado válido para designação.';
  -- If targeting a driver, ensure they are linked to this store
  IF _driver_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_drivers sd
      WHERE sd.store_id = _store_id AND sd.driver_user_id = _driver_user_id
    ) THEN
      RAISE EXCEPTION 'Esse entregador não está vinculado à sua loja.';
  UPDATE public.orders
  SET assigned_driver_id = _driver_user_id
  WHERE id = _order_id;
END;
END 4313;
$$;
-- Name: store_mark_all_driver_earnings_paid(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.store_mark_all_driver_earnings_paid(_driver_user_id uuid, _store_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner FROM stores WHERE id = _store_id;
DO 4313 BEGIN
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  UPDATE store_driver_earnings
     SET status = 'aguardando_confirmacao',
         store_marked_paid_at = now()
   WHERE store_id = _store_id
     AND driver_user_id = _driver_user_id
     AND status = 'pendente';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
END 4313;
$$;
-- Name: store_mark_driver_earning_paid(uuid, text); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.store_mark_driver_earning_paid(_earning_id uuid, _notes text DEFAULT NULL::text) RETURNS void
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
DO 4313 BEGIN
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  UPDATE store_driver_earnings
     SET status = 'aguardando_confirmacao',
         store_marked_paid_at = now()
   WHERE id = _earning_id
     AND status = 'pendente';
END;
END 4313;
$$;
-- Name: sync_store_balances_legacy_fields(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.sync_store_balances_legacy_fields() RETURNS trigger
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
-- Name: sync_store_categories(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.sync_store_categories() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Ensure categories is never null
DO 4313 BEGIN
  IF NEW.categories IS NULL THEN
    NEW.categories := '{}'::store_category[];
  -- Always include the primary category in the array
  IF NEW.category IS NOT NULL AND NOT (NEW.category = ANY (NEW.categories)) THEN
    NEW.categories := array_prepend(NEW.category, NEW.categories);
  -- If primary category is not set but array has values, set primary to first
  IF NEW.category IS NULL AND array_length(NEW.categories, 1) > 0 THEN
    NEW.category := NEW.categories[1];
  RETURN NEW;
END;
END 4313;
$$;
-- Name: touch_financial_transactions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.touch_financial_transactions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Name: update_store_rating(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.update_store_rating() RETURNS trigger
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
-- Name: use_coupon(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.use_coupon(_coupon_id uuid, _user_id uuid, _order_id uuid) RETURNS boolean
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
DO 4313 BEGIN
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado.';
  IF NOT _coupon.is_active THEN
    RAISE EXCEPTION 'Cupom inativo.';
  IF _coupon.max_uses IS NOT NULL AND _coupon.used_count >= _coupon.max_uses THEN
    RAISE EXCEPTION 'Cupom esgotado.';
  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Cupom expirado.';
  -- Check if user already used this coupon
  IF EXISTS (SELECT 1 FROM public.coupon_uses WHERE coupon_id = _coupon_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Você já utilizou este cupom.';
  -- Atomically increment used_count and insert usage record
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_id;
  INSERT INTO public.coupon_uses (coupon_id, user_id, order_id) VALUES (_coupon_id, _user_id, _order_id);
  RETURN true;
END;
END 4313;
$$;
-- Name: use_wallet_balance(uuid, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.use_wallet_balance(_user_id uuid, _amount numeric, _order_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _current_balance NUMERIC;
  _deducted NUMERIC;
BEGIN
DO 4313 BEGIN
  IF auth.uid() != _user_id AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão.';
  SELECT balance INTO _current_balance
  FROM public.user_wallet
  WHERE user_id = _user_id
  FOR UPDATE;
  IF NOT FOUND OR _current_balance <= 0 THEN
    RETURN 0;
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
END 4313;
$$;
-- Name: validate_order_prices(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.validate_order_prices() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _commission_rate numeric;
BEGIN
  _commission_rate := public.get_store_commission_rate(NEW.store_id);
  NEW.app_fee := ROUND(COALESCE(NEW.subtotal, 0) * (_commission_rate / 100.0), 2);
DO 4313 BEGIN
  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  NEW.total_price := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0));
  RETURN NEW;
END;
END 4313;
$$;
-- Name: verify_order_subtotal(); Type: FUNCTION; Schema: public; Owner: -
CREATE OR REPLACE FUNCTION public.verify_order_subtotal() RETURNS trigger
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
DO 4313 BEGIN
  IF _order_record IS NOT NULL AND ABS(_real_subtotal - _order_record.subtotal) > 0.01 THEN
    _commission_rate := public.get_store_commission_rate(_order_record.store_id);
    _app_fee := ROUND(_real_subtotal * (_commission_rate / 100.0), 2);
    UPDATE public.orders
    SET subtotal = _real_subtotal,
        app_fee = _app_fee,
        total_price = GREATEST(0, _real_subtotal + COALESCE(_order_record.delivery_fee, 0))
    WHERE id = NEW.order_id;
  RETURN NEW;
END;
END 4313;
$$;
SET default_tablespace = '';
SET default_table_access_method = heap;
-- Name: addon_groups; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.addon_groups (
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
-- Name: COLUMN addon_groups.price_replaces_base; Type: COMMENT; Schema: public; Owner: -
COMMENT ON COLUMN public.addon_groups.price_replaces_base IS 'When true, the selected addon price REPLACES the product base price instead of being added to it. Useful for size variations (e.g. 200ml, 300ml).';
-- Name: addon_items; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.addon_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.admin_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: app_links; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.app_links (
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
-- Name: archived_accounts; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.archived_accounts (
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
-- Name: banners; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.banners (
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
-- Name: compliance_alerts; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.compliance_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    alert_type text DEFAULT 'unfinalized_orders'::text NOT NULL,
    message text NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);
-- Name: coupon_uses; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.coupon_uses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.coupons (
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
-- Name: coupons_public; Type: VIEW; Schema: public; Owner: -
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
-- Name: driver_balances; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.driver_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    total_earned numeric DEFAULT 0 NOT NULL,
    pending_amount numeric DEFAULT 0 NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: driver_earnings; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.driver_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.driver_locations (
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
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_online boolean DEFAULT false NOT NULL,
    city text DEFAULT 'itatinga'::text
);
-- Name: emergency_fund; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.emergency_fund (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    transaction_type text NOT NULL,
    source text NOT NULL,
    description text,
    partner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT emergency_fund_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['deposit'::text, 'withdrawal'::text])))
);
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.fcm_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_info text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    store_id uuid
);
-- Name: financial_transactions; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.financial_transactions (
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
-- Name: loyalty_config; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.loyalty_config (
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
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.loyalty_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    total_orders integer DEFAULT 0 NOT NULL,
    last_order_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: menu_sections; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.menu_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: moderator_earnings; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.moderator_earnings (
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
-- Name: moderator_referrals; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.moderator_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    moderator_id uuid NOT NULL,
    store_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: moderators; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.moderators (
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
-- Name: neighborhood_fees; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.neighborhood_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    fee numeric(10,2) DEFAULT 0 NOT NULL
);
-- Name: onesignal_players; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.onesignal_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    player_id text NOT NULL,
    device_info text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: opening_hours; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.opening_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    open_time time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    close_time time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    is_closed_all_day boolean DEFAULT false NOT NULL,
    CONSTRAINT opening_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric NOT NULL,
    observations text,
    addons jsonb DEFAULT '[]'::jsonb
);
-- Name: order_messages; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.order_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: order_ratings; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.order_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
-- Name: orders; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.orders (
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
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page text NOT NULL,
    visitor_hash text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: partner_payouts; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.partner_payouts (
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
-- Name: payout_history; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.payout_history (
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
-- Name: pizza_borders; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.pizza_borders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text DEFAULT 'Borda Tradicional'::text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: plan_change_requests; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.plan_change_requests (
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
-- Name: platform_partners; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.platform_partners (
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
-- Name: product_addon_groups; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.product_addon_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    addon_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
-- Name: products; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.products (
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
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.profiles (
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
-- Name: profile_contacts; Type: VIEW; Schema: public; Owner: -
CREATE VIEW public.profile_contacts WITH (security_invoker='true') AS
 SELECT user_id,
    full_name,
    phone,
    whatsapp_number,
    neighborhood,
    email
   FROM public.profiles
  WHERE (deleted_at IS NULL);
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.refund_requests (
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
-- Name: saved_addresses; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.saved_addresses (
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
-- Name: store_balances; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    pending_commission numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    repasse_pendente numeric DEFAULT 0 NOT NULL,
    comissao_pendente numeric DEFAULT 0 NOT NULL
);
-- Name: store_driver_earnings; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_driver_earnings (
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
-- Name: store_drivers; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    driver_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_mode text DEFAULT 'fim_do_dia'::text NOT NULL,
    CONSTRAINT store_drivers_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['instantaneo'::text, 'fim_do_dia'::text])))
);
-- Name: store_plans; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_plans (
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
-- Name: COLUMN store_plans.pix_operational_fee_override; Type: COMMENT; Schema: public; Owner: -
COMMENT ON COLUMN public.store_plans.pix_operational_fee_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per PIX transaction)';
-- Name: COLUMN store_plans.platform_delivery_split_override; Type: COMMENT; Schema: public; Owner: -
COMMENT ON COLUMN public.store_plans.platform_delivery_split_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per delivery for platform)';
-- Name: store_plans_public; Type: VIEW; Schema: public; Owner: -
CREATE VIEW public.store_plans_public WITH (security_invoker='true') AS
 SELECT store_id,
    plan_type,
    is_active,
    trial_ends_at
   FROM public.store_plans;
-- Name: store_secrets; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_secrets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    zapi_enabled boolean DEFAULT false NOT NULL,
    zapi_instance_id text,
    zapi_token text,
    zapi_client_token text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: stores; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.stores (
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
-- Name: COLUMN stores.asaas_account_id; Type: COMMENT; Schema: public; Owner: -
COMMENT ON COLUMN public.stores.asaas_account_id IS 'Asaas subaccount ID for split payments';
-- Name: COLUMN stores.asaas_wallet_id; Type: COMMENT; Schema: public; Owner: -
COMMENT ON COLUMN public.stores.asaas_wallet_id IS 'Asaas wallet ID for receiving split payments';
-- Name: stores_driver_view; Type: VIEW; Schema: public; Owner: -
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
-- Name: stores_public; Type: VIEW; Schema: public; Owner: -
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
-- Name: terms_acceptance; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.terms_acceptance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    terms_version text DEFAULT '1.0'::text NOT NULL,
    privacy_version text DEFAULT '1.0'::text NOT NULL,
    ip_address text,
    user_agent text,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL
);
-- Name: user_active_devices; Type: TABLE; Schema: public; Owner: -
CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.user_active_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
