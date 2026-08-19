-- Corrige a permissão da view adicionada para expor plan_type.
-- O catálogo já contém apenas campos públicos; a junção com stores deve executar
-- com a permissão da view, pois visitantes anônimos não possuem SELECT direto na tabela stores.

BEGIN;

ALTER VIEW public.stores_public
  SET (security_invoker = false);

GRANT SELECT ON public.stores_public TO anon, authenticated;

COMMENT ON VIEW public.stores_public IS
  'Catálogo público de lojas com plan_type para ocultar lojas exclusivamente PDV no aplicativo cliente.';

COMMIT;
