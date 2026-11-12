-- ============================================================================
-- Fase 1 Estoque + Ficha Técnica — 02/06: DRIFT apparel/boutique
-- (versionamento, sem mudar comportamento).
--
-- Captura o subsistema boutique INTEIRO, que não tem NENHUMA migration no
-- repo (grep em origin/production 5c48a68d: zero ocorrências de `apparel_`,
-- `product_variants`, `public.stock_movements`, `customer_credits` e
-- `customers_crm` em supabase/migrations/):
--   * tabelas product_variants, stock_movements, customer_credits,
--     customers_crm (+ índices, RLS e policies — DDL vivo exato);
--   * funções pdv_assert_store_owner, apparel_adjust_stock,
--     apparel_return_item, apparel_create_product_with_variants (2 overloads),
--     apparel_apply_credit, apparel_list_credits, apparel_set_store_type,
--     apparel_touch_customer (definições vivas verbatim).
--
-- DDL/fonte capturados do vivo em 2026-11-12 (projeto qkjhguziuchqsbxzruea).
-- As policies duplicadas/sobrepostas (ex.: duas policies ALL em
-- product_variants e em stock_movements) são reproduzidas como estão no vivo;
-- limpeza de policy NÃO é escopo desta migração.
-- Aplicar em UMA transação. Idempotente (IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabelas — DDL vivo exato
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  size text,
  color text,
  sku text,
  barcode text,
  price_override numeric,
  stock_qty numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  delta numeric NOT NULL,
  reason text NOT NULL,
  operator_id uuid,
  ref_order_id uuid,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores (id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES public.product_variants (id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_reason_check
    CHECK (reason = ANY (ARRAY['sale'::text, 'return'::text, 'adjust'::text, 'entry'::text, 'loss'::text]))
);

CREATE TABLE IF NOT EXISTS public.customer_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  customer_id uuid,
  customer_phone text,
  customer_name text,
  amount numeric NOT NULL,
  balance numeric NOT NULL,
  source_order_id uuid,
  used_at timestamp with time zone,
  expires_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_credits_pkey PRIMARY KEY (id),
  CONSTRAINT customer_credits_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.customers_crm (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  customer_id uuid,
  phone text,
  name text,
  preferred_size text,
  preferred_color text,
  notes text,
  total_spent numeric NOT NULL DEFAULT 0,
  purchases_count integer NOT NULL DEFAULT 0,
  last_purchase_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_crm_pkey PRIMARY KEY (id),
  CONSTRAINT customers_crm_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- 2. Índices — definições vivas exatas
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON public.product_variants USING btree (product_id);
CREATE INDEX IF NOT EXISTS product_variants_barcode_idx
  ON public.product_variants USING btree (barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_uniq
  ON public.product_variants USING btree (product_id, COALESCE(size, ''::text), COALESCE(color, ''::text));
CREATE INDEX IF NOT EXISTS stock_movements_variant_idx
  ON public.stock_movements USING btree (variant_id);
CREATE INDEX IF NOT EXISTS stock_movements_store_created_idx
  ON public.stock_movements USING btree (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_credits_store_idx
  ON public.customer_credits USING btree (store_id);
CREATE INDEX IF NOT EXISTS customer_credits_phone_idx
  ON public.customer_credits USING btree (store_id, customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_crm_store_idx
  ON public.customers_crm USING btree (store_id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_crm_store_phone_uniq
  ON public.customers_crm USING btree (store_id, phone) WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. RLS + policies — exatas (vivas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers_crm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manage variants" ON public.product_variants;
CREATE POLICY "owner manage variants" ON public.product_variants
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS product_variants_owner_all ON public.product_variants;
CREATE POLICY product_variants_owner_all ON public.product_variants
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS product_variants_public_read ON public.product_variants;
CREATE POLICY product_variants_public_read ON public.product_variants
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "public read variants" ON public.product_variants;
CREATE POLICY "public read variants" ON public.product_variants
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Owner manages stock_movements" ON public.stock_movements;
CREATE POLICY "Owner manages stock_movements" ON public.stock_movements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = stock_movements.store_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = stock_movements.store_id AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS stock_movements_owner_all ON public.stock_movements;
CREATE POLICY stock_movements_owner_all ON public.stock_movements
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = stock_movements.store_id AND s.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = stock_movements.store_id AND s.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS customer_credits_owner_all ON public.customer_credits;
CREATE POLICY customer_credits_owner_all ON public.customer_credits
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customer_credits.store_id AND s.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customer_credits.store_id AND s.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS customers_crm_owner_all ON public.customers_crm;
CREATE POLICY customers_crm_owner_all ON public.customers_crm
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customers_crm.store_id AND s.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = customers_crm.store_id AND s.owner_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 4. Funções — definições vivas verbatim (pg_get_functiondef, 2026-11-12)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pdv_assert_store_owner(_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_adjust_stock(_variant_id uuid, _delta numeric, _reason text, _ref_order_id uuid DEFAULT NULL::uuid, _note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _store uuid; _new_qty numeric;
BEGIN
  SELECT s.id INTO _store FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE v.id = _variant_id;
  IF _store IS NULL THEN RAISE EXCEPTION 'variant_not_found'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);

  IF _delta < 0 THEN
    UPDATE public.product_variants
       SET stock_qty = stock_qty + _delta, updated_at = now()
     WHERE id = _variant_id AND stock_qty + _delta >= 0
     RETURNING stock_qty INTO _new_qty;
    IF _new_qty IS NULL THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
  ELSE
    UPDATE public.product_variants
       SET stock_qty = stock_qty + _delta, updated_at = now()
     WHERE id = _variant_id RETURNING stock_qty INTO _new_qty;
  END IF;

  INSERT INTO public.stock_movements (store_id, variant_id, delta, reason, operator_id, ref_order_id, note)
    VALUES (_store, _variant_id, _delta, _reason, auth.uid(), _ref_order_id, _note);
  RETURN _new_qty;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_return_item(_order_item_id uuid, _qty numeric, _mode text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _store uuid; _variant uuid; _order uuid; _price numeric;
        _customer uuid; _phone text; _name text; _credit_id uuid;
BEGIN
  SELECT o.store_id, oi.variant_id, oi.order_id, oi.unit_price, o.client_id, o.customer_phone, o.customer_name
    INTO _store, _variant, _order, _price, _customer, _phone, _name
    FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = _order_item_id;
  IF _store IS NULL THEN RAISE EXCEPTION 'order_item_not_found'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);
  IF _qty <= 0 THEN RAISE EXCEPTION 'invalid_qty'; END IF;

  IF _variant IS NOT NULL THEN
    PERFORM public.apparel_adjust_stock(_variant, _qty, 'return', _order, 'devolução item ' || _order_item_id::text);
  END IF;

  IF _mode = 'credit' THEN
    INSERT INTO public.customer_credits (store_id, customer_id, customer_phone, customer_name, amount, balance, source_order_id, note)
      VALUES (_store, _customer, _phone, _name, _price * _qty, _price * _qty, _order, 'Vale-troca devolução')
      RETURNING id INTO _credit_id;
    RETURN _credit_id;
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_create_product_with_variants(_store_id uuid, _name text, _base_price numeric, _category text, _image_url text, _description text, _variants jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _prod_id uuid; _v jsonb;
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  INSERT INTO public.products (store_id, name, price, category, image_url, description, active)
    VALUES (_store_id, _name, _base_price, COALESCE(_category,'Roupas'), _image_url, _description, true)
    RETURNING id INTO _prod_id;

  IF _variants IS NOT NULL THEN
    FOR _v IN SELECT * FROM jsonb_array_elements(_variants) LOOP
      INSERT INTO public.product_variants (product_id, size, color, sku, barcode, price_override, stock_qty)
      VALUES (
        _prod_id,
        NULLIF(_v->>'size',''),
        NULLIF(_v->>'color',''),
        NULLIF(_v->>'sku',''),
        NULLIF(_v->>'barcode',''),
        NULLIF(_v->>'price_override','')::numeric,
        COALESCE((_v->>'stock_qty')::numeric, 0)
      );
    END LOOP;
  END IF;
  RETURN _prod_id;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_create_product_with_variants(_store_id uuid, _name text, _price numeric, _section_id uuid, _image_url text, _variants jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
  _v jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=_store_id AND owner_id=auth.uid())
     AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para criar produto nessa loja.';
  END IF;

  INSERT INTO public.products (store_id, name, price, section_id, image_url, is_available)
  VALUES (_store_id, _name, _price, _section_id, _image_url, true)
  RETURNING id INTO _product_id;

  FOR _v IN SELECT * FROM jsonb_array_elements(_variants) LOOP
    INSERT INTO public.product_variants
      (product_id, size, color, sku, barcode, stock_qty, price_override)
    VALUES (
      _product_id,
      NULLIF(_v->>'size',''),
      NULLIF(_v->>'color',''),
      NULLIF(_v->>'sku',''),
      NULLIF(_v->>'barcode',''),
      COALESCE((_v->>'stock_qty')::numeric, 0),
      NULLIF(_v->>'price_override','')::numeric
    )
    ON CONFLICT (product_id, coalesce(size,''), coalesce(color,'')) DO NOTHING;

    IF COALESCE((_v->>'stock_qty')::numeric, 0) > 0 THEN
      INSERT INTO public.stock_movements (store_id, variant_id, delta, reason, operator_id, note)
      SELECT _store_id, pv.id, (_v->>'stock_qty')::numeric, 'entry', auth.uid(), 'entrada inicial'
      FROM public.product_variants pv
      WHERE pv.product_id = _product_id
        AND coalesce(pv.size,'') = coalesce(NULLIF(_v->>'size',''), '')
        AND coalesce(pv.color,'') = coalesce(NULLIF(_v->>'color',''), '');
    END IF;
  END LOOP;

  RETURN _product_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apparel_apply_credit(_credit_id uuid, _order_id uuid, _amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _store uuid; _balance numeric; _new_balance numeric;
BEGIN
  SELECT store_id, balance INTO _store, _balance FROM public.customer_credits WHERE id=_credit_id FOR UPDATE;
  IF _store IS NULL THEN RAISE EXCEPTION 'credit_not_found'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);
  IF _amount <= 0 OR _amount > _balance THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  _new_balance := _balance - _amount;
  UPDATE public.customer_credits
     SET balance = _new_balance,
         used_at = CASE WHEN _new_balance = 0 THEN now() ELSE used_at END,
         updated_at = now()
   WHERE id = _credit_id;
  RETURN _new_balance;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_list_credits(_store_id uuid, _phone text DEFAULT NULL::text)
 RETURNS SETOF customer_credits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  RETURN QUERY
    SELECT * FROM public.customer_credits
    WHERE store_id = _store_id
      AND balance > 0
      AND (_phone IS NULL OR customer_phone = _phone)
    ORDER BY created_at DESC
    LIMIT 100;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_set_store_type(_store_id uuid, _type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  IF _type NOT IN ('food','apparel') THEN RAISE EXCEPTION 'invalid_type'; END IF;
  UPDATE public.stores SET store_type = _type::public.store_type_enum, updated_at = now() WHERE id = _store_id;
END $function$;

CREATE OR REPLACE FUNCTION public.apparel_touch_customer(_store_id uuid, _phone text, _name text, _preferred_size text DEFAULT NULL::text, _amount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _id uuid;
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RAISE EXCEPTION 'phone_required';
  END IF;

  INSERT INTO public.customers_crm (store_id, phone, name, preferred_size, total_spent, purchases_count, last_purchase_at)
  VALUES (_store_id, _phone, _name, _preferred_size, COALESCE(_amount,0), CASE WHEN _amount>0 THEN 1 ELSE 0 END, CASE WHEN _amount>0 THEN now() ELSE NULL END)
  ON CONFLICT (store_id, phone) WHERE phone IS NOT NULL DO UPDATE
     SET name = COALESCE(EXCLUDED.name, customers_crm.name),
         preferred_size = COALESCE(EXCLUDED.preferred_size, customers_crm.preferred_size),
         total_spent = customers_crm.total_spent + COALESCE(_amount,0),
         purchases_count = customers_crm.purchases_count + CASE WHEN _amount>0 THEN 1 ELSE 0 END,
         last_purchase_at = CASE WHEN _amount>0 THEN now() ELSE customers_crm.last_purchase_at END,
         updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END $function$;

-- ---------------------------------------------------------------------------
-- 5. Grants — proacl vivo exato por função (reproduzir, não "melhorar":
--    a revisão de grants das funções de restaurante está na migração 04;
--    as funções apparel já verificam dono no corpo via pdv_assert_store_owner,
--    então chamadas anon falham fechadas hoje — revogar anon aqui mudaria
--    só a mensagem de erro, não o comportamento; fica para hardening futuro.)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.pdv_assert_store_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_assert_store_owner(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_adjust_stock(uuid, numeric, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_adjust_stock(uuid, numeric, text, uuid, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_return_item(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_return_item(uuid, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_create_product_with_variants(uuid, text, numeric, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_create_product_with_variants(uuid, text, numeric, text, text, text, jsonb) TO anon, authenticated, service_role;

-- Overload de 6 args: vivo TEM grant PUBLIC (=X) — reproduzir (não revogar).
GRANT EXECUTE ON FUNCTION public.apparel_create_product_with_variants(uuid, text, numeric, uuid, text, jsonb) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_apply_credit(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_apply_credit(uuid, uuid, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_list_credits(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_list_credits(uuid, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_set_store_type(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_set_store_type(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apparel_touch_customer(uuid, text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_touch_customer(uuid, text, text, text, numeric) TO anon, authenticated, service_role;
