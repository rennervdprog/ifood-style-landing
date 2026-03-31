CREATE UNIQUE INDEX IF NOT EXISTS ux_withdrawal_requests_one_active_per_driver
ON public.withdrawal_requests (driver_user_id)
WHERE status = 'solicitado';

CREATE UNIQUE INDEX IF NOT EXISTS ux_withdrawal_requests_transaction_code
ON public.withdrawal_requests (transaction_code)
WHERE transaction_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_withdrawals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode limpar duplicatas.';
  END IF;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY driver_user_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.withdrawal_requests
    WHERE status = 'solicitado'
  ), deleted AS (
    DELETE FROM public.withdrawal_requests wr
    USING ranked r
    WHERE wr.id = r.id
      AND r.rn > 1
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;