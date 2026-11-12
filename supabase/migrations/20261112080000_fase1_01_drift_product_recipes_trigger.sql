-- ============================================================================
-- Fase 1 Estoque + Ficha Técnica — 01/06: DRIFT (versionamento, sem mudar
-- comportamento). Captura o que está vivo no banco e NÃO está no repo:
--   * tabela public.product_recipes (+ índices, RLS e policy);
--   * versão VIVA da função de trigger trg_decrement_stock_on_order_confirm
--     (+ o trigger trg_order_confirm_decrement_stock).
--
-- ATENÇÃO — NÃO reaplicar as migrations antigas do trigger:
-- 20261010131000_estoque_trigger_delivery.sql e
-- 20261010203000_trigger_pdv_columns.sql comparam NEW.status/OLD.status com
-- os literais 'confirmado' e 'pronto', que NÃO são rótulos válidos do enum
-- public.order_status (provado em 2026-11-12: SELECT 'confirmado'::order_status
-- => 22P02 invalid input value). Um redeploy a partir delas faria TODA
-- atualização de status de pedido falhar. A versão viva usa casts ::text e a
-- lista de exclusão com 'pronto_para_entrega' — é ela que este arquivo fixa.
--
-- DDL/fonte capturados do vivo em 2026-11-12 (projeto qkjhguziuchqsbxzruea;
-- função oid 44866). Aplicar em UMA transação (padrão do `supabase db push`).
-- Idempotente: re-aplicar é no-op (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela product_recipes (ficha técnica) — DDL vivo exato
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  ingredient_product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'un'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_recipes_pkey PRIMARY KEY (id),
  CONSTRAINT product_recipes_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products (id) ON DELETE CASCADE,
  CONSTRAINT product_recipes_ingredient_product_id_fkey
    FOREIGN KEY (ingredient_product_id) REFERENCES public.products (id) ON DELETE CASCADE,
  CONSTRAINT product_recipes_product_id_ingredient_product_id_key
    UNIQUE (product_id, ingredient_product_id),
  CONSTRAINT product_recipes_quantity_check CHECK (quantity > (0)::numeric),
  CONSTRAINT product_recipes_check CHECK (product_id <> ingredient_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product
  ON public.product_recipes USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_ingredient
  ON public.product_recipes USING btree (ingredient_product_id);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

-- Policy viva exata. Limitação conhecida (L-28, Fase 3): valida só a loja do
-- produto, não a do ingrediente. NÃO corrigir aqui — este arquivo só versiona.
DROP POLICY IF EXISTS store_owners_manage_recipes ON public.product_recipes;
CREATE POLICY store_owners_manage_recipes ON public.product_recipes
  FOR ALL TO public
  USING (product_id IN (
    SELECT products.id FROM public.products
    WHERE products.store_id IN (
      SELECT stores.id FROM public.stores WHERE stores.owner_id = auth.uid()
    )
  ))
  WITH CHECK (product_id IN (
    SELECT products.id FROM public.products
    WHERE products.store_id IN (
      SELECT stores.id FROM public.stores WHERE stores.owner_id = auth.uid()
    )
  ));

-- ---------------------------------------------------------------------------
-- 2. Função de trigger VIVA (verbatim, oid 44866) + trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_decrement_stock_on_order_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  v_ok boolean;
  v_is_pdv boolean := false;
BEGIN
  v_is_pdv := (NEW.pdv_session_id IS NOT NULL)
           OR (NEW.order_source = 'pdv')
           OR (NEW.metadata->>'pdv_session_id' IS NOT NULL)
           OR (NEW.metadata->>'source' = 'pdv');

  IF NOT v_is_pdv
     AND NEW.status::text IN ('pendente', 'preparando')
     AND (OLD.status IS NULL OR OLD.status::text NOT IN ('pendente', 'preparando', 'pronto_para_entrega', 'saiu_entrega', 'em_transito', 'entregue', 'finalizado')) THEN
    FOR item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
      SELECT public.stock_decrement_sale(item.product_id, item.quantity, NEW.id) INTO v_ok;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_order_confirm_decrement_stock ON public.orders;
CREATE TRIGGER trg_order_confirm_decrement_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_decrement_stock_on_order_confirm();

-- Grants vivos exatos (PUBLIC é o default de função nova; os explícitos abaixo
-- reproduzem o proacl vivo). A migração 04 restringe estes grants.
GRANT EXECUTE ON FUNCTION public.trg_decrement_stock_on_order_confirm()
  TO anon, authenticated, service_role;
