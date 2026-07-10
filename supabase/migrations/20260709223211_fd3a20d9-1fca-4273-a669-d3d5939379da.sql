CREATE OR REPLACE FUNCTION public.admin_create_test_store(
  _name text,
  _category store_category,
  _plan_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_id uuid;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar lojas de teste.';
  END IF;

  INSERT INTO public.stores (name, category, owner_id, status, slug, plan_type, is_visible)
  VALUES (
    _name,
    _category,
    auth.uid(),
    'ativo',
    'test-' || lower(replace(_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 4),
    COALESCE(_plan_type, 'essencial'),
    CASE WHEN _plan_type = 'pdv_only' THEN false ELSE true END
  )
  RETURNING id INTO _store_id;

  INSERT INTO public.menu_sections (store_id, name, sort_order)
  VALUES (_store_id, 'Destaques', 0);

  INSERT INTO public.opening_hours (store_id, day_of_week, is_closed_all_day, open_time, close_time)
  SELECT _store_id, d.day, false, '08:00', '23:00'
  FROM generate_series(0, 6) AS d(day);

  -- Se for plano Somente PDV, ativa o add-on PDV embutido (preço 0)
  IF _plan_type = 'pdv_only' THEN
    INSERT INTO public.store_addons (store_id, addon_code, enabled, price_override, activated_at)
    VALUES (_store_id, 'pdv', true, 0, now())
    ON CONFLICT (store_id, addon_code) DO UPDATE
      SET enabled = true, price_override = 0, cancels_at = NULL;
  END IF;

  RETURN _store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_test_store(text, store_category, text) TO authenticated;