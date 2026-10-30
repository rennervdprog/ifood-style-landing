-- Fase 3 — correção da network_menu_divergence (bug achado no teste ao vivo).
--
-- A 170000 definia `refined` com 8 colunas (as 7 de `base` + `status`) e
-- `removed` com 7 — o UNION ALL quebrava com 42601 em TODA chamada
-- ("each UNION query must have the same number of columns"). Ou seja: o
-- modal "Sincronizar cardápio" do painel nunca funcionaria sem isto.
-- Correção: `removed` passa a selecionar 8 colunas na mesma ordem
-- (price_status placeholder + status), sem mudar nenhuma regra.
-- A 170000 JÁ foi aplicada ao vivo, por isso a correção vai nesta
-- migration nova (nunca se edita migration aplicada).

CREATE OR REPLACE FUNCTION public.network_menu_divergence(_source_store_id uuid, _target_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _src record;
  _tgt record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;

  SELECT * INTO _src FROM public.stores WHERE id = _source_store_id;
  SELECT * INTO _tgt FROM public.stores WHERE id = _target_store_id;
  IF _src.id IS NULL OR _tgt.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.'; END IF;

  IF _src.network_id IS NULL OR _src.network_id <> _tgt.network_id THEN
    RAISE EXCEPTION 'Lojas não pertencem à mesma rede.';
  END IF;
  IF _tgt.owner_id <> _uid AND NOT EXISTS (
    SELECT 1 FROM public.store_networks n WHERE n.id = _tgt.network_id AND n.owner_id = _uid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver esta unidade.';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        s.network_code,
        s.name AS product_name,
        s.price AS matriz_price,
        t.price AS subloja_price,
        t.last_synced_price,
        CASE
          WHEN t.id IS NULL THEN 'novo_na_matriz'
          WHEN t.price IS DISTINCT FROM s.price AND t.last_synced_price IS NOT NULL AND t.price <> t.last_synced_price THEN 'preco_proprio'
          WHEN t.price IS DISTINCT FROM s.price THEN 'desatualizado'
          ELSE 'ok'
        END AS price_status,
        CASE
          WHEN t.id IS NULL THEN '[]'::jsonb
          ELSE COALESCE((
            SELECT jsonb_agg(fname) FROM (
              VALUES
                ('name', t.name IS DISTINCT FROM s.name),
                ('description', t.description IS DISTINCT FROM s.description),
                ('image_url', t.image_url IS DISTINCT FROM s.image_url),
                ('is_available', t.is_available IS DISTINCT FROM s.is_available),
                ('section', (SELECT network_code FROM public.menu_sections WHERE id = t.section_id) IS DISTINCT FROM (SELECT network_code FROM public.menu_sections WHERE id = s.section_id))
            ) AS v(fname, diff) WHERE diff
          ), '[]'::jsonb)
        END AS changed_fields
      FROM public.products s
      LEFT JOIN public.products t ON t.store_id = _target_store_id AND t.network_code = s.network_code
      WHERE s.store_id = _source_store_id
    ),
    refined AS (
      SELECT *,
        CASE
          WHEN price_status = 'ok' AND jsonb_array_length(COALESCE(changed_fields, '[]'::jsonb)) > 0 THEN 'divergente'
          ELSE price_status
        END AS status
      FROM base
    ),
    removed AS (
      SELECT t.network_code, t.name AS product_name,
        NULL::numeric AS matriz_price, t.price AS subloja_price, t.last_synced_price,
        'removido_na_matriz' AS price_status, '[]'::jsonb AS changed_fields,
        'removido_na_matriz' AS status
      FROM public.products t
      WHERE t.store_id = _target_store_id AND t.last_synced_price IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.products s WHERE s.store_id = _source_store_id AND s.network_code = t.network_code)
    ),
    all_items AS (SELECT * FROM refined UNION ALL SELECT * FROM removed)
    SELECT jsonb_build_object(
      'source_store_id', _source_store_id,
      'target_store_id', _target_store_id,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'network_code', network_code,
          'product_name', product_name,
          'matriz_price', matriz_price,
          'subloja_price', subloja_price,
          'last_synced_price', last_synced_price,
          'status', status,
          'changed_fields', COALESCE(changed_fields, '[]'::jsonb)
        ) ORDER BY product_name)
        FROM all_items
      ), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.network_menu_divergence(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_menu_divergence(uuid, uuid) TO authenticated, service_role;
