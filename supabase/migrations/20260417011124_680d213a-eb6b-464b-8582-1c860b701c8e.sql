UPDATE public.orders
SET status = 'finalizado',
    confirmed_at = COALESCE(confirmed_at, now())
WHERE driver_id = '901e44d6-fc0e-487b-af03-f6460a2d60fa'
  AND status NOT IN ('finalizado', 'cancelado');