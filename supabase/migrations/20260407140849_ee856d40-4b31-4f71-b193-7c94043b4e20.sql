
CREATE OR REPLACE FUNCTION public.admin_create_test_store(
  _name text,
  _category store_category
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
