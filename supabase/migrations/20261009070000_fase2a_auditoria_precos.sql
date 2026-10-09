-- Fase 2a (app cliente) — MODO MONITORAMENTO de integridade de preços.
-- NÃO bloqueia nem altera nada: apenas REGISTRA divergências entre os valores
-- enviados pelo app e os valores reais no banco, para análise antes da Fase 2b.
--
-- O que é monitorado:
--   1. order_items.unit_price vs products.price (preço real do produto)
--   2. orders.delivery_fee vs stores.own_delivery_fee (taxa configurada da loja)
--
-- Após 1-2 semanas, consultar:
--   SELECT field_name, COUNT(*), AVG(ABS(difference))
--     FROM public.order_price_audit GROUP BY field_name;
-- Se as divergências forem ~zero ou só ruído legítimo, avançar para Fase 2b (correção).

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.order_price_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid NOT NULL,
  order_item_id uuid,
  field_name text NOT NULL CHECK (field_name IN ('unit_price', 'delivery_fee')),
  client_value numeric NOT NULL,
  real_value numeric NOT NULL,
  difference numeric GENERATED ALWAYS AS (client_value - real_value) STORED
);
CREATE INDEX IF NOT EXISTS idx_order_price_audit_checked
  ON public.order_price_audit (checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_price_audit_field
  ON public.order_price_audit (field_name);

-- RLS: só leitura para admins (escrita é via trigger SECURITY DEFINER)
ALTER TABLE public.order_price_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read price audit" ON public.order_price_audit;
CREATE POLICY "Admins can read price audit"
  ON public.order_price_audit FOR SELECT TO authenticated
  USING (public.has_role((select auth.uid()), 'admin'));

-- Função: audita unit_price vs products.price
CREATE OR REPLACE FUNCTION public.audit_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _real_price numeric;
BEGIN
  SELECT price INTO _real_price FROM public.products WHERE id = NEW.product_id;
  IF _real_price IS NOT NULL AND ABS(NEW.unit_price - _real_price) > 0.01 THEN
    INSERT INTO public.order_price_audit
      (order_id, order_item_id, field_name, client_value, real_value)
    VALUES
      (NEW.order_id, NEW.id, 'unit_price', NEW.unit_price, _real_price);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order_item_price ON public.order_items;
CREATE TRIGGER trg_audit_order_item_price
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_order_item_price();

-- Função: audita delivery_fee vs stores.own_delivery_fee
CREATE OR REPLACE FUNCTION public.audit_order_delivery_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _real_fee numeric;
BEGIN
  SELECT own_delivery_fee INTO _real_fee FROM public.stores WHERE id = NEW.store_id;
  IF _real_fee IS NOT NULL AND ABS(NEW.delivery_fee - _real_fee) > 0.01 THEN
    INSERT INTO public.order_price_audit
      (order_id, field_name, client_value, real_value)
    VALUES
      (NEW.id, 'delivery_fee', NEW.delivery_fee, _real_fee);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order_delivery_fee ON public.orders;
CREATE TRIGGER trg_audit_order_delivery_fee
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_order_delivery_fee();
