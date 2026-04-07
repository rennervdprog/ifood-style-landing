
CREATE OR REPLACE FUNCTION public.admin_approve_partner(_profile_user_id uuid, _approved boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
