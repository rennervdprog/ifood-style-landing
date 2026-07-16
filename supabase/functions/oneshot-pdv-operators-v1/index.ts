const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  out.ext = await run(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  out.table_ops = await run(`
    CREATE TABLE IF NOT EXISTS public.pdv_operators (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pdv_operators_store_idx ON public.pdv_operators(store_id) WHERE active;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_operators TO authenticated;
    GRANT ALL ON public.pdv_operators TO service_role;
    ALTER TABLE public.pdv_operators ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "operators_owner_all" ON public.pdv_operators;
    CREATE POLICY "operators_owner_all" ON public.pdv_operators
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
  `);

  out.table_cancel = await run(`
    CREATE TABLE IF NOT EXISTS public.pdv_sale_cancellations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL,
      order_id UUID NOT NULL,
      session_id UUID,
      operator_id UUID,
      operator_name TEXT,
      reason TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      canceled_by UUID,
      canceled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pdv_sale_cancellations_store_idx ON public.pdv_sale_cancellations(store_id, canceled_at DESC);
    CREATE INDEX IF NOT EXISTS pdv_sale_cancellations_order_idx ON public.pdv_sale_cancellations(order_id);
    GRANT SELECT, INSERT ON public.pdv_sale_cancellations TO authenticated;
    GRANT ALL ON public.pdv_sale_cancellations TO service_role;
    ALTER TABLE public.pdv_sale_cancellations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "cancel_owner_read" ON public.pdv_sale_cancellations;
    CREATE POLICY "cancel_owner_read" ON public.pdv_sale_cancellations
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
  `);

  out.rpc_list = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_list_operators(_store_id UUID)
    RETURNS TABLE(id UUID, name TEXT, active BOOLEAN, created_at TIMESTAMPTZ)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      RETURN QUERY SELECT o.id, o.name, o.active, o.created_at
        FROM public.pdv_operators o WHERE o.store_id = _store_id
        ORDER BY o.active DESC, o.created_at ASC;
    END; $$;
    GRANT EXECUTE ON FUNCTION public.pdv_list_operators(UUID) TO authenticated;
  `);

  out.rpc_upsert = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_upsert_operator(_store_id UUID, _id UUID, _name TEXT, _pin TEXT)
    RETURNS UUID
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE _new_id UUID; _hash TEXT;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      IF _name IS NULL OR length(trim(_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
      IF _pin IS NOT NULL AND (length(_pin) < 4 OR length(_pin) > 8 OR _pin !~ '^[0-9]+$') THEN
        RAISE EXCEPTION 'invalid_pin';
      END IF;
      IF _id IS NULL THEN
        IF _pin IS NULL THEN RAISE EXCEPTION 'pin_required'; END IF;
        _hash := crypt(_pin, gen_salt('bf'));
        INSERT INTO public.pdv_operators(store_id, name, pin_hash, created_by)
          VALUES (_store_id, trim(_name), _hash, auth.uid())
          RETURNING id INTO _new_id;
        RETURN _new_id;
      ELSE
        IF _pin IS NOT NULL THEN
          _hash := crypt(_pin, gen_salt('bf'));
          UPDATE public.pdv_operators SET name=trim(_name), pin_hash=_hash, updated_at=NOW()
            WHERE id=_id AND store_id=_store_id;
        ELSE
          UPDATE public.pdv_operators SET name=trim(_name), updated_at=NOW()
            WHERE id=_id AND store_id=_store_id;
        END IF;
        RETURN _id;
      END IF;
    END; $$;
    GRANT EXECUTE ON FUNCTION public.pdv_upsert_operator(UUID,UUID,TEXT,TEXT) TO authenticated;
  `);

  out.rpc_toggle = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_set_operator_active(_store_id UUID, _id UUID, _active BOOLEAN)
    RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      UPDATE public.pdv_operators SET active=_active, updated_at=NOW() WHERE id=_id AND store_id=_store_id;
      RETURN true;
    END; $$;
    GRANT EXECUTE ON FUNCTION public.pdv_set_operator_active(UUID,UUID,BOOLEAN) TO authenticated;
  `);

  out.rpc_verify = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_verify_operator_pin(_store_id UUID, _pin TEXT)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE _row RECORD;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'forbidden';
      END IF;
      IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN RETURN jsonb_build_object('ok',false,'error','invalid_pin'); END IF;
      SELECT id, name INTO _row FROM public.pdv_operators
        WHERE store_id=_store_id AND active=true AND pin_hash = crypt(_pin, pin_hash) LIMIT 1;
      IF _row.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','pin_mismatch'); END IF;
      RETURN jsonb_build_object('ok',true,'operator_id',_row.id,'operator_name',_row.name);
    END; $$;
    GRANT EXECUTE ON FUNCTION public.pdv_verify_operator_pin(UUID,TEXT) TO authenticated;
  `);

  out.rpc_cancel = await run(`
    CREATE OR REPLACE FUNCTION public.pdv_cancel_sale(_order_id UUID, _pin TEXT, _reason TEXT)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      _order RECORD;
      _op RECORD;
    BEGIN
      SELECT o.id, o.store_id, o.pdv_session_id, o.total_price, o.status
        INTO _order FROM public.orders o WHERE o.id = _order_id;
      IF _order.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
      IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _order.store_id AND s.owner_id = auth.uid()) THEN
        RETURN jsonb_build_object('ok',false,'error','forbidden');
      END IF;
      IF _order.status = 'cancelado' THEN RETURN jsonb_build_object('ok',false,'error','already_canceled'); END IF;
      IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RETURN jsonb_build_object('ok',false,'error','reason_required'); END IF;

      SELECT id, name INTO _op FROM public.pdv_operators
        WHERE store_id=_order.store_id AND active=true AND pin_hash = crypt(_pin, pin_hash) LIMIT 1;
      IF _op.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','pin_mismatch'); END IF;

      UPDATE public.orders
        SET status = 'cancelado',
            metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
              'canceled_at', NOW(),
              'canceled_reason', _reason,
              'canceled_by_operator', _op.name,
              'canceled_by_user', auth.uid()
            ),
            updated_at = NOW()
        WHERE id = _order_id;

      IF _order.pdv_session_id IS NOT NULL THEN
        INSERT INTO public.pdv_movements(session_id, store_id, type, amount, payment_method, description, order_id, created_by)
          VALUES (_order.pdv_session_id, _order.store_id, 'cancellation',
                  -1 * COALESCE(_order.total_price,0), NULL,
                  'Cancelamento: ' || _reason || ' (op: ' || _op.name || ')',
                  _order_id, auth.uid());
      END IF;

      INSERT INTO public.pdv_sale_cancellations(store_id, order_id, session_id, operator_id, operator_name, reason, amount, canceled_by)
        VALUES (_order.store_id, _order_id, _order.pdv_session_id, _op.id, _op.name, _reason, COALESCE(_order.total_price,0), auth.uid());

      INSERT INTO public.admin_logs(action, metadata)
        VALUES ('pdv_sale_canceled', jsonb_build_object(
          'order_id', _order_id, 'store_id', _order.store_id, 'operator', _op.name,
          'reason', _reason, 'amount', _order.total_price
        ));

      RETURN jsonb_build_object('ok',true,'operator_name',_op.name);
    END; $$;
    GRANT EXECUTE ON FUNCTION public.pdv_cancel_sale(UUID,TEXT,TEXT) TO authenticated;
  `);

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});