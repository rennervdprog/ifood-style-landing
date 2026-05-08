
-- ─── ORDERS: campos do PDV ────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pdv_session_id uuid,
  ADD COLUMN IF NOT EXISTS table_identifier text,
  ADD COLUMN IF NOT EXISTS pdv_discount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments jsonb;

-- ─── PDV_SESSIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pdv_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  opened_by uuid NOT NULL,
  closed_by uuid,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  closing_difference numeric DEFAULT 0,
  closing_method text DEFAULT 'open',         -- 'open' | 'blind'
  denomination_count jsonb,                    -- { "200": 1, "100": 3, ... }
  status text NOT NULL DEFAULT 'open',         -- 'open' | 'closed'
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS pdv_sessions_store_status_idx
  ON public.pdv_sessions (store_id, status, opened_at DESC);

ALTER TABLE public.pdv_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owner manages own pdv sessions" ON public.pdv_sessions;
CREATE POLICY "Store owner manages own pdv sessions"
ON public.pdv_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_sessions.store_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_sessions.store_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- ─── PDV_MOVEMENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pdv_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pdv_sessions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  type text NOT NULL,                          -- 'sale' | 'sangria' | 'suprimento' | 'refund'
  amount numeric NOT NULL,
  payment_method text,                         -- 'dinheiro' | 'maquininha_credito' | ...
  description text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS pdv_movements_session_idx
  ON public.pdv_movements (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pdv_movements_store_type_idx
  ON public.pdv_movements (store_id, type, created_at DESC);

ALTER TABLE public.pdv_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owner manages own pdv movements" ON public.pdv_movements;
CREATE POLICY "Store owner manages own pdv movements"
ON public.pdv_movements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_movements.store_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = pdv_movements.store_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- ─── FUNCTION: get_pdv_session_summary ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pdv_session_summary(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_sales numeric;
  total_orders integer;
  by_payment jsonb;
BEGIN
  -- valida acesso: dono da loja do turno OU admin
  IF NOT EXISTS (
    SELECT 1
    FROM public.pdv_sessions ps
    JOIN public.stores s ON s.id = ps.store_id
    WHERE ps.id = _session_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ) THEN
    RAISE EXCEPTION 'Access denied to session %', _session_id;
  END IF;

  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO total_sales, total_orders
  FROM public.pdv_movements
  WHERE session_id = _session_id AND type = 'sale';

  SELECT COALESCE(jsonb_object_agg(payment_method, total), '{}'::jsonb)
  INTO by_payment
  FROM (
    SELECT payment_method, SUM(amount) AS total
    FROM public.pdv_movements
    WHERE session_id = _session_id AND type = 'sale' AND payment_method IS NOT NULL
    GROUP BY payment_method
  ) t;

  result := jsonb_build_object(
    'total_sales', total_sales,
    'total_orders', total_orders,
    'by_payment', by_payment
  );

  RETURN result;
END;
$$;
