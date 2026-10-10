-- Controle de estoque: tabelas product_stock e stock_movements + RPCs + RLS
-- Decisões (2026-10-10, Renner):
--  1. Bloquear venda sem estoque no PDV; só avisar no delivery
--  2. Vitrine mostra "Esgotado" (não oculta)
--  3. Baixa no pedido confirmado (pagamento aprovado)
--  4. Fornecedor/ordem de compra fica para fase futura

-- ─── Tabela: estoque por produto ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  track_stock boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_stock_store ON public.product_stock(store_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_low
  ON public.product_stock(store_id) WHERE track_stock = true;

-- ─── Tabela: histórico de movimentações ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out','adjust','sale','loss','return')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  balance_after numeric NOT NULL CHECK (balance_after >= 0),
  reason text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_store ON public.stock_movements(store_id, created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages product_stock" ON public.product_stock;
CREATE POLICY "Owner manages product_stock"
  ON public.product_stock FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = product_stock.store_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = product_stock.store_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner manages stock_movements" ON public.stock_movements;
CREATE POLICY "Owner manages stock_movements"
  ON public.stock_movements FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = stock_movements.store_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = stock_movements.store_id AND s.owner_id = auth.uid())
  );

-- ─── RPC: ajuste manual de estoque ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stock_adjust(
  _product_id uuid,
  _quantity numeric,
  _type text, -- 'in' | 'out' | 'adjust' | 'loss'
  _reason text DEFAULT NULL
)
RETURNS public.product_stock
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_row public.product_stock;
  v_new_qty numeric;
BEGIN
  IF _type NOT IN ('in','out','adjust','loss') THEN
    RAISE EXCEPTION 'Tipo inválido: %', _type;
  END IF;
  IF _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  SELECT store_id INTO v_store_id FROM public.products WHERE id = _product_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.product_stock (product_id, store_id, quantity, track_stock)
  VALUES (_product_id, v_store_id, 0, true)
  ON CONFLICT (product_id) DO UPDATE SET track_stock = true
  RETURNING * INTO v_row;

  v_new_qty := CASE
    WHEN _type = 'in' THEN v_row.quantity + _quantity
    WHEN _type = 'adjust' THEN _quantity
    ELSE GREATEST(0, v_row.quantity - _quantity)
  END;

  UPDATE public.product_stock
     SET quantity = v_new_qty, updated_at = now(), track_stock = true
   WHERE product_id = _product_id
  RETURNING * INTO v_row;

  INSERT INTO public.stock_movements
    (product_id, store_id, type, quantity, balance_after, reason, created_by)
  VALUES
    (_product_id, v_store_id, _type, _quantity, v_new_qty, _reason, auth.uid());

  RETURN v_row;
END;
$function$;

-- ─── RPC: baixa de estoque por venda ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stock_decrement_sale(
  _product_id uuid,
  _quantity numeric,
  _order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.product_stock;
  v_new_qty numeric;
BEGIN
  SELECT * INTO v_row FROM public.product_stock WHERE product_id = _product_id;
  -- Produto sem controle de estoque: permite a venda
  IF v_row IS NULL OR NOT v_row.track_stock THEN RETURN true; END IF;

  IF v_row.quantity < _quantity THEN RETURN false; END IF;

  v_new_qty := v_row.quantity - _quantity;
  UPDATE public.product_stock
     SET quantity = v_new_qty, updated_at = now()
   WHERE product_id = _product_id;

  INSERT INTO public.stock_movements
    (product_id, store_id, type, quantity, balance_after, order_id, created_by)
  VALUES
    (_product_id, v_row.store_id, 'sale', _quantity, v_new_qty, _order_id, auth.uid());

  -- Marca esgotado no metadata quando zera
  IF v_new_qty <= 0 THEN
    UPDATE public.products
       SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"out_of_stock": true}'::jsonb
     WHERE id = _product_id;
  END IF;

  RETURN true;
END;
$function$;

-- ─── RPC: define estoque mínimo (alerta) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stock_set_min(
  _product_id uuid,
  _min_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT store_id INTO v_store_id FROM public.products WHERE id = _product_id;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.product_stock (product_id, store_id, min_quantity, track_stock)
  VALUES (_product_id, v_store_id, GREATEST(0, _min_quantity), true)
  ON CONFLICT (product_id) DO UPDATE
    SET min_quantity = GREATEST(0, _min_quantity), track_stock = true, updated_at = now();
END;
$function$;

-- ─── RPC: ativa/desativa controle por produto ───────────────────────────────
CREATE OR REPLACE FUNCTION public.stock_toggle_tracking(
  _product_id uuid,
  _track boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT store_id INTO v_store_id FROM public.products WHERE id = _product_id;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.product_stock (product_id, store_id, track_stock)
  VALUES (_product_id, v_store_id, _track)
  ON CONFLICT (product_id) DO UPDATE
    SET track_stock = _track, updated_at = now();
END;
$function$;

-- ─── RPC: produtos com estoque baixo ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_low_stock_products(_store_id uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  quantity numeric,
  min_quantity numeric,
  is_zero boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ps.product_id,
    p.name,
    ps.quantity,
    ps.min_quantity,
    (ps.quantity <= 0) AS is_zero
  FROM public.product_stock ps
  JOIN public.products p ON p.id = ps.product_id
  WHERE ps.store_id = _store_id
    AND ps.track_stock = true
    AND ps.quantity <= ps.min_quantity
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid())
  ORDER BY ps.quantity ASC;
$function$;

REVOKE ALL ON FUNCTION public.stock_adjust(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_adjust(uuid, numeric, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.stock_decrement_sale(uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_decrement_sale(uuid, numeric, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.stock_set_min(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_set_min(uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.stock_toggle_tracking(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_toggle_tracking(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.get_low_stock_products(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_low_stock_products(uuid) TO authenticated;
