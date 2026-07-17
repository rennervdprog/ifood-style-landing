// One-shot: Fase B do PDV — cria tabelas pdv_tables / pdv_tabs / pdv_tab_items,
// adiciona orders.pdv_tab_id e cria RPCs open/add/remove/transfer/cancel/close_tab.
// Idempotente: pode rodar quantas vezes quiser.

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
-- pdv_tables
CREATE TABLE IF NOT EXISTS public.pdv_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text NOT NULL,
  seats int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied','billing')),
  sort_order int NOT NULL DEFAULT 0,
  opened_at timestamptz,
  opened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pdv_tables_store_label_uniq ON public.pdv_tables (store_id, lower(label));
CREATE INDEX IF NOT EXISTS pdv_tables_store_status_idx ON public.pdv_tables (store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_tables TO authenticated;
GRANT ALL ON public.pdv_tables TO service_role;
ALTER TABLE public.pdv_tables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pdv_tables' AND policyname='pdv_tables_owner_all') THEN
    CREATE POLICY "pdv_tables_owner_all" ON public.pdv_tables
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = pdv_tables.store_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = pdv_tables.store_id AND s.owner_id = auth.uid()));
  END IF;
END $$;

-- pdv_tabs
CREATE TABLE IF NOT EXISTS public.pdv_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.pdv_tables(id) ON DELETE SET NULL,
  code text,
  customer_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','canceled')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid,
  order_id uuid,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pdv_tabs_store_code_open_uniq
  ON public.pdv_tabs (store_id, code) WHERE status = 'open' AND code IS NOT NULL;
CREATE INDEX IF NOT EXISTS pdv_tabs_store_status_idx ON public.pdv_tabs (store_id, status);
CREATE INDEX IF NOT EXISTS pdv_tabs_table_idx ON public.pdv_tabs (table_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_tabs TO authenticated;
GRANT ALL ON public.pdv_tabs TO service_role;
ALTER TABLE public.pdv_tabs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pdv_tabs' AND policyname='pdv_tabs_owner_all') THEN
    CREATE POLICY "pdv_tabs_owner_all" ON public.pdv_tabs
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = pdv_tabs.store_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = pdv_tabs.store_id AND s.owner_id = auth.uid()));
  END IF;
END $$;

-- pdv_tab_items
CREATE TABLE IF NOT EXISTS public.pdv_tab_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES public.pdv_tabs(id) ON DELETE CASCADE,
  product_id uuid,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  addons jsonb,
  observations text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS pdv_tab_items_tab_idx ON public.pdv_tab_items (tab_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_tab_items TO authenticated;
GRANT ALL ON public.pdv_tab_items TO service_role;
ALTER TABLE public.pdv_tab_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pdv_tab_items' AND policyname='pdv_tab_items_owner_all') THEN
    CREATE POLICY "pdv_tab_items_owner_all" ON public.pdv_tab_items
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.pdv_tabs t
        JOIN public.stores s ON s.id = t.store_id
        WHERE t.id = pdv_tab_items.tab_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.pdv_tabs t
        JOIN public.stores s ON s.id = t.store_id
        WHERE t.id = pdv_tab_items.tab_id AND s.owner_id = auth.uid()));
  END IF;
END $$;

-- orders.pdv_tab_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pdv_tab_id uuid;
CREATE INDEX IF NOT EXISTS orders_pdv_tab_idx ON public.orders (pdv_tab_id) WHERE pdv_tab_id IS NOT NULL;
`;

const SQL_RPCS = `
-- helper: verifica se auth.uid() é dono da store
CREATE OR REPLACE FUNCTION public.pdv_assert_store_owner(_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.pdv_assert_store_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_assert_store_owner(uuid) TO authenticated, service_role;

-- Abrir comanda
CREATE OR REPLACE FUNCTION public.pdv_open_tab(
  _store_id uuid,
  _table_id uuid DEFAULT NULL,
  _code text DEFAULT NULL,
  _customer_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tab_id uuid; _tstatus text;
BEGIN
  PERFORM public.pdv_assert_store_owner(_store_id);
  IF _table_id IS NOT NULL THEN
    SELECT status INTO _tstatus FROM public.pdv_tables WHERE id=_table_id AND store_id=_store_id FOR UPDATE;
    IF _tstatus IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;
    IF _tstatus <> 'free' THEN RAISE EXCEPTION 'table_not_free'; END IF;
    UPDATE public.pdv_tables
       SET status='occupied', opened_at=now(), opened_by=auth.uid(), updated_at=now()
     WHERE id=_table_id;
  END IF;
  INSERT INTO public.pdv_tabs(store_id, table_id, code, customer_name, opened_by)
    VALUES (_store_id, _table_id, NULLIF(_code,''), NULLIF(_customer_name,''), auth.uid())
    RETURNING id INTO _tab_id;
  RETURN _tab_id;
END $$;
REVOKE ALL ON FUNCTION public.pdv_open_tab(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_open_tab(uuid,uuid,text,text) TO authenticated, service_role;

-- Adicionar item na comanda
CREATE OR REPLACE FUNCTION public.pdv_add_tab_item(
  _tab_id uuid,
  _product_id uuid,
  _name text,
  _quantity numeric,
  _unit_price numeric,
  _addons jsonb DEFAULT NULL,
  _observations text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid; _item_id uuid; _st text;
BEGIN
  SELECT store_id, status INTO _store, _st FROM public.pdv_tabs WHERE id=_tab_id;
  IF _store IS NULL THEN RAISE EXCEPTION 'tab_not_found'; END IF;
  IF _st <> 'open' THEN RAISE EXCEPTION 'tab_not_open'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);
  INSERT INTO public.pdv_tab_items(tab_id, product_id, name, quantity, unit_price, addons, observations, metadata, created_by)
    VALUES (_tab_id, _product_id, _name, COALESCE(_quantity,1), _unit_price, _addons, NULLIF(_observations,''), _metadata, auth.uid())
    RETURNING id INTO _item_id;
  UPDATE public.pdv_tabs SET updated_at=now() WHERE id=_tab_id;
  RETURN _item_id;
END $$;
REVOKE ALL ON FUNCTION public.pdv_add_tab_item(uuid,uuid,text,numeric,numeric,jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_add_tab_item(uuid,uuid,text,numeric,numeric,jsonb,text,jsonb) TO authenticated, service_role;

-- Remover item
CREATE OR REPLACE FUNCTION public.pdv_remove_tab_item(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid;
BEGIN
  SELECT t.store_id INTO _store FROM public.pdv_tab_items i
    JOIN public.pdv_tabs t ON t.id = i.tab_id WHERE i.id = _item_id;
  IF _store IS NULL THEN RAISE EXCEPTION 'item_not_found'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);
  DELETE FROM public.pdv_tab_items WHERE id=_item_id;
END $$;
REVOKE ALL ON FUNCTION public.pdv_remove_tab_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_remove_tab_item(uuid) TO authenticated, service_role;

-- Transferir comanda para outra mesa
CREATE OR REPLACE FUNCTION public.pdv_transfer_tab(_tab_id uuid, _new_table_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid; _old_table uuid; _new_status text;
BEGIN
  SELECT store_id, table_id INTO _store, _old_table FROM public.pdv_tabs WHERE id=_tab_id AND status='open';
  IF _store IS NULL THEN RAISE EXCEPTION 'tab_not_found_or_closed'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);
  IF _new_table_id IS NOT NULL THEN
    SELECT status INTO _new_status FROM public.pdv_tables WHERE id=_new_table_id AND store_id=_store FOR UPDATE;
    IF _new_status IS NULL THEN RAISE EXCEPTION 'new_table_not_found'; END IF;
    IF _new_status <> 'free' THEN RAISE EXCEPTION 'new_table_not_free'; END IF;
    UPDATE public.pdv_tables SET status='occupied', opened_at=now(), opened_by=auth.uid(), updated_at=now()
     WHERE id=_new_table_id;
  END IF;
  IF _old_table IS NOT NULL THEN
    UPDATE public.pdv_tables SET status='free', opened_at=NULL, opened_by=NULL, updated_at=now()
     WHERE id=_old_table;
  END IF;
  UPDATE public.pdv_tabs SET table_id=_new_table_id, updated_at=now() WHERE id=_tab_id;
END $$;
REVOKE ALL ON FUNCTION public.pdv_transfer_tab(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_transfer_tab(uuid,uuid) TO authenticated, service_role;

-- Cancelar comanda
CREATE OR REPLACE FUNCTION public.pdv_cancel_tab(_tab_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid; _table uuid;
BEGIN
  SELECT store_id, table_id INTO _store, _table FROM public.pdv_tabs WHERE id=_tab_id AND status='open';
  IF _store IS NULL THEN RAISE EXCEPTION 'tab_not_found_or_closed'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);
  UPDATE public.pdv_tabs SET status='canceled', closed_at=now(), cancel_reason=NULLIF(_reason,''), updated_at=now()
   WHERE id=_tab_id;
  IF _table IS NOT NULL THEN
    UPDATE public.pdv_tables SET status='free', opened_at=NULL, opened_by=NULL, updated_at=now() WHERE id=_table;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.pdv_cancel_tab(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_cancel_tab(uuid,text) TO authenticated, service_role;

-- Fechar comanda: gera 1 order + pdv_movements a partir dos itens acumulados
CREATE OR REPLACE FUNCTION public.pdv_close_tab(
  _tab_id uuid,
  _session_id uuid,
  _payments jsonb,
  _pdv_discount numeric DEFAULT 0,
  _commission_rate numeric DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _store uuid; _table uuid; _table_label text;
  _subtotal numeric := 0; _total numeric; _discount numeric := COALESCE(_pdv_discount,0);
  _order_id uuid; _primary_method text; _payment jsonb; _item RECORD;
  _session_open boolean;
BEGIN
  SELECT t.store_id, t.table_id INTO _store, _table
    FROM public.pdv_tabs t WHERE t.id=_tab_id AND t.status='open';
  IF _store IS NULL THEN RAISE EXCEPTION 'tab_not_found_or_closed'; END IF;
  PERFORM public.pdv_assert_store_owner(_store);

  SELECT (status='open') INTO _session_open FROM public.pdv_sessions WHERE id=_session_id;
  IF _session_open IS NOT TRUE THEN RAISE EXCEPTION 'session_not_open'; END IF;

  IF _table IS NOT NULL THEN
    SELECT label INTO _table_label FROM public.pdv_tables WHERE id=_table;
  END IF;

  SELECT COALESCE(SUM(quantity * unit_price),0) INTO _subtotal FROM public.pdv_tab_items WHERE tab_id=_tab_id;
  IF _subtotal <= 0 THEN RAISE EXCEPTION 'empty_tab'; END IF;
  _total := GREATEST(_subtotal - _discount, 0);

  IF _payments IS NULL OR jsonb_array_length(_payments) = 0 THEN
    RAISE EXCEPTION 'no_payments';
  END IF;
  SELECT (_payments->0->>'method') INTO _primary_method;

  INSERT INTO public.orders (
    store_id, client_id, order_source, pdv_session_id, pdv_tab_id, table_identifier,
    subtotal, delivery_fee, pdv_discount, commission_rate, total_price,
    app_fee, payment_method, payments, neighborhood, address_details, status
  ) VALUES (
    _store, NULL, 'pdv', _session_id, _tab_id, _table_label,
    _subtotal, 0, _discount, COALESCE(_commission_rate,0), _total,
    0, _primary_method, _payments, 'Balcão',
    COALESCE(_table_label || ' — Comanda', 'Comanda PDV'),
    'finalizado'
  ) RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM public.pdv_tab_items WHERE tab_id=_tab_id LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, addons, observations, metadata)
      VALUES (_order_id, _item.product_id, _item.quantity, _item.unit_price,
              _item.addons, _item.observations, _item.metadata);
  END LOOP;

  FOR _payment IN SELECT * FROM jsonb_array_elements(_payments) LOOP
    INSERT INTO public.pdv_movements (session_id, store_id, type, amount, payment_method, description, order_id, created_by)
    VALUES (_session_id, _store, 'sale', (_payment->>'amount')::numeric, _payment->>'method',
            COALESCE(_table_label, 'Comanda') || ' — Fechamento', _order_id, auth.uid());
  END LOOP;

  UPDATE public.pdv_tabs SET status='closed', closed_at=now(), order_id=_order_id, updated_at=now() WHERE id=_tab_id;
  IF _table IS NOT NULL THEN
    UPDATE public.pdv_tables SET status='free', opened_at=NULL, opened_by=NULL, updated_at=now() WHERE id=_table;
  END IF;

  RETURN _order_id;
END $$;
REVOKE ALL ON FUNCTION public.pdv_close_tab(uuid,uuid,jsonb,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pdv_close_tab(uuid,uuid,jsonb,numeric,numeric) TO authenticated, service_role;
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