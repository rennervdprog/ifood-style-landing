// Fase 1 do PDV Boutique (roupas): cria store_type + product_variants + stock_movements
// + customer_credits + customers_crm + order_items.variant_id + RPCs base.
// Idempotente — pode rodar quantas vezes quiser. Aplica no Supabase EXTERNO.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, ok: r.ok, body: await r.text() };
}

const SQL_SCHEMA = `
-- 1) stores.store_type ------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='store_type_enum') THEN
    CREATE TYPE public.store_type_enum AS ENUM ('food','apparel');
  END IF;
END $$;
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_type public.store_type_enum NOT NULL DEFAULT 'food';
CREATE INDEX IF NOT EXISTS stores_store_type_idx ON public.stores (store_type);

-- 2) product_variants -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size text,
  color text,
  sku text,
  barcode text,
  price_override numeric,
  stock_qty numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_uniq
  ON public.product_variants (product_id, coalesce(size,''), coalesce(color,''));
CREATE INDEX IF NOT EXISTS product_variants_barcode_idx ON public.product_variants (barcode) WHERE barcode IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_variants' AND policyname='product_variants_owner_all') THEN
    CREATE POLICY "product_variants_owner_all" ON public.product_variants
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
                     WHERE p.id = product_variants.product_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
                     WHERE p.id = product_variants.product_id AND s.owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_variants' AND policyname='product_variants_public_read') THEN
    CREATE POLICY "product_variants_public_read" ON public.product_variants
      FOR SELECT TO anon, authenticated USING (active = true);
  END IF;
END $$;
GRANT SELECT ON public.product_variants TO anon;

-- 3) stock_movements --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  delta numeric NOT NULL,
  reason text NOT NULL CHECK (reason IN ('sale','return','adjust','entry','loss')),
  operator_id uuid,
  ref_order_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_store_created_idx ON public.stock_movements (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_variant_idx ON public.stock_movements (variant_id);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='stock_movements_owner_all') THEN
    CREATE POLICY "stock_movements_owner_all" ON public.stock_movements
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=stock_movements.store_id AND s.owner_id=auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=stock_movements.store_id AND s.owner_id=auth.uid()));
  END IF;
END $$;

-- 4) customer_credits (vale-troca) -----------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_phone text,
  customer_name text,
  amount numeric NOT NULL,
  balance numeric NOT NULL,
  source_order_id uuid,
  used_at timestamptz,
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_credits_store_idx ON public.customer_credits (store_id);
CREATE INDEX IF NOT EXISTS customer_credits_phone_idx ON public.customer_credits (store_id, customer_phone) WHERE customer_phone IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.customer_credits TO authenticated;
GRANT ALL ON public.customer_credits TO service_role;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_credits' AND policyname='customer_credits_owner_all') THEN
    CREATE POLICY "customer_credits_owner_all" ON public.customer_credits
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=customer_credits.store_id AND s.owner_id=auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=customer_credits.store_id AND s.owner_id=auth.uid()));
  END IF;
END $$;

-- 5) customers_crm ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers_crm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid,
  phone text,
  name text,
  preferred_size text,
  preferred_color text,
  notes text,
  total_spent numeric NOT NULL DEFAULT 0,
  purchases_count int NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_crm_store_phone_uniq
  ON public.customers_crm (store_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_crm_store_idx ON public.customers_crm (store_id);
GRANT SELECT, INSERT, UPDATE ON public.customers_crm TO authenticated;
GRANT ALL ON public.customers_crm TO service_role;
ALTER TABLE public.customers_crm ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers_crm' AND policyname='customers_crm_owner_all') THEN
    CREATE POLICY "customers_crm_owner_all" ON public.customers_crm
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=customers_crm.store_id AND s.owner_id=auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id=customers_crm.store_id AND s.owner_id=auth.uid()));
  END IF;
END $$;

-- 6) order_items.variant_id -------------------------------------------------
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS order_items_variant_idx ON public.order_items (variant_id) WHERE variant_id IS NOT NULL;

-- trigger updated_at reutiliza função global se existir
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='product_variants_upd_at') THEN
    CREATE TRIGGER product_variants_upd_at BEFORE UPDATE ON public.product_variants
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='customer_credits_upd_at') THEN
    CREATE TRIGGER customer_credits_upd_at BEFORE UPDATE ON public.customer_credits
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='customers_crm_upd_at') THEN
    CREATE TRIGGER customers_crm_upd_at BEFORE UPDATE ON public.customers_crm
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
`;

const SQL_RPCS = `
-- Ownership helper (reusa pdv_assert_store_owner se existir; senão cria)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='pdv_assert_store_owner') THEN
    CREATE OR REPLACE FUNCTION public.pdv_assert_store_owner(_store_id uuid)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=_store_id AND owner_id=auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
    END $f$;
  END IF;
END $$;

-- Cria produto pai + variantes em lote
CREATE OR REPLACE FUNCTION public.apparel_create_product_with_variants(
  _store_id uuid,
  _name text,
  _base_price numeric,
  _category text,
  _image_url text,
  _description text,
  _variants jsonb          -- [{size, color, sku, barcode, price_override, stock_qty}]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.apparel_create_product_with_variants(uuid,text,numeric,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_create_product_with_variants(uuid,text,numeric,text,text,text,jsonb) TO authenticated, service_role;

-- Ajuste seguro de estoque (com trava condicional para saldo negativo)
CREATE OR REPLACE FUNCTION public.apparel_adjust_stock(
  _variant_id uuid,
  _delta numeric,
  _reason text,
  _ref_order_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.apparel_adjust_stock(uuid,numeric,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_adjust_stock(uuid,numeric,text,uuid,text) TO authenticated, service_role;

-- Devolução: gera vale-crédito e devolve item ao estoque
CREATE OR REPLACE FUNCTION public.apparel_return_item(
  _order_item_id uuid,
  _qty numeric,
  _mode text                -- 'credit' | 'refund'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.apparel_return_item(uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_return_item(uuid,numeric,text) TO authenticated, service_role;

-- Aplicar vale-crédito num pedido
CREATE OR REPLACE FUNCTION public.apparel_apply_credit(
  _credit_id uuid,
  _order_id uuid,
  _amount numeric
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.apparel_apply_credit(uuid,uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_apply_credit(uuid,uuid,numeric) TO authenticated, service_role;

-- Setar tipo de loja (dono da loja)
CREATE OR REPLACE FUNCTION public.apparel_set_store_type(_store_id uuid, _type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  IF _type NOT IN ('food','apparel') THEN RAISE EXCEPTION 'invalid_type'; END IF;
  UPDATE public.stores SET store_type = _type::public.store_type_enum, updated_at = now() WHERE id = _store_id;
END $$;
REVOKE ALL ON FUNCTION public.apparel_set_store_type(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apparel_set_store_type(uuid,text) TO authenticated, service_role;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.schema = await run(SQL_SCHEMA);
  out.rpcs = await run(SQL_RPCS);
  const ok = (out.schema as any).ok && (out.rpcs as any).ok;
  return new Response(JSON.stringify(out, null, 2), {
    status: ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});