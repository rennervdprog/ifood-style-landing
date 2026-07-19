// Fase 2 do PDV Boutique: atualiza admin_create_test_store pra aceitar _store_type,
// e garante RPC apparel_create_product_with_variants idempotente. Aplica no externo.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

const SQL = `
-- 1) Atualiza admin_create_test_store: aceita _store_type ('food'|'apparel')
DROP FUNCTION IF EXISTS public.admin_create_test_store(text, store_category, text);
DROP FUNCTION IF EXISTS public.admin_create_test_store(text, store_category, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_test_store(
  _name text,
  _category store_category,
  _plan_type text DEFAULT NULL,
  _store_type text DEFAULT 'food'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _store_id uuid;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar lojas de teste.';
  END IF;

  INSERT INTO public.stores (name, category, owner_id, status, slug, plan_type, is_visible, store_type)
  VALUES (
    _name, _category, auth.uid(), 'ativo',
    'test-' || lower(replace(_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 4),
    COALESCE(_plan_type, 'essencial'),
    CASE WHEN _plan_type = 'pdv_only' OR _store_type = 'apparel' THEN false ELSE true END,
    COALESCE(NULLIF(_store_type,'')::public.store_type_enum, 'food')
  )
  RETURNING id INTO _store_id;

  INSERT INTO public.menu_sections (store_id, name, sort_order)
  VALUES (_store_id, CASE WHEN _store_type='apparel' THEN 'Coleção' ELSE 'Destaques' END, 0);

  INSERT INTO public.opening_hours (store_id, day_of_week, is_closed_all_day, open_time, close_time)
  SELECT _store_id, d.day, false, '08:00', '23:00'
  FROM generate_series(0, 6) AS d(day);

  IF _plan_type = 'pdv_only' OR _store_type = 'apparel' THEN
    INSERT INTO public.store_addons (store_id, addon_code, enabled, price_override, activated_at)
    VALUES (_store_id, 'pdv', true, 0, now())
    ON CONFLICT (store_id, addon_code) DO UPDATE
      SET enabled = true, price_override = 0, cancels_at = NULL;
  END IF;

  RETURN _store_id;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_create_test_store(text, store_category, text, text) TO authenticated;

-- 2) RPC: criar modelo (produto pai) + variantes em uma transação
CREATE OR REPLACE FUNCTION public.apparel_create_product_with_variants(
  _store_id uuid,
  _name text,
  _price numeric,
  _section_id uuid,
  _image_url text,
  _variants jsonb  -- [{size,color,sku,barcode,stock_qty,price_override}]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;
GRANT EXECUTE ON FUNCTION public.apparel_create_product_with_variants(uuid, text, numeric, uuid, text, jsonb) TO authenticated;

-- 3) RPC: alterar tipo de loja (super admin)
CREATE OR REPLACE FUNCTION public.admin_set_store_type(_store_id uuid, _store_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  UPDATE public.stores SET store_type = _store_type::public.store_type_enum WHERE id = _store_id;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_set_store_type(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  const body = await r.text();
  return new Response(JSON.stringify({ ok: r.ok, status: r.status, body }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});