-- Fase 2 (vitrines): produto indisponível e preço zero fora da vitrine.
--
-- (a) store_bootstrap passa a esconder produtos indisponíveis (is_available=false)
--     ou ocultos (metadata.hidden=true) do payload da vitrine. Corpo copiado
--     verbatim da definição ao vivo; só o WHERE dos produtos mudou.
--     Não filtra preço aqui: preço zero é problema de cadastro e o
--     front/checkout barram a venda (abaixo + trigger).
--     Efeito medido antes: Pastelão 68 -> 67 produtos; Bittenca's 42 -> 28;
--     Silvia -3; Loja Demonstração -2.
-- (b) Trigger em order_items: trava que vale para TODOS os caminhos
--     (checkout logado, guest, bot, app, PDV, API).
--
-- Regra da trigger (mais estreita que "bloquear tudo", pelos dados):
--  * Preço do ITEM <= 0: bloqueado em TODOS os canais. Não existe
--    brinde/cortesia com preço zero hoje (0/542 itens históricos têm
--    unit_price <= 0). O PDV vende produto de preço 0 de catálogo com
--    preço real na hora (ex.: "A VONTADE" R$ 10-82, "PRATO FEITO" R$ 25),
--    por isso a trava é no preço do item, não no preço do produto.
--  * Produto indisponível/oculto: bloqueado nos canais de autoatendimento
--    (delivery, guest, bot, app). No balcão (pdv/manual) o operador está
--    presente e usa produtos de teste e preço de balcão (ex.: "Produto
--    Teste Desconto", 31 itens) — esses fluxos não são bloqueados aqui;
--    a vitrine já não oferece o produto.

CREATE OR REPLACE FUNCTION public.store_bootstrap(_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH s AS (
    SELECT *
    FROM public.get_public_stores()
    WHERE slug = _slug
       OR id::text = _slug
       OR _slug = ANY(slug_aliases)
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'store', (SELECT to_jsonb(s) FROM s),
    'hours', COALESCE((
      SELECT jsonb_agg(to_jsonb(h.*))
      FROM public.opening_hours AS h
      WHERE h.store_id = (SELECT id FROM s)
    ), '[]'::jsonb),
    'sections', COALESCE((
      SELECT jsonb_agg(to_jsonb(sec.*) ORDER BY sec.sort_order)
      FROM public.menu_sections AS sec
      WHERE sec.store_id = (SELECT id FROM s)
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*))
      FROM public.products AS p
      WHERE p.store_id = (SELECT id FROM s)
        AND p.is_available IS NOT FALSE
        AND COALESCE((p.metadata->'hidden')::boolean, false) = false
    ), '[]'::jsonb),
    'owner_profile', (
      SELECT jsonb_build_object('id', pr.id, 'whatsapp_number', pr.whatsapp_number)
      FROM public.profiles AS pr
      WHERE pr.user_id = (SELECT owner_id FROM s)
    ),
    'online_drivers_count', COALESCE((
      SELECT public.store_active_drivers_count((SELECT id FROM s))
    ), 0)
  );
$function$;

CREATE OR REPLACE FUNCTION public.validate_order_item_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_available boolean;
  v_hidden boolean;
  v_source text;
BEGIN
  -- (1) Preço do item zero ou negativo: nunca é uma venda legítima.
  IF NEW.unit_price IS NULL OR NEW.unit_price <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'O item do pedido precisa ter preço maior que zero.';
  END IF;

  -- Linha avulsa sem produto vinculado: só vale a trava de preço acima.
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.is_available,
         COALESCE((p.metadata->'hidden')::boolean, false)
    INTO v_available, v_hidden
    FROM public.products AS p
   WHERE p.id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'O produto do pedido não foi encontrado.';
  END IF;

  -- (2) Produto indisponível ou oculto: bloqueado no autoatendimento.
  IF v_available IS FALSE OR v_hidden THEN
    SELECT o.order_source INTO v_source
      FROM public.orders AS o
     WHERE o.id = NEW.order_id;

    IF v_source IS DISTINCT FROM 'pdv' AND v_source IS DISTINCT FROM 'manual' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Este produto está indisponível e não pode ser incluído no pedido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_order_item_before_insert ON public.order_items;
CREATE TRIGGER trg_validate_order_item_before_insert
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_before_insert();
