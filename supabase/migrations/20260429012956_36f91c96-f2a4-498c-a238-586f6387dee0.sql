CREATE OR REPLACE FUNCTION public.count_supporter_plans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO _count
  FROM public.store_plans
  WHERE plan_type = 'supporter' AND is_active = true;
  
  RETURN _count;
END;
$$;

-- Grant access to authenticated and anonymous users if necessary (it's a public count)
GRANT EXECUTE ON FUNCTION public.count_supporter_plans() TO anon, authenticated;