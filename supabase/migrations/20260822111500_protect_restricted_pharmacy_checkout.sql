-- Proteção de checkout para catálogo de farmácias.
-- Itens classificados como dependentes de validação da farmácia, receita ou controle
-- permanecem visíveis no catálogo, mas não podem ser incluídos em pedidos comuns.

BEGIN;

-- Normaliza o contrato mínimo dos produtos já cadastrados em lojas que possuem a
-- categoria farmácias. Não classifica produtos clinicamente; apenas define o
-- modo de venda seguro para os itens já marcados como receita/controlados.
UPDATE public.products AS p
SET metadata = COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object(
  'pharma_type', COALESCE(NULLIF(p.metadata ->> 'pharma_type', ''), 'other'),
  'sale_mode', CASE
    WHEN COALESCE((p.metadata ->> 'requires_prescription')::boolean, false)
      OR COALESCE((p.metadata ->> 'controlled')::boolean, false)
      THEN 'pharmacy_validation'
    WHEN COALESCE(NULLIF(p.metadata ->> 'sale_mode', ''), '') IN ('platform_checkout', 'pharmacy_validation', 'not_available_app')
      THEN p.metadata ->> 'sale_mode'
    ELSE 'platform_checkout'
  END
)
FROM public.stores AS s
WHERE s.id = p.store_id
  AND (
    s.category = 'farmacias'::public.store_category
    OR 'farmacias'::public.store_category = ANY(COALESCE(s.categories, '{}'::public.store_category[]))
  );

CREATE OR REPLACE FUNCTION public.block_restricted_pharmacy_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metadata jsonb;
  v_is_pharmacy boolean;
  v_sale_mode text;
  v_requires_prescription boolean;
  v_controlled boolean;
BEGIN
  SELECT
    COALESCE(p.metadata, '{}'::jsonb),
    (
      s.category = 'farmacias'::public.store_category
      OR 'farmacias'::public.store_category = ANY(COALESCE(s.categories, '{}'::public.store_category[]))
    )
  INTO v_metadata, v_is_pharmacy
  FROM public.products AS p
  JOIN public.stores AS s ON s.id = p.store_id
  WHERE p.id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto do pedido não foi encontrado';
  END IF;

  IF NOT v_is_pharmacy THEN
    RETURN NEW;
  END IF;

  v_sale_mode := COALESCE(NULLIF(v_metadata ->> 'sale_mode', ''), 'platform_checkout');
  v_requires_prescription := COALESCE((v_metadata ->> 'requires_prescription')::boolean, false);
  v_controlled := COALESCE((v_metadata ->> 'controlled')::boolean, false);

  IF v_requires_prescription OR v_controlled OR v_sale_mode <> 'platform_checkout' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Este produto de farmácia exige validação da loja e não pode ser incluído no checkout pelo app.',
      DETAIL = 'O item permanece disponível para consulta no catálogo.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_restricted_pharmacy_order_item() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_block_restricted_pharmacy_order_item ON public.order_items;
CREATE TRIGGER trg_block_restricted_pharmacy_order_item
BEFORE INSERT OR UPDATE OF product_id ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.block_restricted_pharmacy_order_item();

COMMIT;
