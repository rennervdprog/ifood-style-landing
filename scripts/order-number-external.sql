-- ============================================================
-- orders.order_number: número sequencial por loja (1, 2, 3...)
-- Rodar UMA vez no SQL Editor do Supabase EXTERNO.
-- Re-execução é segura (IF NOT EXISTS / OR REPLACE / IF NOT EXISTS no trigger).
-- ============================================================

-- 1) Coluna (nullable; backfill abaixo preenche o que faltar)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number bigint;

-- 2) Índice único por (store_id, order_number) — só onde já preenchido
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_store_order_number
  ON public.orders (store_id, order_number)
  WHERE order_number IS NOT NULL;

-- 3) Função: pega o próximo número da loja com lock pra não colidir em concorrência
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num bigint;
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lock por loja: pg_advisory_xact_lock baseado no hash do store_id
  PERFORM pg_advisory_xact_lock(hashtext(NEW.store_id::text));

  SELECT COALESCE(MAX(order_number), 0) + 1
    INTO next_num
    FROM public.orders
    WHERE store_id = NEW.store_id;

  NEW.order_number := next_num;
  RETURN NEW;
END;
$$;

-- 4) Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_set_order_number ON public.orders;
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number();

-- 5) Backfill: preenche pedidos antigos sem número (por loja, em ordem cronológica)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at, id) AS rn
    FROM public.orders
   WHERE order_number IS NULL
)
UPDATE public.orders o
   SET order_number = r.rn
  FROM ranked r
 WHERE o.id = r.id;

-- 6) (Opcional) NOT NULL após backfill — descomente se quiser garantir
-- ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;